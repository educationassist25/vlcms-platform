"""
Database seeder — populates metabolites, columns, and mobile phases
with real, scientifically accurate data.
"""
from app.db.database import SessionLocal
from app.models.models import Metabolite, Column_, MobilePhase, AtomMapping, User
from passlib.context import CryptContext
import logging

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


METABOLITES = [
    # TCA Cycle
    {"name": "Citrate", "hmdb_id": "HMDB0000094", "kegg_id": "C00158", "smiles": "OC(CC(O)=O)(CC(O)=O)C(O)=O",
     "formula": "C6H8O7", "exact_mass": 192.0270, "monoisotopic_mass": 192.0270, "logp": -1.64,
     "logd": -3.5, "pka": 3.13, "psa": 132.1, "carbon_count": 6, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["TCA Cycle", "Citrate Cycle"],
     "rp_retention_class": "early", "hilic_retention_class": "late",
     "functional_groups": ["carboxylate", "hydroxyl"], "synonyms": ["2-Hydroxypropane-1,2,3-tricarboxylic acid"]},

    {"name": "Isocitrate", "hmdb_id": "HMDB0000193", "kegg_id": "C00311",
     "smiles": "OC(CC(O)=O)(C(O)=O)C(C(O)=O)O", "formula": "C6H8O7",
     "exact_mass": 192.0270, "monoisotopic_mass": 192.0270, "logp": -1.64,
     "logd": -3.5, "pka": 2.93, "psa": 132.1, "carbon_count": 6, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["TCA Cycle"],
     "rp_retention_class": "early", "hilic_retention_class": "late",
     "functional_groups": ["carboxylate", "hydroxyl"]},

    {"name": "Alpha-Ketoglutarate", "hmdb_id": "HMDB0000208", "kegg_id": "C00026",
     "smiles": "OC(=O)CCC(=O)C(O)=O", "formula": "C5H6O5",
     "exact_mass": 146.0215, "monoisotopic_mass": 146.0215, "logp": -0.97,
     "logd": -2.4, "pka": 2.47, "psa": 99.4, "carbon_count": 5, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["TCA Cycle", "Glutamine metabolism"],
     "rp_retention_class": "early", "hilic_retention_class": "mid",
     "functional_groups": ["carboxylate", "keto"], "synonyms": ["2-Oxoglutarate", "α-KG"]},

    {"name": "Succinate", "hmdb_id": "HMDB0000254", "kegg_id": "C00042",
     "smiles": "OC(=O)CCC(O)=O", "formula": "C4H6O4",
     "exact_mass": 118.0266, "monoisotopic_mass": 118.0266, "logp": -0.59,
     "logd": -2.1, "pka": 4.19, "psa": 74.6, "carbon_count": 4, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["TCA Cycle"],
     "rp_retention_class": "early", "hilic_retention_class": "mid",
     "functional_groups": ["carboxylate"], "synonyms": ["Butanedioic acid"]},

    {"name": "Fumarate", "hmdb_id": "HMDB0000122", "kegg_id": "C00122",
     "smiles": "OC(=O)/C=C/C(O)=O", "formula": "C4H4O4",
     "exact_mass": 116.0110, "monoisotopic_mass": 116.0110, "logp": -0.60,
     "logd": -2.2, "pka": 3.03, "psa": 74.6, "carbon_count": 4, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["TCA Cycle"],
     "rp_retention_class": "early", "hilic_retention_class": "mid",
     "functional_groups": ["carboxylate"]},

    {"name": "Malate", "hmdb_id": "HMDB0000156", "kegg_id": "C00149",
     "smiles": "OC(CC(O)=O)C(O)=O", "formula": "C4H6O5",
     "exact_mass": 134.0215, "monoisotopic_mass": 134.0215, "logp": -1.26,
     "logd": -2.6, "pka": 3.40, "psa": 94.8, "carbon_count": 4, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["TCA Cycle", "Malate-Aspartate Shuttle"],
     "rp_retention_class": "early", "hilic_retention_class": "late",
     "functional_groups": ["carboxylate", "hydroxyl"]},

    {"name": "Oxaloacetate", "hmdb_id": "HMDB0000223", "kegg_id": "C00036",
     "smiles": "OC(=O)CC(=O)C(O)=O", "formula": "C4H4O5",
     "exact_mass": 132.0059, "monoisotopic_mass": 132.0059, "logp": -1.20,
     "logd": -2.8, "pka": 2.55, "psa": 94.8, "carbon_count": 4, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["TCA Cycle"],
     "rp_retention_class": "early", "hilic_retention_class": "late",
     "functional_groups": ["carboxylate", "keto"]},

    # Glycolysis
    {"name": "Glucose", "hmdb_id": "HMDB0000122", "kegg_id": "C00031",
     "smiles": "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O", "formula": "C6H12O6",
     "exact_mass": 180.0634, "monoisotopic_mass": 180.0634, "logp": -3.24,
     "logd": -3.24, "pka": 12.1, "psa": 110.4, "carbon_count": 6, "nitrogen_count": 0,
     "bio_class": "Carbohydrates", "pathways": ["Glycolysis", "Pentose Phosphate Pathway"],
     "rp_retention_class": "very_early", "hilic_retention_class": "late",
     "functional_groups": ["hydroxyl"], "synonyms": ["D-Glucose", "Dextrose", "Blood sugar"]},

    {"name": "Pyruvate", "hmdb_id": "HMDB0000243", "kegg_id": "C00022",
     "smiles": "CC(=O)C(O)=O", "formula": "C3H4O3",
     "exact_mass": 88.0160, "monoisotopic_mass": 88.0160, "logp": -0.37,
     "logd": -1.4, "pka": 2.49, "psa": 54.4, "carbon_count": 3, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["Glycolysis", "TCA Cycle"],
     "rp_retention_class": "very_early", "hilic_retention_class": "mid",
     "functional_groups": ["carboxylate", "keto"]},

    {"name": "Lactate", "hmdb_id": "HMDB0000190", "kegg_id": "C00186",
     "smiles": "C[C@@H](O)C(O)=O", "formula": "C3H6O3",
     "exact_mass": 90.0317, "monoisotopic_mass": 90.0317, "logp": -0.72,
     "logd": -1.6, "pka": 3.86, "psa": 57.5, "carbon_count": 3, "nitrogen_count": 0,
     "bio_class": "Organic acids", "pathways": ["Glycolysis", "Warburg effect"],
     "rp_retention_class": "very_early", "hilic_retention_class": "mid",
     "functional_groups": ["carboxylate", "hydroxyl"]},

    {"name": "Fructose-6-phosphate", "hmdb_id": "HMDB0000124", "kegg_id": "C00085",
     "smiles": "OC[C@H]1OC(O)(COP(O)(O)=O)[C@@H](O)[C@@H]1O", "formula": "C6H13O9P",
     "exact_mass": 260.0297, "monoisotopic_mass": 260.0297, "logp": -3.50,
     "logd": -5.5, "pka": 1.2, "psa": 159.3, "carbon_count": 6, "nitrogen_count": 0,
     "bio_class": "Phosphorylated sugars", "pathways": ["Glycolysis", "Pentose Phosphate Pathway"],
     "rp_retention_class": "very_early", "hilic_retention_class": "very_late",
     "functional_groups": ["phosphate", "hydroxyl"]},

    # Amino Acids
    {"name": "Glutamine", "hmdb_id": "HMDB0000641", "kegg_id": "C00064",
     "smiles": "NC(=O)CCC(N)C(O)=O", "formula": "C5H10N2O3",
     "exact_mass": 146.0691, "monoisotopic_mass": 146.0691, "logp": -3.64,
     "logd": -4.0, "pka": 2.17, "psa": 106.3, "carbon_count": 5, "nitrogen_count": 2,
     "bio_class": "Amino acids", "pathways": ["Glutamine metabolism", "TCA anaplerosis", "Nitrogen metabolism"],
     "rp_retention_class": "very_early", "hilic_retention_class": "late",
     "functional_groups": ["amine", "amide", "carboxylate"], "synonyms": ["L-Glutamine", "Gln", "Q"]},

    {"name": "Glutamate", "hmdb_id": "HMDB0000148", "kegg_id": "C00025",
     "smiles": "OC(=O)[C@@H](N)CCC(O)=O", "formula": "C5H9NO4",
     "exact_mass": 147.0532, "monoisotopic_mass": 147.0532, "logp": -3.69,
     "logd": -4.5, "pka": 2.10, "psa": 101.8, "carbon_count": 5, "nitrogen_count": 1,
     "bio_class": "Amino acids", "pathways": ["Glutamate metabolism", "TCA Cycle", "GABA synthesis"],
     "rp_retention_class": "very_early", "hilic_retention_class": "late",
     "functional_groups": ["amine", "carboxylate"], "synonyms": ["L-Glutamic acid", "Glu", "E"]},

    {"name": "Aspartate", "hmdb_id": "HMDB0000191", "kegg_id": "C00049",
     "smiles": "OC(=O)[C@@H](N)CC(O)=O", "formula": "C4H7NO4",
     "exact_mass": 133.0375, "monoisotopic_mass": 133.0375, "logp": -3.89,
     "logd": -4.7, "pka": 1.99, "psa": 101.8, "carbon_count": 4, "nitrogen_count": 1,
     "bio_class": "Amino acids", "pathways": ["Aspartate metabolism", "Urea cycle", "Purine synthesis"],
     "rp_retention_class": "very_early", "hilic_retention_class": "late",
     "functional_groups": ["amine", "carboxylate"]},

    {"name": "Alanine", "hmdb_id": "HMDB0000161", "kegg_id": "C00041",
     "smiles": "C[C@@H](N)C(O)=O", "formula": "C3H7NO2",
     "exact_mass": 89.0477, "monoisotopic_mass": 89.0477, "logp": -2.85,
     "logd": -3.4, "pka": 2.35, "psa": 63.3, "carbon_count": 3, "nitrogen_count": 1,
     "bio_class": "Amino acids", "pathways": ["Alanine metabolism", "Glycolysis"],
     "rp_retention_class": "very_early", "hilic_retention_class": "late",
     "functional_groups": ["amine", "carboxylate"]},

    {"name": "Serine", "hmdb_id": "HMDB0000187", "kegg_id": "C00065",
     "smiles": "N[C@@H](CO)C(O)=O", "formula": "C3H7NO3",
     "exact_mass": 105.0426, "monoisotopic_mass": 105.0426, "logp": -3.07,
     "logd": -3.7, "pka": 2.21, "psa": 83.6, "carbon_count": 3, "nitrogen_count": 1,
     "bio_class": "Amino acids", "pathways": ["Serine biosynthesis", "One-carbon metabolism"],
     "rp_retention_class": "very_early", "hilic_retention_class": "late",
     "functional_groups": ["amine", "carboxylate", "hydroxyl"]},

    # Nucleotides
    {"name": "ATP", "hmdb_id": "HMDB0000538", "kegg_id": "C00002",
     "smiles": "Nc1ncnc2n(cnc12)[C@@H]1O[C@H](COP(O)(=O)OP(O)(=O)OP(O)(O)=O)[C@@H](O)[C@H]1O",
     "formula": "C10H16N5O13P3", "exact_mass": 506.9957, "monoisotopic_mass": 506.9957,
     "logp": -3.6, "logd": -7.2, "pka": 1.0, "psa": 290.8, "carbon_count": 10, "nitrogen_count": 5,
     "bio_class": "Nucleotides", "pathways": ["Purine metabolism", "Energy metabolism"],
     "rp_retention_class": "very_early", "hilic_retention_class": "very_late",
     "functional_groups": ["phosphate", "adenine"]},

    {"name": "ADP", "hmdb_id": "HMDB0001341", "kegg_id": "C00008",
     "smiles": "Nc1ncnc2n(cnc12)[C@@H]1O[C@H](COP(O)(=O)OP(O)(O)=O)[C@@H](O)[C@H]1O",
     "formula": "C10H15N5O10P2", "exact_mass": 427.0294, "monoisotopic_mass": 427.0294,
     "logp": -3.2, "logd": -6.4, "pka": 1.1, "psa": 228.8, "carbon_count": 10, "nitrogen_count": 5,
     "bio_class": "Nucleotides", "pathways": ["Purine metabolism", "Energy metabolism"],
     "rp_retention_class": "very_early", "hilic_retention_class": "very_late",
     "functional_groups": ["phosphate", "adenine"]},

    {"name": "NAD+", "hmdb_id": "HMDB0000902", "kegg_id": "C00003",
     "smiles": "NC(=O)c1ccc[n+](c1)[C@@H]1O[C@H](COP([O-])(=O)OP(O)(=O)OC[C@H]2O[C@H]([C@H](O)[C@@H]2O)n2cnc3c(N)ncnc23)[C@@H](O)[C@H]1O",
     "formula": "C21H28N7O14P2", "exact_mass": 663.1091, "monoisotopic_mass": 663.1091,
     "logp": -3.5, "logd": -7.8, "pka": 0.8, "psa": 330.5, "carbon_count": 21, "nitrogen_count": 7,
     "bio_class": "Cofactors", "pathways": ["NAD metabolism", "Redox metabolism"],
     "rp_retention_class": "very_early", "hilic_retention_class": "very_late",
     "functional_groups": ["nicotinamide", "phosphate"]},

    # Acyl-CoAs
    {"name": "Acetyl-CoA", "hmdb_id": "HMDB0001206", "kegg_id": "C00024",
     "smiles": "CC(=O)SCCNC(=O)CCNC(=O)[C@@H](O)C(C)(C)COP(O)(=O)OP(O)(=O)OC[C@H]1O[C@H]([C@H](O)[C@@H]1OP(O)(O)=O)n1cnc2c(N)ncnc12",
     "formula": "C23H38N7O17P3S", "exact_mass": 809.1257, "monoisotopic_mass": 809.1257,
     "logp": -3.0, "logd": -7.5, "pka": 0.8, "psa": 370.2, "carbon_count": 23, "nitrogen_count": 7,
     "bio_class": "Acyl-CoAs", "pathways": ["TCA Cycle", "Fatty acid synthesis", "Acetylation"],
     "rp_retention_class": "mid", "hilic_retention_class": "very_late",
     "functional_groups": ["thioester", "phosphate", "CoA"]},

    # Lipids
    {"name": "Palmitic acid", "hmdb_id": "HMDB0000220", "kegg_id": "C00249",
     "smiles": "CCCCCCCCCCCCCCCC(O)=O", "formula": "C16H32O2",
     "exact_mass": 256.2402, "monoisotopic_mass": 256.2402, "logp": 7.17,
     "logd": 5.1, "pka": 4.75, "psa": 37.3, "carbon_count": 16, "nitrogen_count": 0,
     "bio_class": "Fatty acids", "pathways": ["Fatty acid metabolism", "Lipid synthesis"],
     "rp_retention_class": "very_late", "hilic_retention_class": "early",
     "functional_groups": ["carboxylate"]},

    {"name": "Oleic acid", "hmdb_id": "HMDB0000207", "kegg_id": "C00712",
     "smiles": "CCCCCCCCC=CCCCCCCCC(O)=O", "formula": "C18H34O2",
     "exact_mass": 282.2559, "monoisotopic_mass": 282.2559, "logp": 7.64,
     "logd": 5.5, "pka": 4.77, "psa": 37.3, "carbon_count": 18, "nitrogen_count": 0,
     "bio_class": "Fatty acids", "pathways": ["Fatty acid metabolism"],
     "rp_retention_class": "very_late", "hilic_retention_class": "early",
     "functional_groups": ["carboxylate"]},
]

COLUMNS = [
    # Reverse Phase
    {"vendor": "Waters", "name": "ACQUITY UPLC BEH C18", "chemistry": "C18", "mode": "RP",
     "particle_size_um": 1.7, "length_mm": 100, "id_mm": 2.1, "pore_size_angstrom": 130,
     "max_ph": 12.0, "min_ph": 1.0, "max_temp_c": 90.0, "max_pressure_bar": 1034,
     "suited_for": ["lipids", "hydrophobic metabolites", "general RP", "drugs"],
     "retention_params": {"s_factor": 0.52, "logkw_c18": 2.1, "selectivity": "general"},
     "notes": "Workhorse RP column for metabolomics. Excellent peak shape for broad range of metabolites."},

    {"vendor": "Waters", "name": "ACQUITY UPLC HSS T3", "chemistry": "C18 T3", "mode": "RP",
     "particle_size_um": 1.8, "length_mm": 100, "id_mm": 2.1, "pore_size_angstrom": 100,
     "max_ph": 8.0, "min_ph": 1.0, "max_temp_c": 60.0, "max_pressure_bar": 600,
     "suited_for": ["polar metabolites", "organic acids", "amino acids", "nucleotides"],
     "retention_params": {"s_factor": 0.48, "logkw_c18": 1.8, "selectivity": "polar_enhanced"},
     "notes": "Superior retention of polar/ionizable compounds. Trifunctional C18 phase. Gold standard for polar metabolomics."},

    {"vendor": "Waters", "name": "ACQUITY UPLC CSH C18", "chemistry": "CSH C18", "mode": "RP",
     "particle_size_um": 1.7, "length_mm": 100, "id_mm": 2.1, "pore_size_angstrom": 130,
     "max_ph": 9.0, "min_ph": 2.0, "max_temp_c": 90.0, "max_pressure_bar": 1034,
     "suited_for": ["lipidomics", "phospholipids", "sphingolipids", "triglycerides"],
     "retention_params": {"s_factor": 0.55, "logkw_c18": 2.3, "selectivity": "lipid_optimized"},
     "notes": "Charged surface hybrid. Recommended for lipidomics. Excellent for phospholipid separation."},

    {"vendor": "Phenomenex", "name": "Kinetex C18", "chemistry": "C18", "mode": "RP",
     "particle_size_um": 1.7, "length_mm": 100, "id_mm": 2.1, "pore_size_angstrom": 100,
     "max_ph": 8.0, "min_ph": 1.5, "max_temp_c": 60.0, "max_pressure_bar": 690,
     "suited_for": ["general metabolomics", "drugs", "lipids"],
     "retention_params": {"s_factor": 0.50, "logkw_c18": 2.0, "selectivity": "general"},
     "notes": "Core-shell particle technology. Excellent efficiency and peak shape."},

    {"vendor": "Phenomenex", "name": "Kinetex EVO C18", "chemistry": "EVO C18", "mode": "RP",
     "particle_size_um": 1.7, "length_mm": 150, "id_mm": 2.1, "pore_size_angstrom": 100,
     "max_ph": 11.0, "min_ph": 1.5, "max_temp_c": 60.0, "max_pressure_bar": 690,
     "suited_for": ["lipidomics", "high pH applications", "basic compounds"],
     "retention_params": {"s_factor": 0.51, "logkw_c18": 2.2, "selectivity": "lipid_optimized"},
     "notes": "High-pH stable EVO C18. Excellent for lipidomics at pH 9."},

    {"vendor": "Agilent", "name": "ZORBAX RRHD Eclipse Plus C18", "chemistry": "C18", "mode": "RP",
     "particle_size_um": 1.8, "length_mm": 100, "id_mm": 2.1, "pore_size_angstrom": 95,
     "max_ph": 9.0, "min_ph": 2.0, "max_temp_c": 60.0, "max_pressure_bar": 600,
     "suited_for": ["general metabolomics", "pharmaceuticals"],
     "retention_params": {"s_factor": 0.49, "logkw_c18": 1.9, "selectivity": "general"},
     "notes": "Reliable dual-endcapped C18. Good batch-to-batch reproducibility."},

    # HILIC Columns
    {"vendor": "Waters", "name": "ACQUITY UPLC BEH Amide", "chemistry": "Amide HILIC", "mode": "HILIC",
     "particle_size_um": 1.7, "length_mm": 150, "id_mm": 2.1, "pore_size_angstrom": 130,
     "max_ph": 9.0, "min_ph": 3.0, "max_temp_c": 60.0, "max_pressure_bar": 1034,
     "suited_for": ["polar metabolites", "sugars", "nucleotides", "phosphorylated compounds"],
     "retention_params": {"hilic_logkw": 3.2, "selectivity": "amide_polar"},
     "notes": "BEH amide HILIC. Excellent for polar metabolites not retained on RP. Complementary to C18."},

    {"vendor": "Merck", "name": "SeQuant ZIC-pHILIC", "chemistry": "Zwitterionic HILIC", "mode": "HILIC",
     "particle_size_um": 5.0, "length_mm": 150, "id_mm": 2.1, "pore_size_angstrom": 200,
     "max_ph": 8.0, "min_ph": 3.0, "max_temp_c": 60.0, "max_pressure_bar": 200,
     "suited_for": ["polar metabolites", "organic acids", "TCA metabolites", "amino acids", "nucleotides"],
     "retention_params": {"hilic_logkw": 3.5, "selectivity": "zwitterionic"},
     "notes": "ZIC-pHILIC is the gold standard for polar metabolomics HILIC. Excellent for TCA cycle metabolites. Most widely published HILIC column."},

    {"vendor": "Merck", "name": "SeQuant ZIC-HILIC", "chemistry": "Zwitterionic HILIC", "mode": "HILIC",
     "particle_size_um": 3.5, "length_mm": 150, "id_mm": 2.1, "pore_size_angstrom": 200,
     "max_ph": 8.0, "min_ph": 3.0, "max_temp_c": 60.0, "max_pressure_bar": 350,
     "suited_for": ["glycans", "phosphopeptides", "polar metabolites"],
     "retention_params": {"hilic_logkw": 3.3, "selectivity": "zwitterionic"},
     "notes": "Parent ZIC-HILIC. Phosphoproteomics and glycan enrichment. Good for untargeted polar metabolomics."},

    {"vendor": "Phenomenex", "name": "Luna NH2", "chemistry": "Amino HILIC", "mode": "HILIC",
     "particle_size_um": 3.0, "length_mm": 150, "id_mm": 2.0, "pore_size_angstrom": 100,
     "max_ph": 7.5, "min_ph": 2.0, "max_temp_c": 60.0, "max_pressure_bar": 300,
     "suited_for": ["carbohydrates", "sugars", "nucleotides"],
     "retention_params": {"hilic_logkw": 2.9, "selectivity": "amino"},
     "notes": "Amino HILIC for carbohydrates and sugars. Not recommended for aldehydes (Schiff base formation)."},
]

MOBILE_PHASES = [
    # RP Mobile Phases
    {"name": "Water + 0.1% Formic Acid", "solvent_a": "Water", "solvent_b": "Acetonitrile",
     "additive_a": "0.1% Formic Acid", "additive_b": "0.1% Formic Acid",
     "ph": 2.7, "buffer_concentration_mm": 0, "ms_compatible": True, "mode": "RP",
     "notes": "Standard positive mode RP. Good for basic compounds and lipids."},

    {"name": "Water + 10 mM Ammonium Acetate", "solvent_a": "Water", "solvent_b": "Acetonitrile",
     "additive_a": "10 mM Ammonium Acetate", "additive_b": "10 mM Ammonium Acetate",
     "ph": 6.8, "buffer_concentration_mm": 10, "ms_compatible": True, "mode": "RP",
     "notes": "Neutral pH RP. Excellent for organic acids and anionic metabolites. Most common for negative mode metabolomics."},

    {"name": "Water + 10 mM Ammonium Formate", "solvent_a": "Water", "solvent_b": "Acetonitrile",
     "additive_a": "10 mM Ammonium Formate", "additive_b": "10 mM Ammonium Formate",
     "ph": 3.0, "buffer_concentration_mm": 10, "ms_compatible": True, "mode": "RP",
     "notes": "Low pH RP buffer. Good for nucleotides and phosphorylated metabolites. MS compatible."},

    {"name": "Water + 5 mM Ammonium Formate (pH 9)", "solvent_a": "Water", "solvent_b": "Methanol",
     "additive_a": "5 mM Ammonium Formate pH 9", "additive_b": "5 mM Ammonium Formate pH 9",
     "ph": 9.0, "buffer_concentration_mm": 5, "ms_compatible": True, "mode": "RP",
     "notes": "High pH RP for lipidomics (CSH C18). Excellent for phospholipid class separation."},

    # HILIC Mobile Phases
    {"name": "HILIC: 5 mM Ammonium Acetate + ACN", "solvent_a": "Water + 5 mM Ammonium Acetate",
     "solvent_b": "Acetonitrile", "additive_a": "5 mM Ammonium Acetate",
     "additive_b": "None", "ph": 6.8, "buffer_concentration_mm": 5,
     "ms_compatible": True, "mode": "HILIC",
     "notes": "Standard HILIC mobile phase. ZIC-pHILIC gold standard combination."},

    {"name": "HILIC: 5 mM Ammonium Formate + ACN", "solvent_a": "Water + 5 mM Ammonium Formate",
     "solvent_b": "Acetonitrile", "additive_a": "5 mM Ammonium Formate",
     "additive_b": "None", "ph": 3.5, "buffer_concentration_mm": 5,
     "ms_compatible": True, "mode": "HILIC",
     "notes": "Low pH HILIC. Better for protonated species. Used with BEH Amide."},
]

ATOM_MAPPINGS = [
    {"reaction_id": "R00200", "substrate_name": "Glucose", "product_name": "Pyruvate",
     "pathway": "Glycolysis",
     "carbon_map": {"C1": "C3", "C2": "C2", "C3": "C1", "C4": "C3b", "C5": "C2b", "C6": "C1b"},
     "label_propagation": {"M+6_glucose": ["M+3_pyruvate_x2"], "M+1_C1_glucose": ["M+1_CO2"]}},

    {"reaction_id": "R00351", "substrate_name": "Pyruvate", "product_name": "Acetyl-CoA",
     "pathway": "Pyruvate Dehydrogenase",
     "carbon_map": {"C2": "C1_acetyl", "C3": "C2_acetyl", "C1": "CO2"},
     "label_propagation": {"M+3_pyruvate": ["M+2_acetyl_CoA", "M+1_CO2"]}},

    {"reaction_id": "R00351b", "substrate_name": "Acetyl-CoA", "product_name": "Citrate",
     "pathway": "TCA Cycle",
     "carbon_map": {"C1_acetyl": "C1_citrate", "C2_acetyl": "C2_citrate"},
     "label_propagation": {"M+2_acetyl_CoA": ["M+2_citrate"]}},

    {"reaction_id": "R00709", "substrate_name": "Alpha-Ketoglutarate", "product_name": "Succinate",
     "pathway": "TCA Cycle",
     "carbon_map": {"C1": "CO2", "C2": "C1_succinate", "C3": "C2_succinate",
                    "C4": "C3_succinate", "C5": "C4_succinate"},
     "label_propagation": {"M+4_aKG": ["M+3_succinate", "M+1_CO2"]}},

    {"reaction_id": "R00268", "substrate_name": "Glutamine", "product_name": "Glutamate",
     "pathway": "Glutamine metabolism",
     "carbon_map": {"C1": "C1", "C2": "C2", "C3": "C3", "C4": "C4", "C5": "C5"},
     "label_propagation": {"M+5_glutamine": ["M+5_glutamate"]}},
]


def seed_database():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Metabolite).count() > 0:
            logger.info("Database already seeded.")
            return

        logger.info("Seeding database with metabolites, columns, and mobile phases...")

        # Seed metabolites
        for m in METABOLITES:
            db.add(Metabolite(**m))

        # Seed columns
        for c in COLUMNS:
            db.add(Column_(**c))

        # Seed mobile phases
        for mp in MOBILE_PHASES:
            db.add(MobilePhase(**mp))

        # Seed atom mappings
        for am in ATOM_MAPPINGS:
            db.add(AtomMapping(**am))

        # Create demo user
        demo_user = User(
            email="demo@vlcms.io",
            hashed_password=pwd_context.hash("demo1234"),
            full_name="Demo Researcher",
            role="researcher",
        )
        db.add(demo_user)

        db.commit()
        logger.info(f"Seeded {len(METABOLITES)} metabolites, {len(COLUMNS)} columns, {len(MOBILE_PHASES)} mobile phases.")

    except Exception as e:
        logger.error(f"Seed error: {e}")
        db.rollback()
    finally:
        db.close()
