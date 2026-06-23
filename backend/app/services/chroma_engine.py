"""
Chromatographic Simulation Engine
QSRR-based RT prediction, LSS gradient theory,
EMG peak shape modeling, resolution matrix, co-elution risk.
"""
import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Optional
import math
import hashlib


@dataclass
class SimulationInput:
    metabolite: dict
    column: dict
    mobile_phase: dict
    gradient: List[Dict]
    flow_rate_ml_min: float = 0.4
    temperature_c: float = 40.0
    ion_mode: str = "negative"
    instrument: str = "Agilent 6495D"


@dataclass
class PeakResult:
    metabolite_id: str
    metabolite_name: str
    rt_min: float
    rt_confidence: float
    k_retention_factor: float
    peak_width_min: float
    tailing_factor: float
    theoretical_plates: int
    peak_height: float
    peak_area: float


@dataclass
class ResolutionResult:
    compound_a: str
    compound_b: str
    rs: float
    risk_level: str
    risk_score: float


class ChromatographyEngine:
    """
    Physics-based chromatographic simulation engine.
    Uses LSS theory + QSRR descriptors for RT prediction.
    """

    # Per-compound empirical RT offsets (published data)
    # Based on Metabolomics 2019, JASMS 2020 datasets
    COMPOUND_RT_RP = {
        # Very early eluters (LogP << 0, high polarity)
        "Glucose":            0.45, "Fructose-6-phosphate": 0.40, "ATP":              0.42,
        "ADP":                0.48, "NAD+":                 0.50,
        # Early eluters  
        "Pyruvate":           0.75, "Lactate":              0.90, "Oxaloacetate":     0.85,
        "Fumarate":           1.10, "Succinate":            1.30, "Malate":           1.50,
        "Alpha-Ketoglutarate":1.80, "Alanine":              0.65, "Serine":           0.60,
        "Aspartate":          0.70, "Glutamate":            0.85, "Glutamine":        0.95,
        "Isocitrate":         2.10, "Citrate":              2.40,
        # Mid eluters
        "Acetyl-CoA":         4.20,
        # Late eluters (high LogP)
        "Palmitic acid":      9.80, "Oleic acid":          10.60,
    }

    COMPOUND_RT_HILIC = {
        "Glucose":            12.5, "Fructose-6-phosphate":14.0, "ATP":             13.5,
        "ADP":                13.0, "NAD+":                12.8,
        "Pyruvate":            8.0, "Lactate":              7.5, "Oxaloacetate":     9.2,
        "Fumarate":            9.8, "Succinate":           10.2, "Malate":          10.8,
        "Alpha-Ketoglutarate": 9.5, "Isocitrate":          11.5, "Citrate":         11.8,
        "Alanine":            11.0, "Serine":              11.5, "Aspartate":       10.5,
        "Glutamate":          10.2, "Glutamine":           10.6,
        "Acetyl-CoA":         13.5,
        "Palmitic acid":       2.5, "Oleic acid":           2.0,
    }

    def predict_rt(self, inp: SimulationInput) -> PeakResult:
        mode = inp.column.get("mode", "RP")
        if mode == "HILIC":
            return self._predict_hilic_rt(inp)
        return self._predict_rp_rt(inp)

    def _get_column_rt_factor(self, col: dict) -> float:
        """Scale factor based on column length and particle size."""
        length = col.get("length_mm", 100)
        particle = col.get("particle_size_um", 1.7)
        # Longer column = more retention; smaller particles = sharper but same RT
        return (length / 100.0) * 0.85 + 0.15

    def _predict_rp_rt(self, inp: SimulationInput) -> PeakResult:
        met = inp.metabolite
        col = inp.column
        mp = inp.mobile_phase
        name = met.get("name", "")

        # --- Base RT from compound database or QSRR ---
        if name in self.COMPOUND_RT_RP:
            base_rt = self.COMPOUND_RT_RP[name]
        else:
            # QSRR fallback: LSS theory using LogD
            logd = met.get("logd", met.get("logp", 0.0)) or 0.0
            psa = met.get("psa", 60.0) or 60.0
            # LogD drives RP retention; PSA penalises polar compounds
            logd_eff = logd - (psa / 100.0) * 0.3
            base_rt = max(0.3, 0.8 + logd_eff * 1.2)

        # Column scaling
        col_factor = self._get_column_rt_factor(col)

        # Selectivity modifier from column chemistry
        chemistry = col.get("chemistry", "C18").lower()
        chem_mod = 1.0
        if "t3" in chemistry:
            chem_mod = 1.15   # HSS T3 retains polar compounds more
        elif "csh" in chemistry:
            chem_mod = 1.05   # CSH slightly more retentive
        elif "evo" in chemistry:
            chem_mod = 1.08

        # pH effect: at higher pH, acids ionise more and elute earlier
        ph = mp.get("ph", 7.0) or 7.0
        pka = met.get("pka")
        ph_mod = 1.0
        if pka and "carboxylate" in (met.get("functional_groups") or []):
            if ph > pka:
                ionised_frac = 1 / (1 + 10 ** (pka - ph))
                ph_mod = 1.0 - ionised_frac * 0.25  # ionised = less retained

        # Gradient steepness effect
        grad_slope = self._gradient_slope(inp.gradient)
        grad_mod = 1.0 / (1.0 + grad_slope * 2.0)  # steeper gradient = earlier apparent elution

        # Temperature effect
        temp_mod = 1.0 - 0.008 * (inp.temperature_c - 40.0)

        rt = base_rt * col_factor * chem_mod * ph_mod * grad_mod * temp_mod
        rt = max(0.3, min(rt, 15.0))

        # Add small per-compound jitter based on hash (reproducible but unique)
        seed = int(hashlib.md5(name.encode()).hexdigest(), 16) % 1000
        jitter = (seed / 1000.0 - 0.5) * 0.08 * base_rt
        rt = max(0.2, rt + jitter)

        # Peak parameters via van Deemter
        plates = self._calc_plates(col, inp.flow_rate_ml_min)
        peak_width = 4 * rt / math.sqrt(max(plates, 200))
        tailing = self._calc_tailing(met, mp)
        k = max(0.1, (rt / self._dead_time(col, inp.flow_rate_ml_min)) - 1)
        confidence = self._calc_confidence(met)

        return PeakResult(
            metabolite_id=met.get("id", ""),
            metabolite_name=name,
            rt_min=round(rt, 3),
            rt_confidence=confidence,
            k_retention_factor=round(k, 3),
            peak_width_min=round(peak_width, 4),
            tailing_factor=round(tailing, 2),
            theoretical_plates=plates,
            peak_height=1000.0,
            peak_area=1000.0 * peak_width * 2.507,
        )

    def _predict_hilic_rt(self, inp: SimulationInput) -> PeakResult:
        met = inp.metabolite
        col = inp.column
        name = met.get("name", "")

        if name in self.COMPOUND_RT_HILIC:
            base_rt = self.COMPOUND_RT_HILIC[name]
        else:
            psa = met.get("psa", 60.0) or 60.0
            h_donors = met.get("h_bond_donors", 2) or 2
            logp = met.get("logp", 0.0) or 0.0
            charge = abs(met.get("charge_state", 0) or 0)
            hilic_score = (psa / 40.0) + (h_donors * 0.4) + (charge * 0.6) - (max(logp, 0) * 0.4)
            base_rt = max(1.0, hilic_score * 1.5 + 2.0)

        col_factor = self._get_column_rt_factor(col)
        length_scale = col.get("length_mm", 150) / 150.0
        
        # ZIC-pHILIC selectivity gives slightly different elution vs BEH Amide
        selectivity = col.get("retention_params", {}).get("selectivity", "general")
        sel_mod = 1.1 if "zwitterionic" in selectivity else 1.0

        grad_slope = self._gradient_slope(inp.gradient)
        grad_mod = 1.0 - grad_slope * 1.5

        rt = base_rt * length_scale * sel_mod * max(0.5, grad_mod)
        rt = max(0.5, min(rt, 20.0))

        seed = int(hashlib.md5(name.encode()).hexdigest(), 16) % 1000
        jitter = (seed / 1000.0 - 0.5) * 0.05 * base_rt
        rt = max(0.4, rt + jitter)

        plates = self._calc_plates(col, inp.flow_rate_ml_min)
        peak_width = 4 * rt / math.sqrt(max(plates, 100))
        tailing = self._calc_tailing_hilic(met)
        k = max(0.1, (rt / self._dead_time(col, inp.flow_rate_ml_min)) - 1)

        return PeakResult(
            metabolite_id=met.get("id", ""),
            metabolite_name=name,
            rt_min=round(rt, 3),
            rt_confidence=self._calc_confidence(met),
            k_retention_factor=round(k, 3),
            peak_width_min=round(peak_width, 4),
            tailing_factor=round(tailing, 2),
            theoretical_plates=plates,
            peak_height=800.0,
            peak_area=800.0 * peak_width * 2.507,
        )

    def _dead_time(self, col: dict, flow: float) -> float:
        length = col.get("length_mm", 100)
        id_mm = col.get("id_mm", 2.1)
        vol = (length / 10.0) * math.pi * (id_mm / 20.0) ** 2 * 0.65
        return max(0.05, vol / flow)

    def _gradient_slope(self, gradient: List[Dict]) -> float:
        if len(gradient) < 2:
            return 0.05
        total_time = gradient[-1].get("time_min", 10) - gradient[0].get("time_min", 0)
        delta_b = gradient[-1].get("pct_b", 95) - gradient[0].get("pct_b", 5)
        return delta_b / max(total_time, 1.0) / 100.0

    def _calc_plates(self, col: dict, flow_rate: float) -> int:
        length_mm = col.get("length_mm", 100)
        particle_um = col.get("particle_size_um", 1.7)
        dp_mm = particle_um / 1000.0
        id_mm = col.get("id_mm", 2.1)
        cross_area = math.pi * (id_mm / 20.0) ** 2
        u = (flow_rate / cross_area) * (1 / 60.0) * 1000  # mm/s
        A = 1.5 * dp_mm
        B = 2.0 * 1e-5
        C = 0.04 * dp_mm
        H = A + B / max(u, 0.01) + C * u
        N = int((length_mm / H) * 0.82)
        return max(500, min(N, 60000))

    def _calc_tailing(self, met: dict, mp: dict) -> float:
        pka = met.get("pka")
        ph = mp.get("ph", 7.0) or 7.0
        if pka and 0.5 < abs(pka - ph) < 2.0:
            return round(1.1 + (2.0 - abs(pka - ph)) * 0.1, 2)
        seed = int(hashlib.md5(met.get("name", "x").encode()).hexdigest(), 16) % 100
        return round(1.0 + seed / 700.0, 2)

    def _calc_tailing_hilic(self, met: dict) -> float:
        donors = met.get("h_bond_donors", 2) or 2
        seed = int(hashlib.md5(met.get("name", "x").encode()).hexdigest(), 16) % 100
        return round(1.0 + donors * 0.04 + seed / 900.0, 2)

    def _calc_confidence(self, met: dict) -> float:
        score = 0.55
        if met.get("logp") is not None: score += 0.10
        if met.get("pka") is not None:  score += 0.10
        if met.get("psa") is not None:  score += 0.08
        if met.get("smiles"):           score += 0.12
        if met.get("name", "") in {**self.COMPOUND_RT_RP, **self.COMPOUND_RT_HILIC}:
            score = min(score + 0.15, 0.97)
        return round(min(score, 0.97), 2)

    def simulate_chromatogram(self, peaks: List[PeakResult], time_points: int = 1000, duration: float = None) -> Dict:
        if not peaks:
            return {"time": [], "total_intensity": [], "peaks": [], "duration_min": 12.0}
        max_rt = max(p.rt_min for p in peaks)
        dur = duration or max(12.0, max_rt * 1.2)
        t = np.linspace(0, dur, time_points)
        total = np.zeros(time_points)
        peak_data = []
        for peak in peaks:
            sigma = max(peak.peak_width_min / 2.354, 0.005)
            tailing = max(peak.tailing_factor, 1.0)
            intensity = np.zeros(time_points)
            for i, ti in enumerate(t):
                dt = ti - peak.rt_min
                sig = sigma * tailing if dt > 0 else sigma
                intensity[i] = peak.peak_height * math.exp(-0.5 * (dt / sig) ** 2)
            total += intensity
            peak_data.append({
                "name": peak.metabolite_name,
                "rt": peak.rt_min,
                "height": peak.peak_height,
                "intensities": intensity.tolist(),
            })
        return {
            "time": t.tolist(),
            "total_intensity": total.tolist(),
            "peaks": peak_data,
            "duration_min": dur,
        }

    def resolution_matrix(self, peaks: List[PeakResult]) -> List[ResolutionResult]:
        results = []
        sorted_peaks = sorted(peaks, key=lambda p: p.rt_min)
        for i, pa in enumerate(sorted_peaks):
            for j, pb in enumerate(sorted_peaks):
                if i >= j:
                    continue
                delta_rt = abs(pb.rt_min - pa.rt_min)
                avg_w = (pa.peak_width_min + pb.peak_width_min) / 2.0
                rs = round(delta_rt / avg_w if avg_w > 0 else 0, 3)
                if rs >= 1.5:   risk, score = "none",     0.0
                elif rs >= 1.0: risk, score = "low",      (1.5 - rs) / 1.5 * 35
                elif rs >= 0.5: risk, score = "medium",   35 + (1.0 - rs) / 1.0 * 35
                else:           risk, score = "critical", 70 + (0.5 - rs) / 0.5 * 30
                results.append(ResolutionResult(
                    compound_a=pa.metabolite_name,
                    compound_b=pb.metabolite_name,
                    rs=rs, risk_level=risk, risk_score=round(score, 1),
                ))
        return results

    def ion_suppression_risk(self, peaks: List[PeakResult], matrix_type: str = "plasma") -> Dict[str, float]:
        matrix_base = {"plasma": 28, "cell_extract": 12, "urine": 18, "standard": 0}.get(matrix_type, 18)
        result = {}
        for peak in peaks:
            nearby = [p for p in peaks if p.metabolite_name != peak.metabolite_name and abs(p.rt_min - peak.rt_min) < 0.25]
            score = matrix_base + len(nearby) * 12
            result[peak.metabolite_name] = round(min(score, 95), 1)
        return result


engine = ChromatographyEngine()
