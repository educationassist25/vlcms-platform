"use client";
import { useState } from "react";
import { api, type Metabolite, type Column, type MobilePhase, type GradientPoint } from "../lib/api";
import MetabolitePanel from "./MetabolitePanel";
import GradientTable from "./GradientTable";
import MobilePhaseSelector from "./MobilePhaseSelector";

interface Props { metabolites: Metabolite[]; columns: Column[]; mobilePhases: MobilePhase[]; peakColors: string[]; }

interface ColumnRec { chemistry: string; mode: string; score: number; best_for: string[]; avoid_for: string[]; buffer_recommendation: string; ph_range: [number,number]; optimal_flow_ml_min: number; optimal_temp_c: number; recommended_gradient: GradientPoint[]; scientific_reasoning: string; }
interface MLGradient { gradient: GradientPoint[]; total_score: number; predicted_resolution: number; peak_capacity: number; run_time_min: number; n_coelutions_critical: number; optimization_notes: string; }
interface BufferResult { recommended_buffer: string; ph_recommendation: string; ms_compatible: boolean; solvent_a_composition: string; solvent_b_recommendation: string; buffer_concentration_mm: number; all_buffers_ranked: {name: string; score: number; best_for: string[]}[]; optimization_suggestions: string[]; gradient_adjustments: string[]; }
interface EnrichResult { name: string; formula: string; exact_mass: number; logp?: number; psa?: number; bio_class: string; pathways: string[]; hmdb_id?: string; source: string; }

function Card({ title, children, extra, color }: { title: string; children: React.ReactNode; extra?: React.ReactNode; color?: string }) {
  return (
    <div style={{ background:"var(--bg-card)", border:`1px solid ${color ? color+"40" : "var(--border)"}`, borderRadius:10, overflow:"hidden", marginBottom:12 }}>
      <div style={{ padding:"9px 14px", borderBottom:`1px solid ${color ? color+"30" : "var(--border)"}`, background: color ? color+"08" : "transparent", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:11, fontWeight:700, color: color || "var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.07em" }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding:12 }}>{children}</div>
    </div>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${score*100}%`, height:"100%", background: color, borderRadius:3 }} />
      </div>
      <span style={{ fontSize:11, fontFamily:"monospace", color, fontWeight:600, minWidth:36 }}>{(score*100).toFixed(0)}%</span>
    </div>
  );
}

// ── Column Selector ─────────────────────────────────────────────────────────
function ColumnSelectorPanel({ metabolites, peakColors }: { metabolites: Metabolite[]; peakColors: string[] }) {
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [modePreference, setModePreference] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState<ColumnRec[]>([]);

  const recommend = async () => {
    if (!selectedMets.length) return;
    setLoading(true); setRecs([]);
    try {
      const res = await api.post<{ recommendations: ColumnRec[] }>("/ml/column-select", { metabolite_ids: selectedMets, mode_preference: modePreference });
      setRecs(res.recommendations);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const modeColor: Record<string,string> = { RP:"var(--accent)", HILIC:"var(--blue)", NP:"var(--amber)" };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"310px 1fr", gap:14 }}>
      <div>
        <MetabolitePanel metabolites={metabolites} selectedIds={selectedMets} onChange={setSelectedMets} peakColors={peakColors} maxHeight={240} />
        <Card title="Mode Preference">
          <select value={modePreference} onChange={e => setModePreference(e.target.value)} style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"7px 10px", borderRadius:6, fontSize:12 }}>
            <option value="auto">Auto-detect (recommended)</option>
            <option value="RP">Reverse Phase (RP)</option>
            <option value="HILIC">HILIC</option>
            <option value="NP">Normal Phase (NP)</option>
          </select>
        </Card>
        <button onClick={recommend} disabled={loading || !selectedMets.length} style={{ width:"100%", padding:"10px 0", background: loading ? "var(--border)" : "linear-gradient(135deg, #00d4a4, #00b890)", color:"#0f1117", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "⏳ Analyzing…" : `🧬 Recommend Column (${selectedMets.length} analytes)`}
        </button>
      </div>
      <div>
        {recs.length === 0 ? (
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, padding:50, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🧬</div>
            <p style={{ color:"var(--text-secondary)", fontSize:13 }}>Select analytes → click <strong style={{ color:"var(--accent)" }}>Recommend Column</strong></p>
            <p style={{ color:"var(--text-muted)", fontSize:12, marginTop:4 }}>ML engine scores all 9 column chemistries for your analyte panel</p>
          </div>
        ) : recs.map((rec, i) => (
          <Card key={i} title={`${i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`} ${rec.chemistry} — ${rec.mode} Mode`} color={i===0 ? "var(--accent)" : undefined}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>ML Match Score</div>
                  <ScoreBar score={rec.score} color={i===0 ? "var(--accent)" : "var(--blue)"} />
                </div>
                <p style={{ fontSize:11, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:8 }}>{rec.scientific_reasoning}</p>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {[{ label: rec.mode, color: modeColor[rec.mode]||"var(--text-muted)" },
                    { label:`${rec.optimal_flow_ml_min} mL/min`, color:"var(--text-muted)" },
                    { label:`${rec.optimal_temp_c}°C`, color:"var(--text-muted)" },
                    { label:`pH ${rec.ph_range[0]}–${rec.ph_range[1]}`, color:"var(--text-muted)" },
                  ].map(b => <span key={b.label} style={{ fontSize:10, padding:"2px 8px", borderRadius:4, background: b.color+"20", color: b.color }}>{b.label}</span>)}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:3 }}>Recommended Buffer</div>
                <div style={{ fontSize:12, color:"var(--text-primary)", fontWeight:500, marginBottom:8 }}>{rec.buffer_recommendation}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>Best for</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {rec.best_for.slice(0,4).map(b => <span key={b} style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:"var(--accent-dim)", color:"var(--accent)" }}>{b}</span>)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Gradient + Buffer Optimizer ───────────────────────────────────────────────
function GradientBufferPanel({ metabolites, mobilePhases, peakColors }: { metabolites: Metabolite[]; mobilePhases: MobilePhase[]; peakColors: string[] }) {
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [chemistry, setChemistry] = useState("C18");
  const [mpId, setMpId] = useState(mobilePhases[0]?.id || "");
  const [maxTime, setMaxTime] = useState(15);
  const [ionMode, setIonMode] = useState("negative");
  const [flowRate, setFlowRate] = useState(0.4);
  const [gradLoading, setGradLoading] = useState(false);
  const [bufLoading, setBufLoading] = useState(false);
  const [gradients, setGradients] = useState<MLGradient[]>([]);
  const [bufferResult, setBufferResult] = useState<BufferResult | null>(null);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);
  const [appliedGrad, setAppliedGrad] = useState<GradientPoint[]>([]);

  const CHEMISTRIES = ["C18","C8","Phenyl","C18-T3","CSH-C18","Amide-HILIC","ZIC-HILIC","NH2-HILIC","Silica"];
  const scoreColor = (s: number) => s > 0.6 ? "var(--green)" : s > 0.4 ? "var(--amber)" : "var(--red)";

  const optimizeGradient = async () => {
    if (!selectedMets.length) return;
    setGradLoading(true); setGradients([]); setAppliedIdx(null);
    try {
      const res = await api.post<{ optimized_gradients: MLGradient[] }>("/ml/gradient-optimize", {
        metabolite_ids: selectedMets, column_chemistry: chemistry, mobile_phase_id: mpId, max_time_min: maxTime, ion_mode: ionMode,
      });
      setGradients(res.optimized_gradients || []);
    } catch (e) { console.error(e); }
    finally { setGradLoading(false); }
  };

  const optimizeBuffer = async () => {
    if (!selectedMets.length) return;
    setBufLoading(true); setBufferResult(null);
    try {
      const grad = appliedGrad.length ? appliedGrad : [{ time_min:0, pct_b:5 }, { time_min: maxTime, pct_b:95 }];
      const res = await api.post<BufferResult>("/ml/buffer-optimize", {
        metabolite_ids: selectedMets, column_chemistry: chemistry, ion_mode: ionMode, gradient: grad,
      });
      setBufferResult(res);
    } catch (e) { console.error(e); }
    finally { setBufLoading(false); }
  };

  const applyGradient = (g: MLGradient, idx: number) => {
    setAppliedIdx(idx);
    setAppliedGrad(g.gradient);
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"310px 1fr", gap:14 }}>
      {/* Left controls */}
      <div>
        <MetabolitePanel metabolites={metabolites} selectedIds={selectedMets} onChange={setSelectedMets} peakColors={peakColors} maxHeight={200} />

        <Card title="Column & Conditions">
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:3 }}>Column Chemistry</label>
              <select value={chemistry} onChange={e => setChemistry(e.target.value)} style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"6px 8px", borderRadius:6, fontSize:12 }}>
                {CHEMISTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:3 }}>Ion Mode</label>
              <select value={ionMode} onChange={e => setIonMode(e.target.value)} style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"6px 8px", borderRadius:6, fontSize:12 }}>
                <option value="negative">Negative (−)</option>
                <option value="positive">Positive (+)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:3 }}>Max run time: <strong style={{ color:"var(--accent)" }}>{maxTime} min</strong></label>
              <input type="range" min={5} max={30} step={1} value={maxTime} onChange={e => setMaxTime(+e.target.value)} style={{ width:"100%" }} />
            </div>
          </div>
        </Card>

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <button onClick={optimizeGradient} disabled={gradLoading || !selectedMets.length} style={{
            padding:"10px 0", background: gradLoading ? "var(--border)" : "linear-gradient(135deg, #4d9fff, #0077ff)",
            color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor: gradLoading ? "not-allowed" : "pointer",
          }}>{gradLoading ? "⏳ ML Optimizing…" : "🤖 Optimize Gradient (ML)"}</button>
          <button onClick={optimizeBuffer} disabled={bufLoading || !selectedMets.length} style={{
            padding:"10px 0", background: bufLoading ? "var(--border)" : "linear-gradient(135deg, #ffb347, #ff8c00)",
            color:"#0f1117", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor: bufLoading ? "not-allowed" : "pointer",
          }}>{bufLoading ? "⏳ Optimizing…" : "⚗️ Optimize Buffer System"}</button>
        </div>
      </div>

      {/* Right results */}
      <div>
        {/* Gradient results */}
        {gradients.length > 0 && (
          <Card title={`ML Gradient Recommendations — ${chemistry}`} color="var(--blue)">
            <p style={{ fontSize:11, color:"var(--text-muted)", marginBottom:10 }}>LSS-QSRR Genetic Optimization · {gradients.length} candidates evaluated</p>
            {gradients.map((g, i) => (
              <div key={i} style={{
                padding:"12px 14px", borderRadius:8, marginBottom:12,
                background: appliedIdx===i ? "var(--blue-dim)" : "var(--bg-secondary)",
                border:`1px solid ${appliedIdx===i ? "var(--blue)" : "var(--border)"}`,
              }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontSize:13, fontWeight:700, color: i===0 ? "var(--blue)" : "var(--text-primary)" }}>
                    {i===0?"🥇 Best":i===1?"🥈 Alternative":"🥉 Fast"}
                  </span>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:4, fontWeight:600, background: g.n_coelutions_critical===0 ? "var(--green-dim)" : "var(--red-dim)", color: g.n_coelutions_critical===0 ? "var(--green)" : "var(--red)" }}>
                      {g.n_coelutions_critical===0 ? "✓ No co-elutions" : `⚠ ${g.n_coelutions_critical}`}
                    </span>
                    <button onClick={() => applyGradient(g, i)} style={{ fontSize:11, padding:"3px 10px", borderRadius:5, cursor:"pointer", background:"var(--blue)", border:"none", color:"#fff", fontWeight:700 }}>
                      {appliedIdx===i ? "✓ Applied" : "Apply"}
                    </button>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
                  {[
                    { label:"ML Score", value:`${(g.total_score*100).toFixed(0)}%`, color: scoreColor(g.total_score) },
                    { label:"Avg Rs", value: g.predicted_resolution.toFixed(2), color: g.predicted_resolution>1.5 ? "var(--green)" : "var(--amber)" },
                    { label:"Peak Capacity", value: g.peak_capacity.toFixed(0), color:"var(--blue)" },
                    { label:"Run Time", value:`${g.run_time_min.toFixed(1)} min`, color:"var(--text-secondary)" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:700, color: s.color, fontFamily:"monospace" }}>{s.value}</div>
                      <div style={{ fontSize:10, color:"var(--text-muted)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Instrument-style gradient table — readonly */}
                <GradientTable gradient={g.gradient} onChange={() => {}} flowRate={flowRate} onFlowRateChange={() => {}} readOnly />
              </div>
            ))}
          </Card>
        )}

        {/* Applied gradient — editable with real instrument table */}
        {appliedGrad.length > 0 && (
          <Card title="Applied Gradient — Edit & Fine-tune" color="var(--accent)">
            <p style={{ fontSize:11, color:"var(--text-muted)", marginBottom:10 }}>Edit any cell directly. A1 = aqueous, B1 = organic. Flow rate applies to all steps.</p>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", marginBottom:6, letterSpacing:"0.04em" }}>MOBILE PHASE RESERVOIRS</div>
              <MobilePhaseSelector mobilePhases={mobilePhases} selectedId={mpId} onSelect={setMpId} />
            </div>
            <GradientTable gradient={appliedGrad} onChange={setAppliedGrad} flowRate={flowRate} onFlowRateChange={setFlowRate} curve={5} onCurveChange={() => {}} />
          </Card>
        )}

        {/* Buffer results */}
        {bufferResult && (
          <Card title="AI Buffer Optimization" color="var(--amber)">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              <div style={{ padding:"10px 12px", background:"#4d9fff15", border:"1px solid #4d9fff35", borderRadius:8 }}>
                <div style={{ fontSize:9, fontWeight:700, color:"#4d9fff", marginBottom:4 }}>A1 — SOLVENT A (AQUEOUS)</div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{bufferResult.solvent_a_composition}</div>
                <div style={{ fontSize:11, color:"#4d9fff", marginTop:2 }}>{bufferResult.buffer_concentration_mm} mM · pH {bufferResult.ph_recommendation}</div>
                <div style={{ fontSize:11, color: bufferResult.ms_compatible ? "var(--green)" : "var(--red)", marginTop:4 }}>
                  {bufferResult.ms_compatible ? "✓ MS compatible" : "✗ Not MS compatible"}
                </div>
              </div>
              <div style={{ padding:"10px 12px", background:"#ffb34715", border:"1px solid #ffb34735", borderRadius:8 }}>
                <div style={{ fontSize:9, fontWeight:700, color:"#ffb347", marginBottom:4 }}>B1 — SOLVENT B (ORGANIC)</div>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{bufferResult.solvent_b_recommendation}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Pure organic</div>
              </div>
            </div>
            {bufferResult.optimization_suggestions.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.04em" }}>Buffer Optimization</div>
                {bufferResult.optimization_suggestions.map((s, i) => (
                  <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                    <span style={{ color:"var(--accent)" }}>→</span>
                    <span style={{ fontSize:12, color:"var(--text-secondary)" }}>{s}</span>
                  </div>
                ))}
              </div>
            )}
            {bufferResult.gradient_adjustments.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.04em" }}>Gradient Adjustments</div>
                {bufferResult.gradient_adjustments.map((s, i) => (
                  <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                    <span style={{ color:"var(--amber)" }}>⚡</span>
                    <span style={{ fontSize:12, color:"var(--text-secondary)" }}>{s}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.04em" }}>All Buffer Systems Ranked</div>
              {bufferResult.all_buffers_ranked.map((b, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:11, color:"var(--text-muted)", minWidth:20 }}>#{i+1}</span>
                  <span style={{ fontSize:12, color: i===0 ? "var(--amber)" : "var(--text-primary)", fontWeight: i===0 ? 600 : 400, flex:1 }}>{b.name}</span>
                  <div style={{ width:80, height:4, background:"var(--border)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ width:`${b.score*100}%`, height:"100%", background: i===0 ? "var(--amber)" : "var(--border-light)" }} />
                  </div>
                  <span style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-muted)" }}>{(b.score*100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {gradients.length === 0 && !bufferResult && (
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, padding:50, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🤖</div>
            <p style={{ color:"var(--text-secondary)", fontSize:13 }}>Select analytes and click <strong style={{ color:"var(--blue)" }}>Optimize Gradient</strong> or <strong style={{ color:"var(--amber)" }}>Optimize Buffer</strong></p>
            <p style={{ color:"var(--text-muted)", fontSize:12, marginTop:8 }}>LSS theory + QSRR models + genetic algorithms</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Library Enrichment Panel ────────────────────────────────────────────────
function EnrichmentPanel({ onImport }: { onImport: (n: number) => void }) {
  const [query, setQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [sources, setSources] = useState(["hmdb"]);
  const [results, setResults] = useState<EnrichResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  const CATS = ["TCA Cycle","Glycolysis","Amino acids","Nucleotides","Fatty acids","Neurotransmitters","Antioxidants","Bile acids","Cofactors"];
  const toggleCat = (c: string) => setSelectedCats(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);

  const search = async () => {
    setLoading(true); setResults([]); setMsg("");
    try {
      const res = await api.post<{ total: number; results: EnrichResult[] }>("/enrichment/search", { query, categories: selectedCats, sources, limit: 100 });
      setResults(res.results);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const importAll = async () => {
    setImporting(true); setMsg("");
    try {
      const res = await api.post<{ imported: number; skipped: number; total_in_db: number }>("/enrichment/import-to-session", { query, categories: selectedCats, sources, limit: 100 });
      setMsg(`✓ Imported ${res.imported} new metabolites (${res.skipped} already existed). Total in DB: ${res.total_in_db}`);
      onImport(res.imported);
    } catch (e) { console.error(e); }
    finally { setImporting(false); }
  };

  return (
    <div>
      <Card title="🔬 Metabolite Library Enrichment" color="#b48cff">
        <p style={{ fontSize:12, color:"var(--text-secondary)", marginBottom:12 }}>
          Enrich your library from <strong style={{ color:"#b48cff" }}>HMDB</strong> and <strong style={{ color:"#b48cff" }}>PubChem</strong>. Imported metabolites are available in Simulate, MRM, and Isotope tabs.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>Compound name / HMDB ID</label>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==="Enter" && search()} placeholder="e.g. glucose, dopamine, HMDB0000094…" style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"8px 10px", borderRadius:6, fontSize:12 }} />
          </div>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>Sources</label>
            <div style={{ display:"flex", gap:8 }}>
              {["hmdb","pubchem"].map(s => (
                <button key={s} onClick={() => setSources(p => p.includes(s) ? p.filter(x=>x!==s) : [...p,s])} style={{ padding:"6px 14px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600, background: sources.includes(s) ? "#b48cff20" : "var(--bg-secondary)", border:`1px solid ${sources.includes(s) ? "#b48cff60" : "var(--border)"}`, color: sources.includes(s) ? "#b48cff" : "var(--text-muted)" }}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:6 }}>Biological categories</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {CATS.map(c => (
              <button key={c} onClick={() => toggleCat(c)} style={{ padding:"3px 10px", borderRadius:20, cursor:"pointer", fontSize:11, background: selectedCats.includes(c) ? "#b48cff20" : "var(--bg-secondary)", border:`1px solid ${selectedCats.includes(c) ? "#b48cff60" : "var(--border)"}`, color: selectedCats.includes(c) ? "#b48cff" : "var(--text-secondary)" }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={search} disabled={loading} style={{ flex:1, padding:"9px 0", background: loading ? "var(--border)" : "linear-gradient(135deg, #b48cff, #7c4dff)", color:"#fff", border:"none", borderRadius:7, fontSize:12, fontWeight:700, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "⏳ Searching…" : "🔍 Search Database"}
          </button>
          {results.length > 0 && (
            <button onClick={importAll} disabled={importing} style={{ flex:1, padding:"9px 0", background: importing ? "var(--border)" : "linear-gradient(135deg, #00d4a4, #00b890)", color:"#0f1117", border:"none", borderRadius:7, fontSize:12, fontWeight:700, cursor: importing ? "not-allowed" : "pointer" }}>
              {importing ? "⏳ Importing…" : `⬇ Import ${results.length} to Platform`}
            </button>
          )}
        </div>
        {msg && <div style={{ marginTop:10, padding:"8px 12px", background:"var(--accent-dim)", border:"1px solid var(--accent)40", borderRadius:6, fontSize:12, color:"var(--accent)" }}>{msg}</div>}
      </Card>

      {results.length > 0 && (
        <Card title={`Results (${results.length})`}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"var(--bg-secondary)" }}>
                  {["Name","Formula","Exact Mass","LogP","PSA","Class","Pathways","HMDB","Source"].map(h => (
                    <th key={h} style={{ padding:"7px 10px", textAlign:"left", fontSize:10, color:"var(--text-muted)", fontWeight:700, borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                    <td style={{ padding:"6px 10px", fontWeight:600, color:"var(--accent)" }}>{r.name}</td>
                    <td style={{ padding:"6px 10px", fontFamily:"monospace", fontSize:11 }}>{r.formula}</td>
                    <td style={{ padding:"6px 10px", fontFamily:"monospace", fontSize:11 }}>{r.exact_mass?.toFixed(4)}</td>
                    <td style={{ padding:"6px 10px", fontFamily:"monospace", fontSize:11, color:(r.logp||0)>2?"var(--amber)":"var(--blue)" }}>{r.logp?.toFixed(2)??"—"}</td>
                    <td style={{ padding:"6px 10px", fontFamily:"monospace", fontSize:11 }}>{r.psa?.toFixed(1)??"—"}</td>
                    <td style={{ padding:"6px 10px", fontSize:11, color:"var(--text-secondary)" }}>{r.bio_class}</td>
                    <td style={{ padding:"6px 10px", fontSize:10, color:"var(--text-muted)" }}>{(r.pathways||[]).slice(0,2).join(", ")}</td>
                    <td style={{ padding:"6px 10px", fontSize:10, fontFamily:"monospace", color:"var(--text-muted)" }}>{r.hmdb_id||"—"}</td>
                    <td style={{ padding:"6px 10px" }}>
                      <span style={{ fontSize:10, padding:"1px 6px", borderRadius:4, background: r.source?.includes("PubChem") ? "var(--blue-dim)" : "var(--accent-dim)", color: r.source?.includes("PubChem") ? "var(--blue)" : "var(--accent)", fontWeight:600 }}>
                        {r.source?.includes("PubChem") ? "PubChem" : "HMDB"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────
export default function MLTab({ metabolites, columns, mobilePhases, peakColors }: Props) {
  const [activeTab, setActiveTab] = useState<"column"|"gradient"|"enrichment">("column");

  return (
    <div>
      <div style={{ display:"flex", gap:0, marginBottom:16, background:"var(--bg-card)", borderRadius:10, border:"1px solid var(--border)", overflow:"hidden" }}>
        {[
          { id:"column" as const, label:"🧬 Column Selection", desc:"ML column recommendation" },
          { id:"gradient" as const, label:"🤖 Gradient & Buffer", desc:"AI gradient optimization" },
          { id:"enrichment" as const, label:"🔬 Library Enrichment", desc:"HMDB + PubChem" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex:1, padding:"12px 16px", textAlign:"left", cursor:"pointer", border:"none",
            background: activeTab===tab.id ? "var(--accent-dim)" : "transparent",
            borderRight:"1px solid var(--border)",
            borderBottom: activeTab===tab.id ? "2px solid var(--accent)" : "2px solid transparent",
          }}>
            <div style={{ fontSize:13, fontWeight:600, color: activeTab===tab.id ? "var(--accent)" : "var(--text-primary)" }}>{tab.label}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{tab.desc}</div>
          </button>
        ))}
      </div>
      {activeTab==="column" && <ColumnSelectorPanel metabolites={metabolites} peakColors={peakColors} />}
      {activeTab==="gradient" && <GradientBufferPanel metabolites={metabolites} mobilePhases={mobilePhases} peakColors={peakColors} />}
      {activeTab==="enrichment" && <EnrichmentPanel onImport={() => {}} />}
    </div>
  );
}
