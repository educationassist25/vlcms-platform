"""
Co-Elution Resolution Engine
The core diagnostic + prescriptive engine of the platform.

Given a chromatographic simulation with co-eluting compounds, this engine:
1. Diagnoses WHY each pair co-elutes (similar LogP, same retention mechanism, etc.)
2. Generates ranked, specific, actionable separation strategies
3. Simulates the predicted outcome of each strategy
4. Returns a prioritized action plan a chemist can follow immediately
"""
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import math


@dataclass
class CoElutionPair:
    compound_a: str
    compound_b: str
    rt_a: float
    rt_b: float
    rs: float
    risk_level: str
    delta_rt: float


@dataclass
class SeparationStrategy:
    strategy_type: str
    title: str
    description: str
    specific_action: str
    predicted_rs_improvement: float
    confidence: str          # "high", "medium", "low"
    implementation_difficulty: str  # "easy", "moderate", "advanced"
    rank: int


class CoElutionResolver:
    """
    Diagnoses co-elution root causes and prescribes ranked, specific fixes.
    This is the central differentiator of the platform — turning a
    'problem report' (co-elution detected) into an 'action plan' (here's exactly
    how to fix it, ranked by expected impact and ease of implementation).
    """

    def diagnose_and_resolve(
        self,
        coelution_pairs: List[Dict],
        metabolites: List[Dict],
        column: Dict,
        mobile_phase: Dict,
        gradient: List[Dict],
        flow_rate: float,
        temperature: float,
    ) -> Dict:
        """
        Main entry point. Returns full diagnostic report + ranked action plan.
        """
        critical_pairs = [p for p in coelution_pairs if p["risk_level"] in ("critical", "high")]
        if not critical_pairs:
            return {
                "status": "resolved",
                "summary": "No critical co-elutions detected. Current method provides adequate separation.",
                "n_critical_pairs": 0,
                "diagnoses": [],
                "action_plan": [],
                "global_recommendations": [],
            }

        met_lookup = {m.get("name"): m for m in metabolites}
        diagnoses = []

        for pair in critical_pairs:
            met_a = met_lookup.get(pair["compound_a"], {})
            met_b = met_lookup.get(pair["compound_b"], {})
            diagnosis = self._diagnose_pair(pair, met_a, met_b, column, mobile_phase)
            strategies = self._generate_strategies(pair, met_a, met_b, column, mobile_phase, gradient, flow_rate, temperature)
            diagnoses.append({
                "pair": f"{pair['compound_a']} ↔ {pair['compound_b']}",
                "current_rs": pair["rs"],
                "risk_level": pair["risk_level"],
                "root_cause": diagnosis["root_cause"],
                "mechanism_explanation": diagnosis["explanation"],
                "similarity_factors": diagnosis["similarity_factors"],
                "strategies": [self._strategy_to_dict(s) for s in strategies],
            })

        # Build prioritized global action plan across all pairs
        action_plan = self._build_global_action_plan(diagnoses, critical_pairs, column, mobile_phase)

        # Global method-level recommendations
        global_recs = self._global_recommendations(critical_pairs, metabolites, column, mobile_phase, gradient)

        return {
            "status": "issues_detected",
            "summary": f"{len(critical_pairs)} critical co-elution pair(s) detected requiring method optimization.",
            "n_critical_pairs": len(critical_pairs),
            "diagnoses": diagnoses,
            "action_plan": action_plan,
            "global_recommendations": global_recs,
        }

    def _diagnose_pair(self, pair: Dict, met_a: Dict, met_b: Dict, column: Dict, mobile_phase: Dict) -> Dict:
        """Determine WHY two compounds co-elute."""
        logp_a = met_a.get("logp", 0) or 0
        logp_b = met_b.get("logp", 0) or 0
        psa_a = met_a.get("psa", 60) or 60
        psa_b = met_b.get("psa", 60) or 60
        pka_a = met_a.get("pka")
        pka_b = met_b.get("pka")
        class_a = met_a.get("bio_class", "")
        class_b = met_b.get("bio_class", "")
        formula_a = met_a.get("formula", "")
        formula_b = met_b.get("formula", "")

        similarity_factors = []
        delta_logp = abs(logp_a - logp_b)
        delta_psa = abs(psa_a - psa_b)

        if delta_logp < 0.3:
            similarity_factors.append(f"Nearly identical LogP ({logp_a:.2f} vs {logp_b:.2f}) — both partition similarly into the stationary phase")
        if delta_psa < 10:
            similarity_factors.append(f"Very similar polar surface area ({psa_a:.0f} vs {psa_b:.0f} Å²)")
        if class_a == class_b and class_a:
            similarity_factors.append(f"Same compound class ({class_a}) — often share core retention mechanism")
        if formula_a == formula_b:
            similarity_factors.append("Isobaric/isomeric compounds (identical molecular formula) — structural isomers are inherently hardest to separate chromatographically")
        if pka_a and pka_b and abs(pka_a - pka_b) < 0.5:
            similarity_factors.append(f"Nearly identical pKa ({pka_a:.1f} vs {pka_b:.1f}) — ionize identically across pH range")

        # Determine primary root cause
        if formula_a == formula_b:
            root_cause = "structural_isomers"
            explanation = (
                f"{pair['compound_a']} and {pair['compound_b']} are structural isomers or share an identical molecular "
                f"formula ({formula_a}). They have the same exact mass and very similar physicochemical properties, "
                f"making chromatographic separation challenging — selectivity must come from subtle differences in "
                f"3D structure, not bulk polarity."
            )
        elif delta_logp < 0.3 and delta_psa < 15:
            root_cause = "similar_hydrophobicity"
            explanation = (
                f"Both compounds have nearly identical hydrophobicity (LogP) and polarity (PSA), so they interact with "
                f"the {column.get('chemistry', 'column')} stationary phase almost identically under the current gradient, "
                f"causing them to co-migrate."
            )
        elif pka_a and pka_b and abs(pka_a - pka_b) < 0.5:
            root_cause = "similar_ionization"
            explanation = (
                f"Both compounds have very similar pKa values, meaning they carry the same ionization state at the "
                f"current mobile phase pH ({mobile_phase.get('ph', 'N/A')}). Since retention on this column is heavily "
                f"influenced by charge state, they retain almost identically."
            )
        else:
            root_cause = "gradient_compression"
            explanation = (
                f"The current gradient slope causes these two compounds to elute within the same narrow time window, "
                f"even though their underlying retention mechanisms differ somewhat. A shallower gradient or isocratic "
                f"hold near their elution region would let their intrinsic differences manifest as separation."
            )

        return {
            "root_cause": root_cause,
            "explanation": explanation,
            "similarity_factors": similarity_factors,
        }

    def _generate_strategies(
        self, pair: Dict, met_a: Dict, met_b: Dict, column: Dict,
        mobile_phase: Dict, gradient: List[Dict], flow_rate: float, temperature: float,
    ) -> List[SeparationStrategy]:
        """Generate ranked, specific separation strategies for this pair."""
        strategies = []
        rt_a, rt_b = pair["rt_a"], pair["rt_b"]
        avg_rt = (rt_a + rt_b) / 2
        run_time = gradient[-1]["time_min"] if gradient else 12
        current_mode = column.get("mode", "RP")

        logp_a = met_a.get("logp", 0) or 0
        logp_b = met_b.get("logp", 0) or 0
        pka_a = met_a.get("pka")
        pka_b = met_b.get("pka")
        formula_a = met_a.get("formula", "")
        formula_b = met_b.get("formula", "")

        # Strategy 1: Gradient slope adjustment near elution region
        slope_now = self._local_gradient_slope(gradient, avg_rt)
        if slope_now > 5:
            new_slope_factor = 0.4
            strategies.append(SeparationStrategy(
                strategy_type="gradient_shallowing",
                title="Shallow the gradient near the co-elution window",
                description=(
                    f"The current gradient changes %B at roughly {slope_now:.1f}%/min near "
                    f"t={avg_rt:.1f} min. Slowing this segment increases the time the two compounds "
                    f"spend differentially partitioning, converting their small retention difference into resolved peaks."
                ),
                specific_action=(
                    f"Insert an isocratic hold or shallow segment from {max(0,avg_rt-0.8):.1f}–{avg_rt+0.8:.1f} min "
                    f"(reduce slope to ~{slope_now*new_slope_factor:.1f}%/min in this window), then resume normal ramp rate."
                ),
                predicted_rs_improvement=0.6 + (1 - new_slope_factor) * 0.3,
                confidence="high",
                implementation_difficulty="easy",
                rank=0,
            ))

        # Strategy 2: Column chemistry switch (highest impact for isomers)
        if formula_a == formula_b:
            target_chem = "ZIC-HILIC" if current_mode == "RP" else "CSH-C18"
            strategies.append(SeparationStrategy(
                strategy_type="column_switch",
                title=f"Switch to {target_chem} for isomer resolution",
                description=(
                    "Structural isomers with identical bulk properties require a column with different selectivity "
                    "mechanism — not just different hydrophobicity. Zwitterionic HILIC phases separate isomers via "
                    "subtle hydrogen-bonding geometry differences that RP columns cannot exploit."
                ),
                specific_action=f"Re-run method on {target_chem} (150×2.1mm) with matched buffer system. Re-optimize gradient from scratch.",
                predicted_rs_improvement=1.2,
                confidence="medium",
                implementation_difficulty="moderate",
                rank=0,
            ))
        elif current_mode == "RP" and abs(logp_a - logp_b) < 0.3:
            strategies.append(SeparationStrategy(
                strategy_type="column_switch",
                title="Switch to a polar-embedded or T3-type phase",
                description=(
                    "When two compounds have nearly identical LogP, a standard C18 cannot discriminate between them. "
                    "A trifunctional polar-embedded phase (HSS T3) provides secondary polar interactions that add a "
                    "second axis of selectivity beyond hydrophobicity."
                ),
                specific_action="Switch to Waters ACQUITY HSS T3 (or equivalent polar-embedded C18) and re-run with the same mobile phase.",
                predicted_rs_improvement=0.5,
                confidence="medium",
                implementation_difficulty="moderate",
                rank=0,
            ))

        # Strategy 3: pH adjustment for ionizable compounds
        if pka_a and pka_b:
            current_ph = mobile_phase.get("ph", 7.0) or 7.0
            # Find pH that maximizes ionization difference
            target_pka = (pka_a + pka_b) / 2
            new_ph = round(target_pka - 1.5, 1) if current_mode == "RP" else round(target_pka + 1.0, 1)
            new_ph = max(2.0, min(10.0, new_ph))  # clamp to realistic LC buffer range
            if abs(new_ph - current_ph) > 0.3:
                strategies.append(SeparationStrategy(
                    strategy_type="ph_adjustment",
                    title=f"Shift mobile phase pH to {new_ph}",
                    description=(
                        f"Both compounds have pKa near {target_pka:.1f}. At the current pH ({current_ph}), they carry "
                        f"similar net charge. Moving pH away from their pKa values — toward {new_ph} — maximizes the "
                        f"difference in their degree of ionization, which directly changes retention on this {current_mode} phase."
                    ),
                    specific_action=(
                        f"Adjust Solvent A to pH {new_ph} using ammonium formate (low pH) or ammonium bicarbonate "
                        f"(high pH) buffer at 10mM concentration."
                    ),
                    predicted_rs_improvement=0.5,
                    confidence="high",
                    implementation_difficulty="easy",
                    rank=0,
                ))

        # Strategy 4: Ion-pairing reagent (for charged polar compounds)
        if current_mode == "RP" and (pka_a or pka_b) and (logp_a < 0 or logp_b < 0):
            strategies.append(SeparationStrategy(
                strategy_type="ion_pairing",
                title="Add ion-pairing reagent",
                description=(
                    "Charged polar compounds often co-elute near the column void on RP because they are not retained "
                    "by hydrophobic interactions. An ion-pairing reagent forms a neutral, more hydrophobic complex "
                    "in situ, dramatically increasing and differentiating their retention."
                ),
                specific_action="Add 5–10 mM tributylamine (negative mode) or hexafluoroisopropanol/triethylamine pair to mobile phase A.",
                predicted_rs_improvement=0.9,
                confidence="medium",
                implementation_difficulty="advanced",
                rank=0,
            ))

        # Strategy 5: Temperature optimization
        strategies.append(SeparationStrategy(
            strategy_type="temperature",
            title=f"Adjust column temperature to {temperature - 10 if temperature > 30 else temperature + 10}°C",
            description=(
                "Temperature affects the kinetics and thermodynamics of analyte-stationary phase interactions "
                "differently for each compound. Even a 10°C change can resolve subtle selectivity differences "
                "without re-developing the whole method."
            ),
            specific_action=(
                f"{'Lower' if temperature > 30 else 'Raise'} column oven to "
                f"{temperature - 10 if temperature > 30 else temperature + 10}°C; re-equilibrate for 10 column volumes before injection."
            ),
            predicted_rs_improvement=0.25,
            confidence="low",
            implementation_difficulty="easy",
            rank=0,
        ))

        # Strategy 6: Flow rate / column length increase (brute-force plate count)
        strategies.append(SeparationStrategy(
            strategy_type="efficiency",
            title="Increase column length or decrease flow rate",
            description=(
                "Resolution scales with the square root of theoretical plates. Doubling column length (or using a "
                "longer column at the same particle size) increases plate count ~2x, giving ~1.4x resolution gain "
                "for compounds whose selectivity (α) is already slightly different."
            ),
            specific_action=f"Switch to a 150mm column (if currently 100mm) or reduce flow rate from {flow_rate} to {round(flow_rate*0.7,2)} mL/min.",
            predicted_rs_improvement=0.35,
            confidence="medium",
            implementation_difficulty="easy",
            rank=0,
        ))

        # Strategy 7: Organic modifier swap (ACN ↔ MeOH)
        current_solvent_b = mobile_phase.get("solvent_b", "Acetonitrile")
        alt_solvent = "Methanol" if "aceto" in current_solvent_b.lower() else "Acetonitrile"
        strategies.append(SeparationStrategy(
            strategy_type="solvent_swap",
            title=f"Try {alt_solvent} instead of {current_solvent_b}",
            description=(
                f"{alt_solvent} has different eluotropic strength and selectivity (different hydrogen-bonding and "
                f"dipole characteristics) compared to {current_solvent_b}. This is one of the most reliable ways to "
                f"change selectivity (α) without redeveloping the entire method."
            ),
            specific_action=f"Replace Solvent B with {alt_solvent} (same buffer/additive in A); re-run identical gradient as a first test.",
            predicted_rs_improvement=0.45,
            confidence="medium",
            implementation_difficulty="easy",
            rank=0,
        ))

        # Rank by predicted improvement, weighted by confidence and ease
        confidence_weight = {"high": 1.0, "medium": 0.75, "low": 0.5}
        difficulty_weight = {"easy": 1.0, "moderate": 0.8, "advanced": 0.6}
        for s in strategies:
            s.predicted_rs_improvement = round(
                s.predicted_rs_improvement * confidence_weight[s.confidence] * difficulty_weight[s.implementation_difficulty], 3
            )

        strategies.sort(key=lambda s: s.predicted_rs_improvement, reverse=True)
        for i, s in enumerate(strategies):
            s.rank = i + 1

        return strategies[:5]  # top 5 per pair

    def _strategy_to_dict(self, s: SeparationStrategy) -> Dict:
        return {
            "rank": s.rank,
            "type": s.strategy_type,
            "title": s.title,
            "description": s.description,
            "specific_action": s.specific_action,
            "predicted_rs_improvement": s.predicted_rs_improvement,
            "confidence": s.confidence,
            "difficulty": s.implementation_difficulty,
        }

    def _local_gradient_slope(self, gradient: List[Dict], at_time: float) -> float:
        """Calculate gradient slope (%B/min) near a specific time point."""
        if len(gradient) < 2:
            return 5.0
        for i in range(len(gradient) - 1):
            t0, t1 = gradient[i]["time_min"], gradient[i + 1]["time_min"]
            if t0 <= at_time <= t1 and t1 > t0:
                return abs(gradient[i + 1]["pct_b"] - gradient[i]["pct_b"]) / (t1 - t0)
        # fallback: overall slope
        total_t = gradient[-1]["time_min"] - gradient[0]["time_min"]
        total_b = abs(gradient[-1]["pct_b"] - gradient[0]["pct_b"])
        return total_b / max(total_t, 1)

    def _build_global_action_plan(
        self, diagnoses: List[Dict], critical_pairs: List[Dict], column: Dict, mobile_phase: Dict
    ) -> List[Dict]:
        """
        Synthesize a single prioritized action plan across all co-eluting pairs.
        Groups common strategies (e.g. if 3 pairs all benefit from gradient shallowing,
        recommend that ONE change rather than 3 separate fixes).
        """
        strategy_votes: Dict[str, Dict] = {}
        for d in diagnoses:
            for s in d["strategies"][:3]:  # consider top 3 per pair
                key = s["type"]
                if key not in strategy_votes:
                    strategy_votes[key] = {
                        "type": key,
                        "title": s["title"],
                        "description": s["description"],
                        "affects_pairs": [],
                        "total_impact": 0.0,
                        "difficulty": s["difficulty"],
                        "confidence": s["confidence"],
                    }
                strategy_votes[key]["affects_pairs"].append(d["pair"])
                strategy_votes[key]["total_impact"] += s["predicted_rs_improvement"]

        plan = list(strategy_votes.values())
        plan.sort(key=lambda x: (len(x["affects_pairs"]), x["total_impact"]), reverse=True)

        for i, item in enumerate(plan):
            item["priority"] = i + 1
            item["n_pairs_resolved"] = len(item["affects_pairs"])
            item["total_impact"] = round(item["total_impact"], 2)

        return plan[:6]

    def _global_recommendations(
        self, critical_pairs: List[Dict], metabolites: List[Dict], column: Dict, mobile_phase: Dict, gradient: List[Dict]
    ) -> List[str]:
        """High-level method development recommendations."""
        recs = []
        n_critical = len(critical_pairs)
        run_time = gradient[-1]["time_min"] if gradient else 12

        if n_critical >= 3:
            recs.append(
                f"{n_critical} critical co-elutions suggest the current column/mobile phase combination may not be "
                f"optimal for this analyte panel as a whole. Consider running the ML Column Selector to find a better-suited stationary phase before fine-tuning the gradient."
            )

        avg_rt_density = n_critical / max(run_time, 1)
        if avg_rt_density > 0.3:
            recs.append(
                f"Co-elutions are densely packed across the {run_time:.0f}-minute run. Extending total run time by "
                f"30–50% with a correspondingly shallower gradient will likely resolve multiple pairs simultaneously."
            )

        bio_classes = set(m.get("bio_class", "") for m in metabolites)
        if len(bio_classes) > 3:
            recs.append(
                f"Your panel spans {len(bio_classes)} different biological classes with very different polarities. "
                f"Consider splitting into two separate injections (e.g. polar metabolites on HILIC, lipids on RP) "
                f"rather than forcing one method to resolve everything."
            )

        if column.get("mode") == "RP" and any((m.get("logp") or 0) < -2 for m in metabolites):
            recs.append(
                "Some compounds have very negative LogP and are likely poorly retained on the current RP column "
                "(eluting near the void volume). These will not benefit from gradient changes — they need a HILIC "
                "or ion-pairing approach instead."
            )

        return recs


resolver = CoElutionResolver()
