"""
Virtual LC-MS API Routers
All endpoint definitions for the platform.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json, time, datetime

from app.db.database import get_db
from app.models.models import Metabolite, Column_, MobilePhase, SavedMethod, Experiment, SimulationRun, IsotopeResult, AtomMapping, User
from app.services.chroma_engine import engine as chroma_engine, SimulationInput
from app.services.mrm_generator import generate_mrm_transitions, generate_scheduled_mrm, INSTRUMENT_PARAMS
from app.services.isotope_service import generate_isotopologues, get_atom_mapping, TRACERS
from passlib.context import CryptContext
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── AUTH ───────────────────────────────────────────────────────────────────────
router_auth = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""

@router_auth.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": f"demo-token-{user.id}", "user_id": user.id, "email": user.email, "full_name": user.full_name}

@router_auth.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        hashed_password=pwd_context.hash(req.password),
        full_name=req.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Registered successfully", "user_id": user.id}

@router_auth.get("/demo")
def demo_login(db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == "demo@vlcms.io").first()
    if not user:
        raise HTTPException(status_code=404, detail="Demo user not found")
    return {"token": f"demo-token-{user.id}", "user_id": user.id, "email": user.email, "full_name": user.full_name}


# ─── METABOLITES ─────────────────────────────────────────────────────────────────
router_metabolites = APIRouter()

@router_metabolites.get("")
def list_metabolites(
    q: Optional[str] = Query(None),
    bio_class: Optional[str] = Query(None),
    pathway: Optional[str] = Query(None),
    limit: int = Query(50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(Metabolite)
    if q:
        # Search name, synonyms, HMDB ID, KEGG ID, formula, bio_class
        search = f"%{q}%"
        from sqlalchemy import or_
        query = query.filter(
            or_(
                Metabolite.name.ilike(search),
                Metabolite.hmdb_id.ilike(search),
                Metabolite.kegg_id.ilike(search),
                Metabolite.formula.ilike(search),
                Metabolite.bio_class.ilike(search),
            )
        )
    if bio_class:
        query = query.filter(Metabolite.bio_class == bio_class)
    total = query.count()
    items = query.order_by(Metabolite.name).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [{
            "id": m.id, "name": m.name, "formula": m.formula,
            "exact_mass": m.exact_mass, "hmdb_id": m.hmdb_id, "kegg_id": m.kegg_id,
            "bio_class": m.bio_class, "logp": m.logp, "pathways": m.pathways,
            "smiles": m.smiles, "synonyms": m.synonyms,
            "carbon_count": m.carbon_count, "pka": m.pka, "psa": m.psa,
        } for m in items]
    }

@router_metabolites.get("/classes")
def get_classes(db: Session = Depends(get_db)):
    from sqlalchemy import distinct
    classes = db.query(distinct(Metabolite.bio_class)).order_by(Metabolite.bio_class).all()
    return {"classes": [c[0] for c in classes if c[0]]}

@router_metabolites.get("/pathways")
def get_pathways(db: Session = Depends(get_db)):
    mets = db.query(Metabolite.pathways).all()
    paths = set()
    for m in mets:
        if m[0]:
            for p in m[0]: paths.add(p)
    return {"pathways": sorted(list(paths))}

@router_metabolites.get("/{metabolite_id}")
def get_metabolite(metabolite_id: str, db: Session = Depends(get_db)):
    m = db.query(Metabolite).filter(Metabolite.id == metabolite_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Metabolite not found")
    return {
        "id": m.id, "name": m.name, "synonyms": m.synonyms,
        "hmdb_id": m.hmdb_id, "kegg_id": m.kegg_id, "smiles": m.smiles,
        "formula": m.formula, "exact_mass": m.exact_mass, "logp": m.logp,
        "logd": m.logd, "pka": m.pka, "psa": m.psa, "bio_class": m.bio_class,
        "pathways": m.pathways, "carbon_count": m.carbon_count,
        "rp_retention_class": m.rp_retention_class,
        "hilic_retention_class": m.hilic_retention_class,
        "functional_groups": m.functional_groups,
    }


# ─── COLUMNS ─────────────────────────────────────────────────────────────────────
router_columns = APIRouter()

@router_columns.get("")
def list_columns(mode: Optional[str] = None, vendor: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Column_)
    if mode:
        query = query.filter(Column_.mode == mode)
    if vendor:
        query = query.filter(Column_.vendor.ilike(f"%{vendor}%"))
    cols = query.all()
    return [{"id": c.id, "vendor": c.vendor, "name": c.name, "chemistry": c.chemistry,
             "mode": c.mode, "particle_size_um": c.particle_size_um, "length_mm": c.length_mm,
             "id_mm": c.id_mm, "suited_for": c.suited_for, "notes": c.notes} for c in cols]

@router_columns.get("/{col_id}")
def get_column(col_id: str, db: Session = Depends(get_db)):
    c = db.query(Column_).filter(Column_.id == col_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Column not found")
    return {"id": c.id, "vendor": c.vendor, "name": c.name, "chemistry": c.chemistry,
            "mode": c.mode, "particle_size_um": c.particle_size_um, "length_mm": c.length_mm,
            "id_mm": c.id_mm, "pore_size_angstrom": c.pore_size_angstrom,
            "max_ph": c.max_ph, "min_ph": c.min_ph, "max_temp_c": c.max_temp_c,
            "suited_for": c.suited_for, "notes": c.notes, "retention_params": c.retention_params}


# ─── MOBILE PHASES ───────────────────────────────────────────────────────────────
router_mobile_phases = APIRouter()

@router_mobile_phases.get("")
def list_mobile_phases(mode: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(MobilePhase)
    if mode:
        query = query.filter(MobilePhase.mode == mode)
    mps = query.all()
    return [{"id": mp.id, "name": mp.name, "solvent_a": mp.solvent_a, "solvent_b": mp.solvent_b,
             "additive_a": mp.additive_a, "ph": mp.ph, "ms_compatible": mp.ms_compatible,
             "mode": mp.mode, "notes": mp.notes} for mp in mps]


# ─── SIMULATION ──────────────────────────────────────────────────────────────────
router_simulate = APIRouter()

class SimulateRTRequest(BaseModel):
    metabolite_ids: List[str]
    column_id: str
    mobile_phase_id: str
    gradient: List[dict] = [{"time_min": 0, "pct_b": 5}, {"time_min": 10, "pct_b": 95}, {"time_min": 12, "pct_b": 95}]
    flow_rate_ml_min: float = 0.4
    temperature_c: float = 40.0
    ion_mode: str = "negative"
    instrument: str = "Agilent 6495D"
    include_chromatogram: bool = False
    include_mrm: bool = False

@router_simulate.post("/retention-time")
def simulate_rt(req: SimulateRTRequest, db: Session = Depends(get_db)):
    t_start = time.time()

    col = db.query(Column_).filter(Column_.id == req.column_id).first()
    mp = db.query(MobilePhase).filter(MobilePhase.id == req.mobile_phase_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    if not mp:
        raise HTTPException(status_code=404, detail="Mobile phase not found")

    col_dict = {"id": col.id, "name": col.name, "mode": col.mode, "vendor": col.vendor,
                "particle_size_um": col.particle_size_um, "length_mm": col.length_mm,
                "id_mm": col.id_mm, "retention_params": col.retention_params or {}}
    mp_dict = {"id": mp.id, "name": mp.name, "ph": mp.ph, "mode": mp.mode}

    results = []
    peaks = []
    for met_id in req.metabolite_ids:
        met = db.query(Metabolite).filter(Metabolite.id == met_id).first()
        if not met:
            continue
        met_dict = {
            "id": met.id, "name": met.name, "logp": met.logp, "logd": met.logd,
            "pka": met.pka, "psa": met.psa, "smiles": met.smiles, "formula": met.formula,
            "exact_mass": met.exact_mass, "bio_class": met.bio_class,
            "carbon_count": met.carbon_count, "h_bond_donors": met.h_bond_donors,
            "rp_retention_class": met.rp_retention_class,
            "hilic_retention_class": met.hilic_retention_class,
        }
        inp = SimulationInput(
            metabolite=met_dict, column=col_dict, mobile_phase=mp_dict,
            gradient=req.gradient, flow_rate_ml_min=req.flow_rate_ml_min,
            temperature_c=req.temperature_c, ion_mode=req.ion_mode, instrument=req.instrument,
        )
        peak = chroma_engine.predict_rt(inp)
        peaks.append(peak)
        result = {
            "metabolite_id": met.id, "metabolite_name": met.name,
            "rt_min": peak.rt_min, "rt_confidence": peak.rt_confidence,
            "k_retention_factor": peak.k_retention_factor,
            "peak_width_min": peak.peak_width_min, "tailing_factor": peak.tailing_factor,
            "theoretical_plates": peak.theoretical_plates,
        }
        if req.include_mrm:
            met_dict["id"] = met.id
            transitions = generate_mrm_transitions(met_dict, req.ion_mode, req.instrument, peak.rt_min)
            result["mrm_transitions"] = transitions
        results.append(result)

    # Resolution matrix
    resolution = []
    if len(peaks) > 1:
        rs_results = chroma_engine.resolution_matrix(peaks)
        resolution = [{"compound_a": r.compound_a, "compound_b": r.compound_b,
                       "rs": r.rs, "risk_level": r.risk_level, "risk_score": r.risk_score}
                      for r in rs_results]

    # Ion suppression
    suppression = chroma_engine.ion_suppression_risk(peaks)

    # Chromatogram
    chromatogram = None
    if req.include_chromatogram and peaks:
        chromatogram = chroma_engine.simulate_chromatogram(peaks)

    return {
        "results": results,
        "resolution_matrix": resolution,
        "ion_suppression": suppression,
        "chromatogram": chromatogram,
        "column": col_dict["name"],
        "mobile_phase": mp_dict["name"],
        "runtime_ms": round((time.time() - t_start) * 1000, 1),
    }

@router_simulate.post("/chromatogram")
def simulate_chromatogram(req: SimulateRTRequest, db: Session = Depends(get_db)):
    req.include_chromatogram = True
    return simulate_rt(req, db)

@router_simulate.post("/gradient-optimize")
def optimize_gradient(req: SimulateRTRequest, db: Session = Depends(get_db)):
    """Suggest optimized gradient programs using LSS theory."""
    gradient_candidates = [
        [{"time_min": 0, "pct_b": 2}, {"time_min": 8, "pct_b": 95}, {"time_min": 10, "pct_b": 95}],
        [{"time_min": 0, "pct_b": 5}, {"time_min": 10, "pct_b": 95}, {"time_min": 12, "pct_b": 95}],
        [{"time_min": 0, "pct_b": 5}, {"time_min": 3, "pct_b": 30}, {"time_min": 8, "pct_b": 95}, {"time_min": 10, "pct_b": 95}],
        [{"time_min": 0, "pct_b": 2}, {"time_min": 2, "pct_b": 20}, {"time_min": 6, "pct_b": 80}, {"time_min": 9, "pct_b": 95}, {"time_min": 11, "pct_b": 95}],
    ]
    suggestions = []
    for i, grad in enumerate(gradient_candidates):
        req2 = SimulateRTRequest(**req.dict())
        req2.gradient = grad
        result = simulate_rt(req2, db)
        critical = sum(1 for r in result["resolution_matrix"] if r["risk_level"] in ["critical", "high"])
        suggestions.append({
            "rank": i + 1,
            "gradient": grad,
            "n_coelutions_critical": critical,
            "n_metabolites_resolved": len(result["results"]),
            "summary": result["results"],
        })
    suggestions.sort(key=lambda x: x["n_coelutions_critical"])
    return {"optimized_gradients": suggestions}


# ─── MRM ─────────────────────────────────────────────────────────────────────────
router_mrm = APIRouter()

class MRMRequest(BaseModel):
    metabolite_ids: List[str]
    ion_mode: str = "negative"
    instrument: str = "Agilent 6495D"
    predicted_rts: Optional[dict] = None  # {metabolite_id: rt_min}
    rt_window_min: float = 1.0

@router_mrm.post("/generate")
def generate_mrm(req: MRMRequest, db: Session = Depends(get_db)):
    all_transitions = []
    for met_id in req.metabolite_ids:
        met = db.query(Metabolite).filter(Metabolite.id == met_id).first()
        if not met:
            continue
        met_dict = {"id": met.id, "name": met.name, "exact_mass": met.exact_mass,
                    "bio_class": met.bio_class, "pka": met.pka, "smiles": met.smiles,
                    "formula": met.formula, "carbon_count": met.carbon_count}
        rt = req.predicted_rts.get(met_id) if req.predicted_rts else None
        transitions = generate_mrm_transitions(met_dict, req.ion_mode, req.instrument, rt, req.rt_window_min)
        all_transitions.append({"metabolite": met.name, "transitions": transitions})
    return {
        "instrument": req.instrument,
        "ion_mode": req.ion_mode,
        "n_metabolites": len(all_transitions),
        "total_transitions": sum(len(m["transitions"]) for m in all_transitions),
        "method": all_transitions,
    }

@router_mrm.post("/scheduled")
def scheduled_mrm(req: MRMRequest, db: Session = Depends(get_db)):
    # Auto-simulate RTs if not provided so scheduled MRM has RT windows
    if not req.predicted_rts:
        cols_all  = db.query(Column_).all()
        mps_all   = db.query(MobilePhase).all()
        if cols_all and mps_all:
            from app.services.chroma_engine import engine as ce, SimulationInput
            col_dict = {"id": cols_all[0].id, "name": cols_all[0].name, "mode": cols_all[0].mode,
                        "vendor": cols_all[0].vendor, "particle_size_um": cols_all[0].particle_size_um,
                        "length_mm": cols_all[0].length_mm, "id_mm": cols_all[0].id_mm,
                        "retention_params": cols_all[0].retention_params or {}}
            mp_dict  = {"id": mps_all[0].id, "name": mps_all[0].name,
                        "ph": mps_all[0].ph, "mode": mps_all[0].mode}
            grad = [{"time_min": 0, "pct_b": 5}, {"time_min": 10, "pct_b": 95}]
            rts = {}
            for met_id in req.metabolite_ids:
                met = db.query(Metabolite).filter(Metabolite.id == met_id).first()
                if met:
                    md = {"id": met.id, "name": met.name, "logp": met.logp, "logd": met.logd,
                          "pka": met.pka, "psa": met.psa, "smiles": met.smiles, "formula": met.formula,
                          "exact_mass": met.exact_mass, "bio_class": met.bio_class,
                          "carbon_count": met.carbon_count, "h_bond_donors": met.h_bond_donors,
                          "rp_retention_class": met.rp_retention_class,
                          "hilic_retention_class": met.hilic_retention_class, "functional_groups": met.functional_groups}
                    inp = SimulationInput(md, col_dict, mp_dict, grad, 0.4, 40, req.ion_mode, req.instrument)
                    rts[met_id] = ce.predict_rt(inp).rt_min
            req = MRMRequest(metabolite_ids=req.metabolite_ids, ion_mode=req.ion_mode,
                             instrument=req.instrument, predicted_rts=rts, rt_window_min=req.rt_window_min)
    result = generate_mrm(req, db)
    scheduled = generate_scheduled_mrm([m["transitions"] for m in result["method"]])
    return scheduled

@router_mrm.get("/instruments")
def list_instruments():
    return [{"name": k, **{kk: vv for kk, vv in v.items() if kk in ["vendor", "model"]}}
            for k, v in INSTRUMENT_PARAMS.items()]


# ─── ISOTOPE ─────────────────────────────────────────────────────────────────────
router_isotope = APIRouter()

class IsotopeRequest(BaseModel):
    metabolite_ids: List[str]
    tracer: str = "13C-glucose"
    ion_mode: str = "negative"
    adduct: Optional[str] = None

@router_isotope.post("/generate-isotopologues")
def isotope_gen(req: IsotopeRequest, db: Session = Depends(get_db)):
    results = []
    for met_id in req.metabolite_ids:
        met = db.query(Metabolite).filter(Metabolite.id == met_id).first()
        if not met:
            continue
        met_dict = {"id": met.id, "name": met.name, "exact_mass": met.exact_mass,
                    "formula": met.formula, "bio_class": met.bio_class, "carbon_count": met.carbon_count}
        result = generate_isotopologues(met_dict, req.tracer, req.ion_mode, req.adduct)
        results.append(result)
    return {"tracer": req.tracer, "n_metabolites": len(results), "results": results}

@router_isotope.get("/tracers")
def list_tracers():
    return [{"key": k, **v} for k, v in TRACERS.items()]

@router_isotope.get("/atom-map/{substrate}/{product}")
def get_atom_map(substrate: str, product: str, db: Session = Depends(get_db)):
    mapping = get_atom_mapping(substrate, product, db)
    if not mapping:
        raise HTTPException(status_code=404, detail=f"No atom mapping found for {substrate} → {product}")
    return mapping


# ─── METHODS ─────────────────────────────────────────────────────────────────────
router_methods = APIRouter()

class SaveMethodRequest(BaseModel):
    name: str
    description: str = ""
    instrument: str = "Agilent 6495D"
    column_id: str
    mobile_phase_id: str
    gradient_program: list
    flow_rate_ml_min: float = 0.4
    temperature_c: float = 40.0
    ion_mode: str = "negative"

@router_methods.post("")
def save_method(req: SaveMethodRequest, db: Session = Depends(get_db)):
    demo_user = db.query(User).filter(User.email == "demo@vlcms.io").first()
    user_id = demo_user.id if demo_user else None
    method = SavedMethod(**req.dict(), user_id=user_id)
    db.add(method)
    db.commit()
    db.refresh(method)
    return {"id": method.id, "name": method.name, "message": "Method saved successfully"}

@router_methods.get("")
def list_methods(db: Session = Depends(get_db)):
    methods = db.query(SavedMethod).all()
    return [{"id": m.id, "name": m.name, "instrument": m.instrument, "ion_mode": m.ion_mode,
             "column_id": m.column_id, "created_at": str(m.created_at)} for m in methods]

@router_methods.get("/{method_id}")
def get_method(method_id: str, db: Session = Depends(get_db)):
    m = db.query(SavedMethod).filter(SavedMethod.id == method_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Method not found")
    return {"id": m.id, "name": m.name, "description": m.description,
            "instrument": m.instrument, "column_id": m.column_id,
            "mobile_phase_id": m.mobile_phase_id, "gradient_program": m.gradient_program,
            "flow_rate_ml_min": m.flow_rate_ml_min, "temperature_c": m.temperature_c,
            "ion_mode": m.ion_mode, "version": m.version}


# ─── AI COPILOT ──────────────────────────────────────────────────────────────────
router_copilot = APIRouter()

class CopilotRequest(BaseModel):
    question: str
    context: Optional[dict] = None

# Scientific knowledge base for the copilot
KNOWLEDGE_BASE = {
    "acetyl-coa": "Acetyl-CoA is poorly retained on RP columns due to its large, polar CoA moiety. Use HILIC (ZIC-pHILIC) or ion-pairing RP with tributylamine. Negative mode ESI gives [M-H]- at m/z 808.1. Monitor the pantetheine fragment at m/z 303.0 as the quantifier ion. It is unstable; use fresh extracts and keep on dry ice.",
    "citrate": "Citrate is a highly polar tricarboxylate with LogP -1.64. On RP columns it barely retains — use HILIC (ZIC-pHILIC) or an HSS T3 column at pH 3-4 with 10 mM ammonium formate. In negative mode, [M-H]- = 191.0 m/z, with quantifier transition 191→111 (loss of CO2+H2O) at CE 14 eV. Isocitrate is isobaric — ensure chromatographic separation.",
    "hilic": "HILIC (Hydrophilic Interaction Liquid Chromatography) retains polar compounds via a water-enriched stationary phase layer. Use high organic (≥85% ACN) initially, then increase aqueous for elution. ZIC-pHILIC with 5 mM ammonium acetate is the most published method for polar metabolomics. TCA metabolites, nucleotides, and amino acids are well-retained. Key consideration: require ≥2 column volumes of equilibration between runs to re-establish the water layer.",
    "ion suppression": "Ion suppression occurs when co-eluting matrix components reduce ionization efficiency. Mitigation strategies: (1) use HILIC to separate polar analytes from hydrophobic matrix; (2) extend washing step; (3) use isotopically labeled internal standards; (4) optimize sample prep (SPE, protein precipitation). Check by post-column infusion. Phospholipids (PC, PE) are major suppressors in plasma.",
    "tca": "For TCA cycle metabolomics, ZIC-pHILIC (150×2.1mm, 5µm) with 5 mM ammonium acetate is the gold standard. Citrate and isocitrate are isobaric (192.0 m/z) and require chromatographic separation — they typically resolve at 6.5 vs 7.5 min. Fumarate and malate are structural isomers that co-elute on many columns; ZIC-pHILIC resolves them well. Run in negative mode for best sensitivity of carboxylates.",
    "mrm": "MRM (Multiple Reaction Monitoring) on a QQQ selects a precursor ion (Q1), fragments it in Q2, and monitors a specific product ion (Q3). For metabolomics: (1) use the most abundant precursor ion — often [M-H]- for acids in negative mode; (2) select quantifier = most abundant, specific product; (3) select 1-2 qualifiers for ID confirmation; (4) optimize CE per compound — typically 10-25 eV for most metabolites; (5) use scheduled MRM to maximize dwell time and sensitivity.",
    "13c glucose": "13C-glucose tracing ([U-13C6]-glucose) labels carbons through glycolysis and TCA cycle. Pyruvate gets M+3 (3 labeled carbons from top half of glucose). Acetyl-CoA gets M+2 (from pyruvate dehydrogenase, losing C1 as CO2). Citrate gets M+2 (from M+2 acetyl-CoA entering TCA). After one turn: succinate/fumarate/malate get M+2. Glutamine/glutamate can get M+4 or M+5 via citrate-derived aKG. Key: always correct for natural abundance using IsoCor before interpreting MIDs.",
    "logp": "LogP (octanol-water partition coefficient) predicts RP retention: compounds with LogP > 2 are well retained on C18; LogP < 0 (like citrate, glutamate) barely retain. LogD accounts for ionization at a given pH — for carboxylic acids, LogD at pH 7 is much lower than LogP. Always consider LogD at your mobile phase pH when predicting retention on RP columns.",
    "buffer": "MS-compatible buffers for metabolomics: (1) Ammonium formate (pH 3-9, volatile, excellent) — best for both positive and negative mode; (2) Ammonium acetate (pH 4-9, volatile) — very common for HILIC; (3) Formic acid (0.1-0.5%, pH ~2.5) — positive mode RP; (4) Avoid: phosphate buffers (non-volatile, suppresses signal), TFA (strong ion pairing, suppresses negative mode). Use ≤20 mM concentration to minimize ion suppression.",
}

def _find_relevant_knowledge(question: str) -> str:
    q_lower = question.lower()
    relevant = []
    for key, text in KNOWLEDGE_BASE.items():
        if any(word in q_lower for word in key.split()):
            relevant.append(text)
    return "\n\n".join(relevant[:3]) if relevant else ""

@router_copilot.post("/ask")
async def copilot_ask(req: CopilotRequest):
    """AI Copilot — uses Anthropic API for scientific Q&A with LC-MS knowledge."""
    try:
        import aiohttp
        knowledge = _find_relevant_knowledge(req.question)
        system_prompt = f"""You are an expert LC-MS metabolomics scientist and method development specialist.
You have deep knowledge of:
- Reverse phase and HILIC chromatography
- Metabolite retention prediction (QSRR, LogP, LSS theory)
- MRM transition optimization for QQQ instruments (Agilent, SCIEX, Waters)
- Stable isotope tracing (13C, 15N, 2H) and flux analysis
- Peak shape optimization, ion suppression, and matrix effects
- TCA cycle, glycolysis, fatty acid, and amino acid metabolism

Relevant knowledge from your database:
{knowledge}

Always provide:
1. A direct, scientifically accurate answer
2. Specific column/mobile phase/CE recommendations when asked
3. Literature context when relevant (e.g., "As published in Analytical Chemistry...")
4. Practical tips for the BCM Metabolomics Core environment
Keep answers concise but complete (200-400 words). Use specific numbers and conditions."""

        payload = {
            "model": "claude-sonnet-4-6",
            "max_tokens": 1000,
            "system": system_prompt,
            "messages": [{"role": "user", "content": req.question}],
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers={"Content-Type": "application/json"},
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    answer = data["content"][0]["text"]
                    return {"answer": answer, "source": "AI Copilot (Claude)", "knowledge_used": bool(knowledge)}
                else:
                    # Fallback to local knowledge
                    knowledge = _find_relevant_knowledge(req.question)
                    if knowledge:
                        return {"answer": knowledge, "source": "Local knowledge base", "knowledge_used": True}
                    return {"answer": "I can answer questions about LC-MS metabolomics methods, column selection, MRM optimization, and stable isotope tracing. Please try a more specific question.", "source": "Fallback", "knowledge_used": False}
    except Exception as e:
        knowledge = _find_relevant_knowledge(req.question)
        if knowledge:
            return {"answer": knowledge, "source": "Local knowledge base", "knowledge_used": True}
        return {"answer": f"Copilot service unavailable. Please check API connectivity. Error: {str(e)[:100]}", "source": "Error", "knowledge_used": False}


# Export all routers
auth = type("mod", (), {"router": router_auth})()
metabolites = type("mod", (), {"router": router_metabolites})()
columns = type("mod", (), {"router": router_columns})()
mobile_phases = type("mod", (), {"router": router_mobile_phases})()
simulate = type("mod", (), {"router": router_simulate})()
mrm = type("mod", (), {"router": router_mrm})()
isotope = type("mod", (), {"router": router_isotope})()
methods = type("mod", (), {"router": router_methods})()
copilot = type("mod", (), {"router": router_copilot})()


# ─── ML COLUMN SELECTOR ──────────────────────────────────────────────────────
router_ml = APIRouter()

class ColumnSelectRequest(BaseModel):
    metabolite_ids: List[str]
    mode_preference: str = "auto"
    application: str = "general"

class GradientOptimizeMLRequest(BaseModel):
    metabolite_ids: List[str]
    column_chemistry: str = "C18"
    mobile_phase_id: Optional[str] = None
    max_time_min: float = 15.0
    ion_mode: str = "negative"

class BufferOptimizeRequest(BaseModel):
    metabolite_ids: List[str]
    column_chemistry: str = "C18"
    ion_mode: str = "negative"
    gradient: List[dict] = []

@router_ml.post("/column-select")
def ml_column_select(req: ColumnSelectRequest, db: Session = Depends(get_db)):
    from app.services.ml_optimizer import column_selector
    mets = []
    for mid in req.metabolite_ids:
        m = db.query(Metabolite).filter(Metabolite.id == mid).first()
        if m:
            mets.append({"name": m.name, "logp": m.logp, "logd": m.logd,
                         "psa": m.psa, "bio_class": m.bio_class,
                         "pathways": m.pathways or []})
    if not mets:
        raise HTTPException(status_code=400, detail="No valid metabolites found")
    recommendations = column_selector.recommend(mets, req.mode_preference, req.application)
    return {"recommendations": recommendations, "n_metabolites": len(mets)}

@router_ml.post("/gradient-optimize")
def ml_gradient_optimize(req: GradientOptimizeMLRequest, db: Session = Depends(get_db)):
    from app.services.ml_optimizer import ml_optimizer
    mets = []
    for mid in req.metabolite_ids:
        m = db.query(Metabolite).filter(Metabolite.id == mid).first()
        if m:
            mets.append({"name": m.name, "logp": m.logp, "logd": m.logd,
                         "psa": m.psa, "bio_class": m.bio_class,
                         "carbon_count": m.carbon_count})
    if not mets:
        raise HTTPException(status_code=400, detail="No valid metabolites found")
    mp = {}
    if req.mobile_phase_id:
        mp_obj = db.query(MobilePhase).filter(MobilePhase.id == req.mobile_phase_id).first()
        if mp_obj:
            mp = {"ph": mp_obj.ph, "mode": mp_obj.mode, "name": mp_obj.name}
    results = ml_optimizer.optimize(
        mets, req.column_chemistry, mp,
        {"max_time": req.max_time_min, "ion_mode": req.ion_mode}
    )
    return {
        "column_chemistry": req.column_chemistry,
        "n_metabolites": len(mets),
        "optimized_gradients": results,
        "algorithm": "LSS-QSRR Genetic Algorithm v1.0"
    }

@router_ml.post("/buffer-optimize")
def ml_buffer_optimize(req: BufferOptimizeRequest, db: Session = Depends(get_db)):
    from app.services.ml_optimizer import buffer_optimizer
    mets = []
    for mid in req.metabolite_ids:
        m = db.query(Metabolite).filter(Metabolite.id == mid).first()
        if m:
            mets.append({"name": m.name, "logp": m.logp, "pka": m.pka,
                         "psa": m.psa, "bio_class": m.bio_class})
    if not mets:
        raise HTTPException(status_code=400, detail="No valid metabolites found")
    result = buffer_optimizer.optimize_buffer(mets, req.column_chemistry, req.ion_mode, req.gradient)
    return result

@router_ml.get("/column-chemistries")
def list_column_chemistries():
    from app.services.ml_optimizer import COLUMN_INTELLIGENCE
    return [{
        "chemistry": k,
        "mode": v["mode"],
        "best_for": v["best_for"],
        "avoid_for": v["avoid_for"],
        "buffer_recommendation": v["buffer_recommendation"],
        "ph_range": v["ph_range"],
        "optimal_flow": v["optimal_flow"],
        "optimal_temp": v["optimal_temp"],
    } for k, v in COLUMN_INTELLIGENCE.items()]


# ─── ENRICHMENT ───────────────────────────────────────────────────────────────
router_enrichment = APIRouter()

class EnrichRequest(BaseModel):
    query: str = ""
    categories: List[str] = []
    sources: List[str] = ["hmdb", "pubchem"]
    limit: int = 100

@router_enrichment.post("/search")
async def enrichment_search(req: EnrichRequest):
    from app.services.enrichment_service import enrich_metabolites
    result = await enrich_metabolites(req.query, req.categories, req.sources, req.limit)
    return result

@router_enrichment.get("/categories")
def enrichment_categories():
    from app.services.enrichment_service import get_available_categories, CATEGORY_HMDB_MAP
    cats = get_available_categories()
    return {"categories": [{"name": c, "count": len(CATEGORY_HMDB_MAP.get(c, []))} for c in cats]}

@router_enrichment.post("/import-to-session")
async def import_enriched(req: EnrichRequest, db: Session = Depends(get_db)):
    """Enrich and import metabolites into the local database for simulation."""
    from app.services.enrichment_service import enrich_metabolites
    import uuid as _uuid
    enriched = await enrich_metabolites(req.query, req.categories, req.sources, req.limit)
    imported = []
    skipped = []
    for item in enriched["results"]:
        name = item.get("name", "")
        if not name:
            continue
        existing = db.query(Metabolite).filter(Metabolite.name == name).first()
        if existing:
            skipped.append(name)
            continue
        met = Metabolite(
            id=str(_uuid.uuid4()),
            name=name,
            hmdb_id=item.get("hmdb_id", ""),
            kegg_id=item.get("kegg_id", ""),
            formula=item.get("formula", ""),
            exact_mass=item.get("exact_mass", 0.0),
            logp=item.get("logp"),
            psa=item.get("psa"),
            bio_class=item.get("bio_class", "Unknown"),
            pathways=item.get("pathways", []),
            synonyms=[],
            carbon_count=item.get("formula", "").count("C") if item.get("formula") else None,
            rp_retention_class="early",
            hilic_retention_class="mid",
        )
        db.add(met)
        imported.append(name)
    db.commit()
    return {
        "imported": len(imported),
        "skipped": len(skipped),
        "imported_names": imported,
        "total_in_db": db.query(Metabolite).count(),
    }


# ─── CO-ELUTION RESOLVER ──────────────────────────────────────────────────────
router_resolver = APIRouter()

class ResolveCoElutionRequest(BaseModel):
    metabolite_ids: List[str]
    column_id: str
    mobile_phase_id: str
    gradient: List[dict]
    flow_rate_ml_min: float = 0.4
    temperature_c: float = 40.0
    ion_mode: str = "negative"

@router_resolver.post("/diagnose")
def diagnose_coelution(req: ResolveCoElutionRequest, db: Session = Depends(get_db)):
    """
    Core diagnostic endpoint: runs simulation, detects co-elutions,
    diagnoses root causes, and returns a ranked action plan.
    """
    from app.services.coelution_resolver import resolver as coelution_resolver

    col = db.query(Column_).filter(Column_.id == req.column_id).first()
    mp = db.query(MobilePhase).filter(MobilePhase.id == req.mobile_phase_id).first()
    if not col or not mp:
        raise HTTPException(status_code=404, detail="Column or mobile phase not found")

    col_dict = {"id": col.id, "name": col.name, "mode": col.mode, "vendor": col.vendor,
                "chemistry": col.chemistry, "particle_size_um": col.particle_size_um,
                "length_mm": col.length_mm, "id_mm": col.id_mm,
                "retention_params": col.retention_params or {}}
    mp_dict = {"id": mp.id, "name": mp.name, "ph": mp.ph, "mode": mp.mode,
               "solvent_a": mp.solvent_a, "solvent_b": mp.solvent_b}

    metabolites_data = []
    peaks = []
    for met_id in req.metabolite_ids:
        met = db.query(Metabolite).filter(Metabolite.id == met_id).first()
        if not met:
            continue
        met_dict = {
            "id": met.id, "name": met.name, "logp": met.logp, "logd": met.logd,
            "pka": met.pka, "psa": met.psa, "formula": met.formula,
            "exact_mass": met.exact_mass, "bio_class": met.bio_class,
            "carbon_count": met.carbon_count, "h_bond_donors": met.h_bond_donors,
            "rp_retention_class": met.rp_retention_class,
            "hilic_retention_class": met.hilic_retention_class,
        }
        metabolites_data.append(met_dict)
        inp = SimulationInput(
            metabolite=met_dict, column=col_dict, mobile_phase=mp_dict,
            gradient=req.gradient, flow_rate_ml_min=req.flow_rate_ml_min,
            temperature_c=req.temperature_c, ion_mode=req.ion_mode,
        )
        peaks.append(chroma_engine.predict_rt(inp))

    if len(peaks) < 2:
        return {"status": "resolved", "summary": "Need at least 2 metabolites to detect co-elutions.",
                "n_critical_pairs": 0, "diagnoses": [], "action_plan": [], "global_recommendations": []}

    rs_results = chroma_engine.resolution_matrix(peaks)
    rt_lookup = {p.metabolite_name: p.rt_min for p in peaks}

    coelution_pairs = [{
        "compound_a": r.compound_a, "compound_b": r.compound_b,
        "rt_a": rt_lookup.get(r.compound_a, 0), "rt_b": rt_lookup.get(r.compound_b, 0),
        "rs": r.rs, "risk_level": r.risk_level,
        "delta_rt": abs(rt_lookup.get(r.compound_a, 0) - rt_lookup.get(r.compound_b, 0)),
    } for r in rs_results]

    result = coelution_resolver.diagnose_and_resolve(
        coelution_pairs, metabolites_data, col_dict, mp_dict,
        req.gradient, req.flow_rate_ml_min, req.temperature_c,
    )
    return result
