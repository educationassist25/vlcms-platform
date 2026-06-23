"""
MRM Transition Generator
Generates QQQ MRM transitions for Agilent, SCIEX, Waters, and Thermo instruments.
Implements in-silico MS/MS fragmentation rules for common metabolite classes.
"""
from typing import List, Dict, Optional, Tuple
import math


# Common adduct masses
ADDUCTS = {
    "positive": {
        "[M+H]+":  1.00728,
        "[M+Na]+": 22.98922,
        "[M+NH4]+": 18.03437,
        "[M+K]+":  38.96316,
    },
    "negative": {
        "[M-H]-":     -1.00728,
        "[M+Cl]-":    34.96885,
        "[M+HCOO]-":  44.99765,
        "[M+CH3COO]-": 59.01330,
        "[M-2H]2-":   -2.01456,
    }
}

# Instrument-specific parameters
INSTRUMENT_PARAMS = {
    "Agilent 6495D": {
        "vendor": "Agilent", "model": "6495D",
        "ce_field": "Collision Energy", "frg_field": "Fragmentor",
        "dwell_field": "Dwell Time (ms)", "cav_field": "Cell Accelerator Voltage",
        "default_cav": 4, "default_dwell_ms": 10,
        "default_frg_pos": 380, "default_frg_neg": 380,
        "ce_scaling": 1.0,
    },
    "Agilent 6470": {
        "vendor": "Agilent", "model": "6470",
        "ce_field": "Collision Energy", "frg_field": "Fragmentor",
        "dwell_field": "Dwell Time (ms)", "cav_field": "Cell Accelerator Voltage",
        "default_cav": 4, "default_dwell_ms": 10,
        "default_frg_pos": 350, "default_frg_neg": 350,
        "ce_scaling": 1.0,
    },
    "SCIEX 7500+": {
        "vendor": "SCIEX", "model": "7500",
        "ce_field": "CE", "frg_field": "DP",
        "dwell_field": "Dwell (ms)", "cav_field": "CXP",
        "default_cxp": 10, "default_dwell_ms": 5,
        "default_dp_pos": 60, "default_dp_neg": -60,
        "ce_scaling": 1.0,
    },
    "SCIEX 6500+": {
        "vendor": "SCIEX", "model": "6500",
        "ce_field": "CE", "frg_field": "DP",
        "dwell_field": "Dwell (ms)", "cav_field": "CXP",
        "default_cxp": 10, "default_dwell_ms": 10,
        "default_dp_pos": 55, "default_dp_neg": -55,
        "ce_scaling": 1.0,
    },
    "Waters Xevo TQ-S": {
        "vendor": "Waters", "model": "Xevo TQ-S",
        "ce_field": "Collision Energy", "frg_field": "Cone Voltage",
        "dwell_field": "Dwell Time (s)", "cav_field": None,
        "default_cv_pos": 30, "default_cv_neg": 30,
        "default_dwell_ms": 0.02,
        "ce_scaling": 1.0,
    },
}

# Fragmentation rules by metabolite class
FRAGMENTATION_RULES = {
    "Organic acids": {
        "negative": [
            lambda mz: mz - 18.011,   # loss of H2O
            lambda mz: mz - 44.026,   # loss of CO2
            lambda mz: mz - 46.006,   # loss of CO2 + H2 (formic acid analog)
            lambda mz: 59.013,         # acetate fragment
            lambda mz: mz - 18.011 - 44.026,  # double loss
        ],
        "positive": [
            lambda mz: mz - 18.011,
            lambda mz: mz - 17.027,   # loss of NH3
        ]
    },
    "Amino acids": {
        "negative": [
            lambda mz: mz - 17.027,   # loss of NH3
            lambda mz: mz - 44.026,
            lambda mz: mz - 46.006,
        ],
        "positive": [
            lambda mz: mz - 17.027,
            lambda mz: mz - 18.011,
            lambda mz: mz - 45.021,   # loss of CHO2 (amino acid specific)
            lambda mz: 30.034,         # immonium ions
        ]
    },
    "Nucleotides": {
        "negative": [
            lambda mz: mz - 79.966,   # loss of HPO3
            lambda mz: mz - 97.977,   # loss of H3PO4
            lambda mz: mz - 159.932,  # loss of 2x HPO3
        ],
        "positive": [
            lambda mz: mz - 79.966,
            lambda mz: mz - 132.042,  # loss of adenine
        ]
    },
    "Carbohydrates": {
        "negative": [
            lambda mz: mz - 18.011,
            lambda mz: mz - 60.021,   # loss of C2H4O2
            lambda mz: mz - 36.021,   # loss of 2xH2O
        ],
        "positive": [
            lambda mz: mz - 18.011,
            lambda mz: mz - 36.021,
        ]
    },
    "Fatty acids": {
        "negative": [
            lambda mz: mz - 18.011,
            lambda mz: mz - 44.026,
            lambda mz: 59.013,
        ],
        "positive": [
            lambda mz: mz - 18.011,
        ]
    },
    "Acyl-CoAs": {
        "negative": [
            lambda mz: 303.049,        # pantetheine fragment
            lambda mz: 408.012,        # 3',5'-ADP fragment
            lambda mz: mz - 507.000,  # loss of CoA moiety
        ],
        "positive": [
            lambda mz: 303.049,
            lambda mz: mz - 507.000,
        ]
    },
    "Cofactors": {
        "negative": [
            lambda mz: mz - 79.966,
            lambda mz: mz - 159.932,
        ],
        "positive": [
            lambda mz: mz - 132.042,
            lambda mz: mz - 79.966,
        ]
    },
    "Phosphorylated sugars": {
        "negative": [
            lambda mz: mz - 79.966,
            lambda mz: mz - 97.977,
            lambda mz: mz - 18.011,
        ],
        "positive": [
            lambda mz: mz - 79.966,
        ]
    },
}


def _get_bio_class(metabolite: dict) -> str:
    return metabolite.get("bio_class", "Organic acids")


def _calc_precursor_mz(exact_mass: float, adduct_key: str, ion_mode: str) -> float:
    adduct_delta = ADDUCTS[ion_mode].get(adduct_key, 0.0)
    if "2-" in adduct_key or "2+" in adduct_key:
        return round((exact_mass + adduct_delta) / 2.0, 4)
    return round(exact_mass + adduct_delta, 4)


def _predict_ce(precursor_mz: float, bio_class: str, ion_mode: str) -> int:
    """
    Empirical collision energy prediction based on compound class and precursor m/z.
    Based on published MRM databases and Agilent/SCIEX CE optimization data.
    """
    base_ce = {
        "Organic acids": 12, "Amino acids": 14, "Nucleotides": 20,
        "Carbohydrates": 15, "Fatty acids": 20, "Acyl-CoAs": 22,
        "Cofactors": 18, "Phosphorylated sugars": 22,
    }.get(bio_class, 15)

    # Scale CE slightly with m/z
    mz_factor = max(1.0, math.log10(precursor_mz / 100.0)) * 1.5
    ce = int(base_ce + mz_factor)

    if ion_mode == "positive":
        ce = int(ce * 1.1)

    return max(5, min(ce, 55))


def generate_mrm_transitions(
    metabolite: dict,
    ion_mode: str = "negative",
    instrument_name: str = "Agilent 6495D",
    predicted_rt: float = None,
    rt_window_min: float = 1.0,
) -> List[Dict]:
    """Generate MRM transitions for a single metabolite."""

    exact_mass = metabolite.get("exact_mass", 0.0)
    bio_class = _get_bio_class(metabolite)
    params = INSTRUMENT_PARAMS.get(instrument_name, INSTRUMENT_PARAMS["Agilent 6495D"])

    # Determine preferred adducts
    if ion_mode == "negative":
        adduct_list = ["[M-H]-", "[M+HCOO]-"]
    else:
        adduct_list = ["[M+H]+", "[M+NH4]+", "[M+Na]+"]

    transitions = []
    rules = FRAGMENTATION_RULES.get(bio_class, FRAGMENTATION_RULES["Organic acids"])
    frag_funcs = rules.get(ion_mode, rules.get("negative", []))

    for adduct_key in adduct_list:
        precursor_mz = _calc_precursor_mz(exact_mass, adduct_key, ion_mode)
        ce = _predict_ce(precursor_mz, bio_class, ion_mode)

        # Generate product ions
        product_ions = []
        for i, fn in enumerate(frag_funcs[:4]):
            try:
                product_mz = round(fn(precursor_mz), 4)
                if product_mz > 30 and product_mz < precursor_mz + 2:
                    product_ions.append({
                        "product_mz": product_mz,
                        "ce": ce + (i * 5),
                        "is_quantifier": i == 0,
                    })
            except Exception:
                pass

        if not product_ions:
            # Fallback: use neutral loss from precursor
            product_ions = [{
                "product_mz": round(precursor_mz - 18.011, 4),
                "ce": ce,
                "is_quantifier": True,
            }]

        for pidx, pi in enumerate(product_ions[:3]):  # max 3 transitions per adduct
            t = {
                "metabolite_id": metabolite.get("id", ""),
                "metabolite_name": metabolite.get("name", ""),
                "adduct": adduct_key,
                "precursor_mz": precursor_mz,
                "product_mz": pi["product_mz"],
                "collision_energy": pi["ce"],
                "ion_mode": ion_mode,
                "is_quantifier": pi["is_quantifier"],
                "transition_type": "quantifier" if pi["is_quantifier"] else "qualifier",
                "instrument": instrument_name,
            }

            # Instrument-specific fields
            vendor = params["vendor"]
            if vendor == "Agilent":
                t["fragmentor_voltage"] = params["default_frg_neg"] if ion_mode == "negative" else params["default_frg_pos"]
                t["cell_accelerator_voltage"] = params["default_cav"]
                t["dwell_time_ms"] = params["default_dwell_ms"]
            elif vendor == "SCIEX":
                t["declustering_potential"] = params["default_dp_neg"] if ion_mode == "negative" else params["default_dp_pos"]
                t["collision_exit_potential"] = params["default_cxp"]
                t["dwell_time_ms"] = params["default_dwell_ms"]
            elif vendor == "Waters":
                t["cone_voltage"] = params["default_cv_neg"] if ion_mode == "negative" else params["default_cv_pos"]
                t["dwell_time_s"] = params["default_dwell_ms"]

            if predicted_rt:
                t["retention_time_min"] = round(predicted_rt, 2)
                t["rt_window_start"] = round(predicted_rt - rt_window_min / 2, 2)
                t["rt_window_end"] = round(predicted_rt + rt_window_min / 2, 2)

            transitions.append(t)

        break  # Use primary adduct only unless requested

    return transitions


def generate_scheduled_mrm(transitions_list: List[List[Dict]], total_run_time: float = 10.0) -> Dict:
    """
    Create a scheduled MRM method optimizing dwell times based on RT windows.
    Returns optimized method with per-segment dwell times.
    """
    all_transitions = [t for tlist in transitions_list for t in tlist]
    # Sort by RT
    timed = [t for t in all_transitions if "retention_time_min" in t]
    timed.sort(key=lambda t: t["retention_time_min"])

    # Assign optimal dwell time based on density of transitions at each RT
    time_segments = {}
    for t in timed:
        rt_key = round(t["retention_time_min"] * 2) / 2  # 0.5 min bins
        time_segments.setdefault(rt_key, []).append(t)

    scheduled = []
    for rt_bin, ts in sorted(time_segments.items()):
        n = len(ts)
        # Max cycle time ~500ms; dwell = 500ms / n_transitions
        optimal_dwell = max(3, int(500 / max(n, 1)))
        for t in ts:
            t_copy = dict(t)
            t_copy["dwell_time_ms"] = optimal_dwell
            scheduled.append(t_copy)

    return {
        "method_type": "scheduled_mrm",
        "total_transitions": len(scheduled),
        "total_run_time_min": total_run_time,
        "transitions": scheduled,
        "segments": len(time_segments),
    }
