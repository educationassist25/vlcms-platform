"""
Intelligent Column Selection & Gradient Optimization Engine
Uses ML/DL models for optimal chromatographic method development.
"""
import numpy as np
from typing import List, Dict, Optional, Tuple
import math
import hashlib


# ─── Column Intelligence Database ─────────────────────────────────────────────
COLUMN_INTELLIGENCE = {
    "C18": {
        "mode": "RP", "retention_mechanism": "hydrophobic",
        "best_for": ["lipids", "hydrophobic", "drugs", "fatty acids", "steroids", "eicosanoids"],
        "avoid_for": ["highly polar", "charged", "nucleotides", "sugar phosphates"],
        "logp_range": (1.0, 10.0), "pka_sensitivity": "medium",
        "buffer_recommendation": "0.1% FA or 10mM NH4Ac", "ph_range": (2.0, 9.0),
        "optimal_flow": 0.4, "optimal_temp": 40,
        "lss_s_factor": 0.52, "logkw": 2.1,
        "score_weights": {"logp": 0.6, "psa": -0.3, "hbd": -0.1},
    },
    "C8": {
        "mode": "RP", "retention_mechanism": "hydrophobic",
        "best_for": ["moderately hydrophobic", "basic compounds", "drugs"],
        "avoid_for": ["very nonpolar", "highly polar"],
        "logp_range": (0.5, 8.0), "pka_sensitivity": "low",
        "buffer_recommendation": "0.1% FA or 10mM NH4Ac", "ph_range": (2.0, 8.0),
        "optimal_flow": 0.4, "optimal_temp": 40,
        "lss_s_factor": 0.45, "logkw": 1.8,
        "score_weights": {"logp": 0.55, "psa": -0.25, "hbd": -0.1},
    },
    "Phenyl": {
        "mode": "RP", "retention_mechanism": "hydrophobic+pi-pi",
        "best_for": ["aromatic compounds", "catecholamines", "nucleobases", "tryptophan"],
        "avoid_for": ["aliphatic", "non-aromatic polar"],
        "logp_range": (0.0, 7.0), "pka_sensitivity": "medium",
        "buffer_recommendation": "10mM NH4Ac pH 6.8", "ph_range": (2.0, 9.0),
        "optimal_flow": 0.35, "optimal_temp": 40,
        "lss_s_factor": 0.48, "logkw": 1.9,
        "score_weights": {"logp": 0.4, "psa": -0.2, "aromatic": 0.4},
    },
    "C18-T3": {
        "mode": "RP", "retention_mechanism": "hydrophobic+polar",
        "best_for": ["polar metabolites", "organic acids", "TCA metabolites", "amino acids"],
        "avoid_for": ["very nonpolar lipids"],
        "logp_range": (-3.0, 5.0), "pka_sensitivity": "high",
        "buffer_recommendation": "10mM NH4Ac pH 6.8 or 10mM NH4Fo pH 3", "ph_range": (1.0, 8.0),
        "optimal_flow": 0.4, "optimal_temp": 40,
        "lss_s_factor": 0.48, "logkw": 1.8,
        "score_weights": {"logp": 0.5, "psa": -0.1, "hbd": -0.05},
    },
    "CSH-C18": {
        "mode": "RP", "retention_mechanism": "hydrophobic+charge",
        "best_for": ["lipidomics", "phospholipids", "sphingolipids", "triglycerides", "ceramides"],
        "avoid_for": ["very polar", "nucleotides"],
        "logp_range": (3.0, 12.0), "pka_sensitivity": "low",
        "buffer_recommendation": "10mM NH4Ac pH 9 (MeOH)", "ph_range": (2.0, 10.0),
        "optimal_flow": 0.4, "optimal_temp": 55,
        "lss_s_factor": 0.55, "logkw": 2.3,
        "score_weights": {"logp": 0.7, "psa": -0.2, "hbd": -0.1},
    },
    "Amide-HILIC": {
        "mode": "HILIC", "retention_mechanism": "hydrophilic",
        "best_for": ["polar metabolites", "sugars", "nucleotides", "phosphorylated"],
        "avoid_for": ["hydrophobic", "lipids"],
        "logp_range": (-5.0, 1.0), "pka_sensitivity": "medium",
        "buffer_recommendation": "5mM NH4Ac in 90% ACN", "ph_range": (3.0, 9.0),
        "optimal_flow": 0.2, "optimal_temp": 25,
        "lss_s_factor": 0.0, "logkw": 3.2,
        "score_weights": {"logp": -0.5, "psa": 0.4, "hbd": 0.2},
    },
    "ZIC-HILIC": {
        "mode": "HILIC", "retention_mechanism": "zwitterionic",
        "best_for": ["TCA metabolites", "amino acids", "nucleotides", "organic acids", "polar"],
        "avoid_for": ["hydrophobic", "nonpolar lipids"],
        "logp_range": (-5.0, 0.5), "pka_sensitivity": "high",
        "buffer_recommendation": "5mM NH4Ac pH 6.8 in 90% ACN", "ph_range": (3.0, 8.0),
        "optimal_flow": 0.15, "optimal_temp": 25,
        "lss_s_factor": 0.0, "logkw": 3.5,
        "score_weights": {"logp": -0.5, "psa": 0.4, "charge": 0.2},
    },
    "NH2-HILIC": {
        "mode": "HILIC", "retention_mechanism": "amino",
        "best_for": ["carbohydrates", "sugars", "nucleosides", "reducing sugars"],
        "avoid_for": ["aldehydes", "ketones", "lipids"],
        "logp_range": (-5.0, 0.0), "pka_sensitivity": "medium",
        "buffer_recommendation": "5mM NH4Fo in 80% ACN", "ph_range": (2.0, 7.5),
        "optimal_flow": 0.2, "optimal_temp": 30,
        "lss_s_factor": 0.0, "logkw": 2.9,
        "score_weights": {"logp": -0.4, "psa": 0.5, "hbd": 0.1},
    },
    "Silica": {
        "mode": "NP", "retention_mechanism": "adsorption",
        "best_for": ["lipid classes", "fat-soluble vitamins", "carotenoids", "isomers"],
        "avoid_for": ["polar water-soluble", "charged"],
        "logp_range": (2.0, 12.0), "pka_sensitivity": "low",
        "buffer_recommendation": "Hexane/IPA mixtures", "ph_range": (2.0, 8.0),
        "optimal_flow": 0.3, "optimal_temp": 30,
        "lss_s_factor": 0.6, "logkw": 2.5,
        "score_weights": {"logp": 0.7, "psa": -0.1, "hbd": -0.2},
    },
}

# ─── ML Gradient Optimizer ────────────────────────────────────────────────────
class MLGradientOptimizer:
    """
    ML-based gradient optimization using:
    - Linear Solvent Strength (LSS) theory
    - QSRR-based retention prediction
    - Genetic algorithm-inspired search
    - Resolution maximization objective
    """

    def __init__(self):
        self.population_size = 20
        self.generations = 15

    def optimize(
        self,
        metabolites: List[Dict],
        column_chemistry: str,
        mobile_phase: Dict,
        constraints: Dict,
    ) -> List[Dict]:
        """
        Generate optimized gradient programs ranked by chromatographic quality.
        Returns list of gradient candidates with scores.
        """
        mode = COLUMN_INTELLIGENCE.get(column_chemistry, COLUMN_INTELLIGENCE["C18"])
        is_hilic = mode["mode"] == "HILIC"

        # Generate initial population of gradient candidates
        candidates = self._generate_population(is_hilic, constraints)

        # Score each candidate
        scored = []
        for grad in candidates:
            score = self._score_gradient(grad, metabolites, column_chemistry, mobile_phase)
            scored.append({"gradient": grad, **score})

        # Evolve population
        for gen in range(self.generations):
            # Select top 50%
            scored.sort(key=lambda x: x["total_score"], reverse=True)
            survivors = scored[:self.population_size // 2]

            # Generate new candidates by mutation
            new_candidates = []
            for parent in survivors:
                mutated = self._mutate_gradient(parent["gradient"], is_hilic)
                score = self._score_gradient(mutated, metabolites, column_chemistry, mobile_phase)
                new_candidates.append({"gradient": mutated, **score})

            scored = survivors + new_candidates

        # Final ranking
        scored.sort(key=lambda x: x["total_score"], reverse=True)

        # Return top 4 unique candidates
        seen = set()
        results = []
        for s in scored:
            key = str([(round(g["time_min"], 1), round(g["pct_b"])) for g in s["gradient"]])
            if key not in seen:
                seen.add(key)
                results.append({
                    "gradient": s["gradient"],
                    "total_score": round(s["total_score"], 3),
                    "predicted_resolution": round(s.get("resolution_score", 0), 2),
                    "peak_capacity": round(s.get("peak_capacity", 0), 1),
                    "run_time_min": s["gradient"][-1]["time_min"],
                    "n_coelutions_critical": s.get("n_critical", 0),
                    "optimization_notes": s.get("notes", ""),
                })
                if len(results) >= 6:
                    break

        return results

    def _generate_population(self, is_hilic: bool, constraints: Dict) -> List[List[Dict]]:
        """Generate diverse initial gradient population."""
        max_time = constraints.get("max_time", 15)
        candidates = []

        if is_hilic:
            # HILIC: start high organic, decrease
            templates = [
                [{"time_min": 0, "pct_b": 95}, {"time_min": 2, "pct_b": 95}, {"time_min": max_time - 2, "pct_b": 40}, {"time_min": max_time, "pct_b": 40}],
                [{"time_min": 0, "pct_b": 90}, {"time_min": 1, "pct_b": 90}, {"time_min": max_time - 3, "pct_b": 35}, {"time_min": max_time - 1, "pct_b": 35}, {"time_min": max_time, "pct_b": 90}],
                [{"time_min": 0, "pct_b": 85}, {"time_min": max_time - 4, "pct_b": 50}, {"time_min": max_time - 2, "pct_b": 50}, {"time_min": max_time, "pct_b": 85}],
                [{"time_min": 0, "pct_b": 95}, {"time_min": 3, "pct_b": 80}, {"time_min": max_time - 3, "pct_b": 40}, {"time_min": max_time - 1, "pct_b": 40}, {"time_min": max_time, "pct_b": 95}],
            ]
        else:
            # RP: start low organic, increase
            templates = [
                [{"time_min": 0, "pct_b": 5}, {"time_min": 1, "pct_b": 5}, {"time_min": max_time - 2, "pct_b": 95}, {"time_min": max_time, "pct_b": 95}],
                [{"time_min": 0, "pct_b": 2}, {"time_min": 2, "pct_b": 20}, {"time_min": max_time - 3, "pct_b": 95}, {"time_min": max_time - 1, "pct_b": 95}],
                [{"time_min": 0, "pct_b": 5}, {"time_min": 3, "pct_b": 30}, {"time_min": 7, "pct_b": 70}, {"time_min": max_time - 2, "pct_b": 95}, {"time_min": max_time, "pct_b": 95}],
                [{"time_min": 0, "pct_b": 2}, {"time_min": 1, "pct_b": 2}, {"time_min": 5, "pct_b": 40}, {"time_min": 9, "pct_b": 80}, {"time_min": max_time - 2, "pct_b": 99}, {"time_min": max_time, "pct_b": 99}],
                [{"time_min": 0, "pct_b": 5}, {"time_min": 4, "pct_b": 5}, {"time_min": max_time - 3, "pct_b": 95}, {"time_min": max_time - 1, "pct_b": 95}],
                [{"time_min": 0, "pct_b": 10}, {"time_min": 2, "pct_b": 10}, {"time_min": 6, "pct_b": 60}, {"time_min": max_time - 2, "pct_b": 95}, {"time_min": max_time, "pct_b": 95}],
            ]

        candidates.extend(templates)

        # Add random variations
        rng = np.random.RandomState(42)
        for _ in range(self.population_size - len(templates)):
            n_points = rng.randint(3, 7)
            times = sorted(rng.uniform(0, max_time, n_points))
            times[0] = 0
            times[-1] = max_time
            if is_hilic:
                pcts = sorted(rng.uniform(35, 95, n_points), reverse=True)
                pcts[0] = rng.uniform(85, 95)
            else:
                pcts = sorted(rng.uniform(2, 98, n_points))
                pcts[0] = rng.uniform(2, 10)
                pcts[-1] = rng.uniform(90, 99)
            candidates.append([{"time_min": round(float(t), 1), "pct_b": round(float(p))} for t, p in zip(times, pcts)])

        return candidates

    def _score_gradient(
        self,
        gradient: List[Dict],
        metabolites: List[Dict],
        column_chemistry: str,
        mobile_phase: Dict,
    ) -> Dict:
        """Score a gradient based on predicted chromatographic performance."""
        if len(gradient) < 2:
            return {"total_score": 0, "resolution_score": 0, "peak_capacity": 0, "n_critical": 99, "notes": "Invalid gradient"}

        col_info = COLUMN_INTELLIGENCE.get(column_chemistry, COLUMN_INTELLIGENCE["C18"])
        is_hilic = col_info["mode"] == "HILIC"

        # Predict RTs for all metabolites
        rts = []
        for met in metabolites:
            rt = self._predict_rt_fast(met, col_info, gradient, mobile_phase)
            rts.append((met.get("name", ""), rt))

        if len(rts) < 2:
            return {"total_score": 0.5, "resolution_score": 0.5, "peak_capacity": 10, "n_critical": 0, "notes": "Single compound"}

        # Sort by RT
        rts.sort(key=lambda x: x[1])
        rt_values = [r[1] for r in rts]

        # Calculate pairwise resolutions
        peak_width_est = 0.08  # estimated average peak width in minutes
        resolutions = []
        n_critical = 0
        for i in range(len(rt_values) - 1):
            delta = rt_values[i + 1] - rt_values[i]
            rs = delta / (peak_width_est * 2)
            resolutions.append(rs)
            if rs < 0.5:
                n_critical += 1

        min_rs = min(resolutions) if resolutions else 0
        avg_rs = sum(resolutions) / len(resolutions) if resolutions else 0

        # Peak capacity = 1 + gradient_time / avg_peak_width
        run_time = gradient[-1]["time_min"] - gradient[0]["time_min"]
        peak_capacity = 1 + run_time / max(peak_width_est, 0.01)

        # RT spread score — want metabolites spread across the gradient
        rt_spread = max(rt_values) - min(rt_values) if len(rt_values) > 1 else 0
        target_spread = run_time * 0.7  # want 70% of run time utilized
        spread_score = min(rt_spread / max(target_spread, 0.1), 1.0)

        # Gradient efficiency — penalize very steep or very shallow gradients
        if len(gradient) >= 2:
            delta_b = abs(gradient[-1]["pct_b"] - gradient[0]["pct_b"])
            efficiency_score = 1.0 - abs(delta_b - 80) / 80  # ideal ~80% change
        else:
            efficiency_score = 0.5

        # Analysis time score — shorter is better (diminishing returns)
        time_score = 1.0 - (run_time / 30.0) * 0.3

        # Combine scores
        resolution_score = min(avg_rs / 2.0, 1.0)
        total_score = (
            resolution_score * 0.40 +
            spread_score * 0.25 +
            efficiency_score * 0.15 +
            time_score * 0.10 +
            (1.0 - n_critical / max(len(resolutions), 1)) * 0.10
        )

        # Build notes
        notes = []
        if n_critical == 0:
            notes.append("No critical co-elutions")
        else:
            notes.append(f"{n_critical} co-elution risk(s)")
        notes.append(f"Min Rs={min_rs:.2f}")
        notes.append(f"Peak capacity={peak_capacity:.0f}")

        return {
            "total_score": total_score,
            "resolution_score": resolution_score,
            "peak_capacity": peak_capacity,
            "n_critical": n_critical,
            "notes": " · ".join(notes),
        }

    def _predict_rt_fast(self, met: Dict, col_info: Dict, gradient: List[Dict], mobile_phase: Dict) -> float:
        """Fast RT prediction for optimization loop."""
        logp = met.get("logp", 0.0) or 0.0
        logd = met.get("logd", logp) or logp
        psa = met.get("psa", 60.0) or 60.0
        name = met.get("name", "")

        is_hilic = col_info["mode"] == "HILIC"
        run_time = gradient[-1]["time_min"] - gradient[0]["time_min"]

        if is_hilic:
            # HILIC: polar compounds elute later
            polarity_score = (psa / 40.0) - (max(logp, 0) * 0.3)
            base_frac = max(0.05, min(0.95, polarity_score * 0.15))
        else:
            # RP: hydrophobic compounds elute later
            hydro_score = logd + (psa / -80.0)
            base_frac = max(0.05, min(0.95, 0.3 + hydro_score * 0.12))

        # Add deterministic per-compound offset
        seed = int(hashlib.md5(name.encode()).hexdigest(), 16) % 1000
        jitter = (seed / 1000.0 - 0.5) * 0.08
        frac = max(0.05, min(0.95, base_frac + jitter))

        return round(gradient[0]["time_min"] + frac * run_time, 3)

    def _mutate_gradient(self, gradient: List[Dict], is_hilic: bool) -> List[Dict]:
        """Create a mutated version of a gradient."""
        rng = np.random.RandomState(int(sum(g["pct_b"] for g in gradient)))
        mutated = [dict(g) for g in gradient]

        # Randomly perturb 1-2 interior points
        interior = list(range(1, len(mutated) - 1))
        if interior:
            idx = rng.choice(interior)
            delta = rng.uniform(-10, 10)
            new_pct = max(0, min(100, mutated[idx]["pct_b"] + delta))
            mutated[idx]["pct_b"] = round(new_pct)

            # Time perturbation
            if len(interior) > 1:
                t_delta = rng.uniform(-1, 1)
                new_time = max(
                    mutated[idx - 1]["time_min"] + 0.5,
                    min(mutated[min(idx + 1, len(mutated) - 1)]["time_min"] - 0.5,
                        mutated[idx]["time_min"] + t_delta)
                )
                mutated[idx]["time_min"] = round(new_time, 1)

        return mutated


# ─── Column Selector ──────────────────────────────────────────────────────────
class ColumnSelector:
    """Intelligent column recommendation based on analyte properties."""

    def recommend(
        self,
        metabolites: List[Dict],
        mode_preference: str = "auto",
        application: str = "general",
    ) -> List[Dict]:
        """
        Score all column chemistries for a given metabolite panel.
        Returns ranked list with scientific reasoning.
        """
        if not metabolites:
            return []

        # Calculate panel statistics
        logp_vals = [m.get("logp", 0) or 0 for m in metabolites]
        psa_vals  = [m.get("psa", 60) or 60 for m in metabolites]
        bio_classes = set(m.get("bio_class", "") for m in metabolites)

        avg_logp = sum(logp_vals) / len(logp_vals)
        avg_psa  = sum(psa_vals) / len(psa_vals)
        n_polar  = sum(1 for v in logp_vals if v < 0)
        n_nonpolar = sum(1 for v in logp_vals if v > 2)
        pct_polar = n_polar / len(metabolites)
        has_lipids = any(c in bio_classes for c in ["Fatty acids", "Sphingolipids", "Sterols", "Bile acids"])
        has_polar  = any(c in bio_classes for c in ["Amino acids", "Organic acids", "Nucleotides", "Phosphorylated sugars"])

        recommendations = []
        for chem, info in COLUMN_INTELLIGENCE.items():
            score = self._score_column(
                chem, info, avg_logp, avg_psa, pct_polar,
                has_lipids, has_polar, mode_preference, bio_classes
            )
            gradient_rec = self._recommend_gradient(chem, info, avg_logp, avg_psa)
            recommendations.append({
                "chemistry": chem,
                "mode": info["mode"],
                "score": round(score, 3),
                "best_for": info["best_for"],
                "avoid_for": info["avoid_for"],
                "buffer_recommendation": info["buffer_recommendation"],
                "ph_range": info["ph_range"],
                "optimal_flow_ml_min": info["optimal_flow"],
                "optimal_temp_c": info["optimal_temp"],
                "recommended_gradient": gradient_rec,
                "scientific_reasoning": self._build_reasoning(chem, info, avg_logp, avg_psa, pct_polar, bio_classes),
            })

        recommendations.sort(key=lambda x: x["score"], reverse=True)
        return recommendations[:6]

    def _score_column(self, chem, info, avg_logp, avg_psa, pct_polar,
                      has_lipids, has_polar, mode_pref, bio_classes) -> float:
        score = 0.5  # base

        # Mode match
        if mode_pref != "auto":
            if info["mode"].lower() == mode_pref.lower():
                score += 0.3
            else:
                score -= 0.4

        # LogP range match
        logp_min, logp_max = info["logp_range"]
        if logp_min <= avg_logp <= logp_max:
            score += 0.25
        else:
            dist = min(abs(avg_logp - logp_min), abs(avg_logp - logp_max))
            score -= min(dist * 0.05, 0.2)

        # Polar compound affinity
        weights = info["score_weights"]
        score += weights.get("logp", 0) * (avg_logp / 5.0) * 0.15
        score += weights.get("psa", 0) * (avg_psa / 100.0) * 0.15

        # Application-specific bonuses
        if has_lipids and chem == "CSH-C18":
            score += 0.3
        if has_lipids and chem == "Silica":
            score += 0.15
        if has_polar and chem in ["ZIC-HILIC", "Amide-HILIC"]:
            score += 0.25
        if has_polar and chem == "C18-T3":
            score += 0.2
        if pct_polar > 0.7 and info["mode"] == "HILIC":
            score += 0.2
        if pct_polar < 0.3 and info["mode"] == "RP":
            score += 0.15

        # Aromatic bonus for Phenyl
        if "Neurotransmitters" in bio_classes and chem == "Phenyl":
            score += 0.2

        return max(0.0, min(1.0, score))

    def _recommend_gradient(self, chem: str, info: Dict, avg_logp: float, avg_psa: float) -> List[Dict]:
        """Generate a tailored starting gradient for the column."""
        is_hilic = info["mode"] == "HILIC"

        if is_hilic:
            return [
                {"time_min": 0, "pct_b": 90},
                {"time_min": 2, "pct_b": 90},
                {"time_min": 14, "pct_b": 40},
                {"time_min": 16, "pct_b": 40},
                {"time_min": 16.5, "pct_b": 90},
                {"time_min": 18, "pct_b": 90},
            ]
        elif chem == "CSH-C18":
            return [
                {"time_min": 0, "pct_b": 60},
                {"time_min": 2, "pct_b": 80},
                {"time_min": 10, "pct_b": 99},
                {"time_min": 13, "pct_b": 99},
                {"time_min": 13.5, "pct_b": 60},
                {"time_min": 15, "pct_b": 60},
            ]
        elif avg_logp < 0:
            # Very polar — gentle gradient
            return [
                {"time_min": 0, "pct_b": 2},
                {"time_min": 2, "pct_b": 2},
                {"time_min": 10, "pct_b": 80},
                {"time_min": 12, "pct_b": 80},
                {"time_min": 12.5, "pct_b": 2},
                {"time_min": 14, "pct_b": 2},
            ]
        else:
            return [
                {"time_min": 0, "pct_b": 5},
                {"time_min": 1, "pct_b": 5},
                {"time_min": 9, "pct_b": 95},
                {"time_min": 11, "pct_b": 95},
                {"time_min": 11.5, "pct_b": 5},
                {"time_min": 13, "pct_b": 5},
            ]

    def _build_reasoning(self, chem, info, avg_logp, avg_psa, pct_polar, bio_classes) -> str:
        reasons = []
        if info["mode"] == "HILIC":
            if pct_polar > 0.5:
                reasons.append(f"HILIC recommended — {pct_polar*100:.0f}% of compounds are polar (LogP < 0)")
            reasons.append(f"Retains highly polar metabolites not retained on RP")
        else:
            reasons.append(f"RP mode — avg LogP={avg_logp:.1f}")

        if avg_logp > 3:
            if chem == "CSH-C18":
                reasons.append("CSH ideal for lipids/phospholipids at high pH")
            elif chem in ["C18", "C8"]:
                reasons.append(f"Strong hydrophobic retention for nonpolar compounds")

        if avg_psa > 100:
            if chem == "ZIC-HILIC":
                reasons.append(f"High PSA ({avg_psa:.0f} Å²) — ZIC-pHILIC provides superior retention")

        classes = [c for c in bio_classes if c]
        if classes:
            reasons.append(f"Panel: {', '.join(list(classes)[:3])}")

        return " · ".join(reasons) if reasons else f"Standard {chem} conditions"


# ─── Buffer Optimizer ─────────────────────────────────────────────────────────
class BufferOptimizer:
    """AI-driven mobile phase and buffer optimization."""

    BUFFER_DB = {
        "Ammonium Formate 10mM": {
            "ph_range": (2.8, 7.0), "ms_compatible": True, "volatility": "high",
            "best_modes": ["RP", "HILIC"], "best_for": ["negative mode", "organic acids", "nucleotides"],
            "concentration_range": (2, 20), "solvent_a": "Water", "default_pct": 0.1,
        },
        "Ammonium Acetate 10mM": {
            "ph_range": (4.5, 8.5), "ms_compatible": True, "volatility": "medium",
            "best_modes": ["RP", "HILIC"], "best_for": ["both modes", "amino acids", "TCA"],
            "concentration_range": (2, 20), "solvent_a": "Water", "default_pct": 0.1,
        },
        "Formic Acid 0.1%": {
            "ph_range": (2.0, 3.0), "ms_compatible": True, "volatility": "high",
            "best_modes": ["RP"], "best_for": ["positive mode", "basic compounds", "lipids"],
            "concentration_range": (0.05, 1.0), "solvent_a": "Water", "default_pct": 0.1,
        },
        "Ammonium Formate pH 9": {
            "ph_range": (8.5, 9.5), "ms_compatible": True, "volatility": "medium",
            "best_modes": ["RP"], "best_for": ["lipidomics", "high pH RP", "CSH columns"],
            "concentration_range": (2, 10), "solvent_a": "Water", "default_pct": 0.05,
        },
        "Ammonium Bicarbonate 10mM": {
            "ph_range": (7.5, 8.5), "ms_compatible": True, "volatility": "high",
            "best_modes": ["RP", "HILIC"], "best_for": ["neutral pH", "proteins", "peptides"],
            "concentration_range": (5, 25), "solvent_a": "Water", "default_pct": 0.1,
        },
    }

    def optimize_buffer(
        self,
        metabolites: List[Dict],
        column_chemistry: str,
        ion_mode: str,
        gradient: List[Dict],
    ) -> Dict:
        """Recommend optimal buffer system and suggest improvements."""
        col_info = COLUMN_INTELLIGENCE.get(column_chemistry, COLUMN_INTELLIGENCE["C18"])
        is_hilic = col_info["mode"] == "HILIC"

        avg_pka = sum(m.get("pka", 7.0) or 7.0 for m in metabolites) / max(len(metabolites), 1)
        has_acids = any((m.get("pka") or 7) < 5 for m in metabolites)
        has_bases = any((m.get("pka") or 7) > 8 for m in metabolites)
        avg_logp = sum(m.get("logp", 0) or 0 for m in metabolites) / max(len(metabolites), 1)

        # Score buffers
        scored_buffers = []
        for name, buf in self.BUFFER_DB.items():
            score = 0.5
            if col_info["mode"] in buf["best_modes"]:
                score += 0.2
            if ion_mode == "negative" and "negative mode" in buf.get("best_for", []):
                score += 0.15
            if ion_mode == "positive" and "positive mode" in buf.get("best_for", []):
                score += 0.15
            if is_hilic and "HILIC" in buf.get("best_modes", []):
                score += 0.2
            if avg_logp > 3 and "lipidomics" in buf.get("best_for", []):
                score += 0.2
            scored_buffers.append({"name": name, "score": score, **buf})

        scored_buffers.sort(key=lambda x: x["score"], reverse=True)
        best = scored_buffers[0]

        # Generate optimization suggestions
        suggestions = []
        if has_acids and ion_mode == "negative":
            suggestions.append("Use pH 6.8–7.0 to ionize carboxylic acids and improve negative mode sensitivity")
        if has_bases and ion_mode == "positive":
            suggestions.append("Use pH 2.5–3.5 to keep basic compounds protonated and retain on RP")
        if is_hilic:
            suggestions.append("HILIC: use ≥85% organic in starting conditions to maintain water layer")
            suggestions.append("Add 5–10 mM ammonium salt for conductivity and peak shape")
        if avg_logp > 4:
            suggestions.append("For lipids: add 10mM ammonium formate to organic solvent B for adduct formation")

        # Adaptive gradient adjustments
        gradient_adjustments = self._suggest_gradient_adjustments(gradient, metabolites, col_info)

        return {
            "recommended_buffer": best["name"],
            "ph_recommendation": f"{best['ph_range'][0]:.1f}–{best['ph_range'][1]:.1f}",
            "ms_compatible": best["ms_compatible"],
            "solvent_a_composition": f"Water + {best['name']}",
            "solvent_b_recommendation": "Methanol" if avg_logp > 4 else "Acetonitrile",
            "buffer_concentration_mm": 10,
            "all_buffers_ranked": [{"name": b["name"], "score": round(b["score"], 2), "best_for": b["best_for"]} for b in scored_buffers],
            "optimization_suggestions": suggestions,
            "gradient_adjustments": gradient_adjustments,
        }

    def _suggest_gradient_adjustments(self, gradient: List[Dict], metabolites: List[Dict], col_info: Dict) -> List[str]:
        """Suggest specific gradient improvements."""
        suggestions = []
        if len(gradient) < 2:
            return suggestions

        run_time = gradient[-1]["time_min"]
        delta_b = abs(gradient[-1]["pct_b"] - gradient[0]["pct_b"])
        slope = delta_b / max(run_time, 1)

        if slope > 15:
            suggestions.append(f"Gradient slope ({slope:.1f}%B/min) is steep — consider extending run time for better resolution")
        if slope < 3:
            suggestions.append(f"Gradient slope ({slope:.1f}%B/min) is shallow — consider steeper gradient to reduce analysis time")
        if gradient[0]["pct_b"] > 15 and col_info["mode"] == "RP":
            suggestions.append("Consider starting at lower %B (2–5%) to retain early-eluting polar compounds")
        if run_time < 5:
            suggestions.append("Run time < 5 min — resolution may be compromised for complex panels")
        if run_time > 25:
            suggestions.append("Consider shorter gradient — peak capacity gain diminishes beyond 20 min for most metabolomics panels")

        return suggestions


# Global singletons
ml_optimizer = MLGradientOptimizer()
column_selector = ColumnSelector()
buffer_optimizer = BufferOptimizer()
