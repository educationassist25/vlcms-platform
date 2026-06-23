from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="researcher")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    experiments = relationship("Experiment", back_populates="user")
    saved_methods = relationship("SavedMethod", back_populates="user")


class Metabolite(Base):
    __tablename__ = "metabolites"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, index=True, nullable=False)
    synonyms = Column(JSON, default=list)
    hmdb_id = Column(String, index=True)
    kegg_id = Column(String)
    pubchem_id = Column(String)
    inchi = Column(Text)
    smiles = Column(Text)
    formula = Column(String)
    exact_mass = Column(Float)
    monoisotopic_mass = Column(Float)
    charge_state = Column(Integer, default=0)
    pka = Column(Float)
    logp = Column(Float)
    logd = Column(Float)
    psa = Column(Float)
    h_bond_donors = Column(Integer)
    h_bond_acceptors = Column(Integer)
    rotatable_bonds = Column(Integer)
    functional_groups = Column(JSON, default=list)
    pathways = Column(JSON, default=list)
    bio_class = Column(String)
    carbon_count = Column(Integer)
    nitrogen_count = Column(Integer)
    # Chromatographic behavior hints
    rp_retention_class = Column(String)   # early/mid/late
    hilic_retention_class = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class Column_(Base):
    __tablename__ = "columns"
    id = Column(String, primary_key=True, default=gen_uuid)
    vendor = Column(String, nullable=False)
    name = Column(String, nullable=False)
    chemistry = Column(String)            # C18, HILIC, Mixed Mode, etc.
    mode = Column(String)                 # RP, HILIC, IEX, etc.
    particle_size_um = Column(Float)
    length_mm = Column(Float)
    id_mm = Column(Float)
    pore_size_angstrom = Column(Float)
    max_ph = Column(Float)
    min_ph = Column(Float)
    max_temp_c = Column(Float)
    max_pressure_bar = Column(Float)
    suited_for = Column(JSON, default=list)   # ["polar metabolites", "lipids", etc.]
    retention_params = Column(JSON, default=dict)  # empirical parameters for RT model
    notes = Column(Text)


class MobilePhase(Base):
    __tablename__ = "mobile_phases"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    solvent_a = Column(String)
    solvent_b = Column(String)
    additive_a = Column(String)
    additive_b = Column(String)
    ph = Column(Float)
    buffer_concentration_mm = Column(Float)
    ms_compatible = Column(Boolean, default=True)
    mode = Column(String)   # RP or HILIC
    notes = Column(Text)


class SavedMethod(Base):
    __tablename__ = "saved_methods"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(Text)
    instrument = Column(String)
    column_id = Column(String, ForeignKey("columns.id"))
    mobile_phase_id = Column(String, ForeignKey("mobile_phases.id"))
    gradient_program = Column(JSON)   # [{time, pct_b}, ...]
    flow_rate_ml_min = Column(Float, default=0.4)
    temperature_c = Column(Float, default=40.0)
    injection_volume_ul = Column(Float, default=2.0)
    ion_mode = Column(String, default="negative")
    version = Column(Integer, default=1)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User", back_populates="saved_methods")


class Experiment(Base):
    __tablename__ = "experiments"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(Text)
    experiment_type = Column(String)  # targeted, untargeted, fluxomics, lipidomics
    metabolite_ids = Column(JSON, default=list)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User", back_populates="experiments")
    simulation_runs = relationship("SimulationRun", back_populates="experiment")


class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    id = Column(String, primary_key=True, default=gen_uuid)
    experiment_id = Column(String, ForeignKey("experiments.id"))
    method_id = Column(String, ForeignKey("saved_methods.id"), nullable=True)
    status = Column(String, default="pending")  # pending, running, complete, failed
    # Results
    predicted_rts = Column(JSON)          # {metabolite_id: {rt, confidence, k}}
    peak_shapes = Column(JSON)            # {metabolite_id: {width, tailing, plates}}
    resolution_matrix = Column(JSON)      # [[Rs values]]
    coelution_risks = Column(JSON)        # [{pair, Rs, risk_level}]
    ion_suppression = Column(JSON)        # {metabolite_id: risk_score}
    mrm_transitions = Column(JSON)        # [transition dicts]
    simulation_params = Column(JSON)      # snapshot of method params used
    runtime_seconds = Column(Float)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)
    experiment = relationship("Experiment", back_populates="simulation_runs")


class IsotopeResult(Base):
    __tablename__ = "isotope_results"
    id = Column(String, primary_key=True, default=gen_uuid)
    run_id = Column(String, ForeignKey("simulation_runs.id"), nullable=True)
    metabolite_id = Column(String, ForeignKey("metabolites.id"))
    tracer = Column(String)          # "13C-glucose", "13C-glutamine", "15N-glutamine"
    isotopologues = Column(JSON)     # [{label, mz, intensity_ratio}]
    mid_values = Column(JSON)        # [M+0, M+1, ..., M+n]
    nat_abund_corrected = Column(JSON)
    fractional_enrichment = Column(Float)
    mrm_transitions = Column(JSON)   # isotope-specific MRM transitions
    created_at = Column(DateTime, server_default=func.now())


class AtomMapping(Base):
    __tablename__ = "atom_mappings"
    id = Column(String, primary_key=True, default=gen_uuid)
    reaction_id = Column(String, index=True)
    substrate_id = Column(String)
    product_id = Column(String)
    substrate_name = Column(String)
    product_name = Column(String)
    pathway = Column(String)
    carbon_map = Column(JSON)       # {substrate_pos: product_pos}
    label_propagation = Column(JSON)  # how label transfers
