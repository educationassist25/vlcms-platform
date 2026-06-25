const BASE = "https://vlcms-platform.onrender.com/api/v1";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body: unknown) =>
    req<T>(path, { method: "POST", body: JSON.stringify(body) }),

  // Metabolites
  metabolites: (q?: string) =>
    api.get<{ total: number; items: Metabolite[] }>(
      `/metabolites${q ? `?q=${encodeURIComponent(q)}&limit=50` : "?limit=50"}`
    ),
  metabolite: (id: string) => api.get<Metabolite>(`/metabolites/${id}`),

  // Columns & mobile phases
  columns: (mode?: string) =>
    api.get<Column[]>(`/columns${mode ? `?mode=${mode}` : ""}`),
  mobilePhases: (mode?: string) =>
    api.get<MobilePhase[]>(`/mobile-phases${mode ? `?mode=${mode}` : ""}`),

  // Simulation
  simulate: (body: SimulateRequest) =>
    api.post<SimulateResult>("/simulate/retention-time", body),
  optimizeGradient: (body: SimulateRequest) =>
    api.post<{ optimized_gradients: GradientOption[] }>("/simulate/gradient-optimize", body),

  // MRM
  generateMRM: (body: MRMRequest) =>
    api.post<MRMResult>("/mrm/generate", body),
  scheduledMRM: (body: MRMRequest) =>
    api.post<ScheduledMRM>("/mrm/scheduled", body),
  instruments: () => api.get<Instrument[]>("/mrm/instruments"),

  // Isotope
  tracers: () => api.get<Tracer[]>("/isotope/tracers"),
  isotopologues: (body: IsotopeRequest) =>
    api.post<IsotopeResult>("/isotope/generate-isotopologues", body),

  // Methods
  saveMethods: (body: SaveMethodRequest) => api.post<{ id: string }>("/methods", body),
  listMethods: () => api.get<SavedMethod[]>("/methods"),

  // Copilot
  ask: (question: string, context?: Record<string, unknown>) =>
    api.post<{ answer: string; source: string }>("/copilot/ask", { question, context }),

  // Auth
  demoLogin: () => api.get<{ token: string; user_id: string; email: string; full_name: string }>("/auth/demo"),
};

// Types
export interface Metabolite {
  id: string; name: string; formula: string; exact_mass: number;
  hmdb_id: string; kegg_id: string; bio_class: string; logp: number;
  logd?: number; pka?: number; psa?: number; pathways: string[];
  smiles?: string; synonyms?: string[]; carbon_count?: number;
  rp_retention_class?: string; hilic_retention_class?: string;
  functional_groups?: string[];
}
export interface Column {
  id: string; vendor: string; name: string; chemistry: string; mode: string;
  particle_size_um: number; length_mm: number; id_mm: number;
  suited_for: string[]; notes: string;
}
export interface MobilePhase {
  id: string; name: string; solvent_a: string; solvent_b: string;
  additive_a: string; ph: number; ms_compatible: boolean; mode: string; notes: string;
}
export interface GradientPoint { time_min: number; pct_b: number; }
export interface RTResult {
  metabolite_id: string; metabolite_name: string; rt_min: number;
  rt_confidence: number; k_retention_factor: number; peak_width_min: number;
  tailing_factor: number; theoretical_plates: number;
  mrm_transitions?: MRMTransition[];
}
export interface ResolutionPair {
  compound_a: string; compound_b: string; rs: number;
  risk_level: string; risk_score: number;
}
export interface ChromData { time: number[]; total_intensity: number[]; peaks: PeakData[]; }
export interface PeakData { name: string; rt: number; height: number; intensities: number[]; }
export interface SimulateResult {
  results: RTResult[]; resolution_matrix: ResolutionPair[];
  ion_suppression: Record<string, number>; chromatogram?: ChromData;
  column: string; mobile_phase: string; runtime_ms: number;
}
export interface SimulateRequest {
  metabolite_ids: string[]; column_id: string; mobile_phase_id: string;
  gradient: GradientPoint[]; flow_rate_ml_min: number; temperature_c: number;
  ion_mode: string; instrument: string;
  include_chromatogram?: boolean; include_mrm?: boolean;
}
export interface MRMTransition {
  metabolite_name: string; adduct: string; precursor_mz: number; product_mz: number;
  collision_energy: number; ion_mode: string; is_quantifier: boolean;
  transition_type: string; instrument: string; retention_time_min?: number;
  fragmentor_voltage?: number; cell_accelerator_voltage?: number; dwell_time_ms?: number;
}
export interface MRMRequest {
  metabolite_ids: string[]; ion_mode: string; instrument: string;
  predicted_rts?: Record<string, number>; rt_window_min: number;
}
export interface MRMResult {
  instrument: string; ion_mode: string; n_metabolites: number;
  total_transitions: number;
  method: { metabolite: string; transitions: MRMTransition[] }[];
}
export interface ScheduledMRM { method_type: string; total_transitions: number; transitions: MRMTransition[]; }
export interface Instrument { name: string; vendor: string; model: string; }
export interface Tracer { key: string; tracer_element: string; heavy_isotope: number; description: string; applications: string[]; }
export interface Isotopologue { label: string; n_labeled: number; mz: number; mid_raw: number; mid_corrected: number; intensity_relative: number; }
export interface IsotopeResult {
  results: {
    metabolite: string; tracer: string; tracer_description?: string; n_carbons_metabolite: number; n_carbons_traced?: number;
    fractional_enrichment: number; isotopologues: Isotopologue[];
    mid_raw: number[]; mid_corrected: number[]; mrm_transitions: MRMTransition[];
  }[];
}
export interface IsotopeRequest { metabolite_ids: string[]; tracer: string; ion_mode: string; }
export interface GradientOption { rank: number; gradient: GradientPoint[]; n_coelutions_critical: number; summary: RTResult[]; }
export interface SaveMethodRequest {
  name: string; description: string; instrument: string;
  column_id: string; mobile_phase_id: string; gradient_program: GradientPoint[];
  flow_rate_ml_min: number; temperature_c: number; ion_mode: string;
}
export interface SavedMethod { id: string; name: string; instrument: string; ion_mode: string; column_id: string; created_at: string; }
