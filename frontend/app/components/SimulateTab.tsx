"use client";
import { useState } from "react";
import { api, type Metabolite, type Column, type MobilePhase, type SimulateResult, type GradientPoint } from "../lib/api";

interface Props {
  metabolites: Metabolite[];
  columns: Column[];
  mobilePhases: MobilePhase[];
  peakColors: string[];
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Card({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function Sel({ val, onChange, opts }: { val: string; onChange: (v: string) => void; opts: { value: string; label: string }[] }) {
  return (
    <select value={val} onChange={e => onChange(e.target.value)} style={{
      background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
      padding: "6px 8px", borderRadius: 6, fontSize: 12, width: "100%", cursor: "pointer",
    }}>
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Chromatogram SVG ─────────────────────────────────────────────────────────
function ChromSVG({ result, peakColors }: { result: SimulateResult; peakColors: string[] }) {
  const W = 700, H = 220, PL = 50, PR = 16, PT = 28, PB = 36;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const maxRT = Math.max(...result.results.map(r => r.rt_min)) * 1.2 || 12;
  const nPts = 700;
  const times = Array.from({ length: nPts }, (_, i) => (i / nPts) * maxRT);
  const curves = result.results.map(peak => {
    const sigma = Math.max(peak.peak_width_min / 2.354, 0.005);
    const t = peak.tailing_factor || 1.1;
    return times.map(ti => {
      const dt = ti - peak.rt_min;
      const s = dt > 0 ? sigma * t : sigma;
      return Math.exp(-0.5 * (dt / s) ** 2);
    });
  });
  const maxI = Math.max(...times.map((_, i) => curves.reduce((s, c) => s + c[i], 0)), 0.01);
  const X = (t: number) => PL + (t / maxRT) * plotW;
  const Y = (v: number) => PT + plotH - (v / maxI) * plotH;
  const xTicks = Array.from({ length: 7 }, (_, i) => (i * maxRT) / 6);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {xTicks.map((t, i) => <line key={i} x1={X(t)} y1={PT} x2={X(t)} y2={PT + plotH} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />)}
      <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      {curves.map((curve, idx) => {
        const color = peakColors[idx % peakColors.length];
        const path = times.map((t, i) => `${i === 0 ? "M" : "L"}${X(t).toFixed(1)},${Y(curve[i]).toFixed(1)}`).join(" ");
        return (
          <g key={idx}>
            <path d={`${path} L${X(maxRT)},${Y(0)} L${X(0)},${Y(0)} Z`} fill={color} fillOpacity={0.1} />
            <path d={path} stroke={color} strokeWidth={1.5} fill="none" />
          </g>
        );
      })}
      {result.results.map((peak, idx) => {
        const color = peakColors[idx % peakColors.length];
        const x = X(peak.rt_min);
        const pMax = Math.max(...curves[idx]);
        const y = Math.max(Y(pMax) - 8, PT + 8);
        return (
          <g key={idx}>
            <line x1={x} y1={y + 4} x2={x} y2={PT + plotH} stroke={color} strokeWidth={0.5} strokeDasharray="2 2" strokeOpacity={0.5} />
            <text x={x} y={y} textAnchor="middle" fontSize={9} fill={color} fontFamily="monospace" fontWeight={600}>
              {peak.metabolite_name.length > 10 ? peak.metabolite_name.slice(0, 9) + "…" : peak.metabolite_name}
            </text>
            <text x={x} y={y + 11} textAnchor="middle" fontSize={8} fill={color} opacity={0.7}>{peak.rt_min.toFixed(2)}min</text>
          </g>
        );
      })}
      {xTicks.map((t, i) => (
        <g key={i}>
          <line x1={X(t)} y1={PT + plotH} x2={X(t)} y2={PT + plotH + 4} stroke="var(--border-light)" strokeWidth={1} />
          <text x={X(t)} y={PT + plotH + 14} textAnchor="middle" fontSize={9} fill="var(--text-muted)" fontFamily="monospace">{t.toFixed(1)}</text>
        </g>
      ))}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)">Retention Time (min)</text>
      <text x={12} y={PT + plotH / 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)" transform={`rotate(-90,12,${PT + plotH / 2})`}>Signal (a.u.)</text>
    </svg>
  );
}

// ─── Binary Gradient SVG ──────────────────────────────────────────────────────
function GradientSVG({ gradient }: { gradient: GradientPoint[] }) {
  if (gradient.length < 2) return null;
  const W = 640, H = 110, PL = 44, PR = 16, PT = 10, PB = 28;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const maxT = Math.max(...gradient.map(g => g.time_min), 1);
  const X = (t: number) => PL + (t / maxT) * plotW;
  const Ya = (pct: number) => PT + plotH - ((100 - pct) / 100) * plotH; // Solvent A = 100-pctB
  const Yb = (pct: number) => PT + plotH - (pct / 100) * plotH;        // Solvent B = pctB

  // Build path strings
  const pathB = gradient.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.time_min).toFixed(1)},${Yb(pt.pct_b).toFixed(1)}`).join(" ");
  const pathA = gradient.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.time_min).toFixed(1)},${Ya(pt.pct_b).toFixed(1)}`).join(" ");
  const fillB = `${pathB} L${X(maxT)},${PT + plotH} L${X(0)},${PT + plotH} Z`;
  const fillA = `${pathA} L${X(maxT)},${PT} L${X(0)},${PT} Z`;
  const xTicks = Array.from({ length: 6 }, (_, i) => (i * maxT) / 5);
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Grid */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PL} y1={Yb(v)} x2={W - PR} y2={Yb(v)} stroke="var(--border)" strokeWidth={0.4} strokeDasharray="3 3" />
          <text x={PL - 4} y={Yb(v) + 4} textAnchor="end" fontSize={8} fill="var(--text-muted)" fontFamily="monospace">{v}%</text>
        </g>
      ))}
      {xTicks.map((t, i) => (
        <g key={i}>
          <line x1={X(t)} y1={PT} x2={X(t)} y2={PT + plotH} stroke="var(--border)" strokeWidth={0.4} strokeDasharray="3 3" />
          <text x={X(t)} y={PT + plotH + 12} textAnchor="middle" fontSize={8} fill="var(--text-muted)" fontFamily="monospace">{t.toFixed(1)}</text>
        </g>
      ))}
      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />

      {/* Solvent A fill (blue, aqueous) */}
      <path d={fillA} fill="#378ADD" fillOpacity={0.12} />
      <path d={pathA} stroke="#378ADD" strokeWidth={1.5} fill="none" strokeDasharray="5 3" />

      {/* Solvent B fill (amber, organic) */}
      <path d={fillB} fill="#ffb347" fillOpacity={0.18} />
      <path d={pathB} stroke="#ffb347" strokeWidth={2} fill="none" />

      {/* Data points */}
      {gradient.map((pt, i) => (
        <g key={i}>
          <circle cx={X(pt.time_min)} cy={Yb(pt.pct_b)} r={3.5} fill="#ffb347" stroke="var(--bg-card)" strokeWidth={1} />
          <circle cx={X(pt.time_min)} cy={Ya(pt.pct_b)} r={3} fill="#378ADD" stroke="var(--bg-card)" strokeWidth={1} />
        </g>
      ))}

      {/* Legend */}
      <rect x={PL + 4} y={PT + 2} width={8} height={8} fill="#378ADD" fillOpacity={0.7} rx={1} />
      <text x={PL + 16} y={PT + 10} fontSize={9} fill="#378ADD" fontWeight={600}>Solvent A (aqueous)</text>
      <rect x={PL + 120} y={PT + 2} width={8} height={8} fill="#ffb347" fillOpacity={0.9} rx={1} />
      <text x={PL + 132} y={PT + 10} fontSize={9} fill="#ffb347" fontWeight={600}>Solvent B (organic)</text>

      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--text-muted)">Time (min)</text>
    </svg>
  );
}

// ─── ML Gradient Optimizer ────────────────────────────────────────────────────
function GradientOptimizer({ metabolites, columnId, mpId, onApply }: {
  metabolites: Metabolite[];
  columnId: string;
  mpId: string;
  onApply: (grad: GradientPoint[]) => void;
}) {
  const [optimizing, setOptimizing] = useState(false);
  const [suggestions, setSuggestions] = useState<{ rank: number; gradient: GradientPoint[]; n_coelutions_critical: number; label: string }[]>([]);

  const optimize = async () => {
    if (!metabolites.length || !columnId || !mpId) return;
    setOptimizing(true);
    setSuggestions([]);
    try {
      const res = await api.optimizeGradient({
        metabolite_ids: metabolites.slice(0, 8).map(m => m.id),
        column_id: columnId,
        mobile_phase_id: mpId,
        gradient: [{ time_min: 0, pct_b: 5 }, { time_min: 10, pct_b: 95 }],
        flow_rate_ml_min: 0.4,
        temperature_c: 40,
        ion_mode: "negative",
        instrument: "Agilent 6495D",
      });
      const labels = ["🥇 Best resolution", "🥈 Balanced speed/resolution", "🥉 Fastest gradient", "🔬 Step gradient"];
      setSuggestions(res.optimized_gradients.slice(0, 4).map((g, i) => ({
        rank: g.rank,
        gradient: g.gradient,
        n_coelutions_critical: g.n_coelutions_critical,
        label: labels[i] || `Option ${i + 1}`,
      })));
    } catch (e) {
      console.error(e);
    } finally { setOptimizing(false); }
  };

  return (
    <div>
      <button onClick={optimize} disabled={optimizing} style={{
        width: "100%", padding: "8px 0", marginBottom: 10,
        background: optimizing ? "var(--border)" : "linear-gradient(135deg, #b48cff, #7c4dff)",
        color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
        cursor: optimizing ? "not-allowed" : "pointer",
      }}>
        {optimizing ? "⏳ ML Optimizing…" : "🤖 Auto-Optimize Gradient (ML)"}
      </button>

      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{
              padding: "8px 10px", borderRadius: 8,
              background: i === 0 ? "var(--accent-dim)" : "var(--bg-secondary)",
              border: `1px solid ${i === 0 ? "var(--accent)50" : "var(--border)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? "var(--accent)" : "var(--text-primary)" }}>{s.label}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600,
                    background: s.n_coelutions_critical === 0 ? "var(--green-dim)" : "var(--amber-dim)",
                    color: s.n_coelutions_critical === 0 ? "var(--green)" : "var(--amber)",
                  }}>
                    {s.n_coelutions_critical === 0 ? "✓ No critical co-elutions" : `⚠ ${s.n_coelutions_critical} co-elutions`}
                  </span>
                  <button onClick={() => onApply(s.gradient)} style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4, cursor: "pointer",
                    background: "var(--accent)", border: "none", color: "#0f1117", fontWeight: 700,
                  }}>Apply</button>
                </div>
              </div>
              {/* Mini gradient preview */}
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {s.gradient.map((pt, j) => (
                  <span key={j} style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-muted)" }}>
                    {pt.time_min}min:{pt.pct_b}%B
                    {j < s.gradient.length - 1 && " →"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
const BIO_CLASSES = ["All","Organic acids","Amino acids","Nucleotides","Carbohydrates","Fatty acids","Acyl-CoAs","Cofactors","Phosphorylated sugars","Neurotransmitters","Bile acids","Eicosanoids","Vitamins","Antioxidants","Purines","Sterols","Sugar alcohols","Sphingolipids"];

const GRADIENT_PRESETS = [
  { label: "RP 10min", grad: [{time_min:0,pct_b:5},{time_min:1,pct_b:5},{time_min:8,pct_b:95},{time_min:10,pct_b:95},{time_min:10.5,pct_b:5},{time_min:12,pct_b:5}] },
  { label: "RP 20min", grad: [{time_min:0,pct_b:2},{time_min:2,pct_b:2},{time_min:16,pct_b:98},{time_min:18,pct_b:98},{time_min:18.5,pct_b:2},{time_min:20,pct_b:2}] },
  { label: "HILIC", grad: [{time_min:0,pct_b:90},{time_min:2,pct_b:90},{time_min:14,pct_b:40},{time_min:16,pct_b:40},{time_min:16.5,pct_b:90},{time_min:18,pct_b:90}] },
  { label: "Step", grad: [{time_min:0,pct_b:5},{time_min:3,pct_b:5},{time_min:3.1,pct_b:30},{time_min:6,pct_b:30},{time_min:6.1,pct_b:70},{time_min:9,pct_b:70},{time_min:9.1,pct_b:95},{time_min:11,pct_b:95},{time_min:11.5,pct_b:5},{time_min:13,pct_b:5}] },
  { label: "Lipidomics", grad: [{time_min:0,pct_b:60},{time_min:2,pct_b:80},{time_min:12,pct_b:99},{time_min:14,pct_b:99},{time_min:14.5,pct_b:60},{time_min:16,pct_b:60}] },
  { label: "Isocratic", grad: [{time_min:0,pct_b:50},{time_min:10,pct_b:50}] },
];

export default function SimulateTab({ metabolites, columns, mobilePhases, peakColors }: Props) {
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [columnId, setColumnId] = useState(columns[0]?.id || "");
  const [mpId, setMpId] = useState(mobilePhases[0]?.id || "");
  const [instrument, setInstrument] = useState("Agilent 6495D");
  const [ionMode, setIonMode] = useState("negative");
  const [flowRate, setFlowRate] = useState(0.4);
  const [temp, setTemp] = useState(40);
  const [gradient, setGradient] = useState<GradientPoint[]>(GRADIENT_PRESETS[0].grad);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [bioClass, setBioClass] = useState("All");
  const [includeMRM, setIncludeMRM] = useState(true);
  const [activeResultTab, setActiveResultTab] = useState<"chrom"|"peaks"|"mrm"|"resolution"|"suppression">("chrom");

  const currentCol = columns.find(c => c.id === columnId);
  const currentMp = mobilePhases.find(m => m.id === mpId);

  const filtered = metabolites.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) ||
      (m.hmdb_id || "").toLowerCase().includes(q) ||
      (m.formula || "").toLowerCase().includes(q) ||
      (m.synonyms || []).some(s => s.toLowerCase().includes(q));
    const matchClass = bioClass === "All" || m.bio_class === bioClass;
    return matchSearch && matchClass;
  });

  const toggle = (id: string) => setSelectedMets(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const runSim = async () => {
    if (!selectedMets.length) { setError("Select at least one metabolite."); return; }
    setRunning(true); setError(""); setResult(null);
    try {
      const res = await api.simulate({
        metabolite_ids: selectedMets, column_id: columnId, mobile_phase_id: mpId,
        gradient, flow_rate_ml_min: flowRate, temperature_c: temp,
        ion_mode: ionMode, instrument, include_chromatogram: true, include_mrm: includeMRM,
      });
      setResult(res);
      setActiveResultTab("chrom");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally { setRunning(false); }
  };

  const riskColor = (level: string) => ({ none: "#57d9a3", low: "#00d4a4", medium: "#ffb347", high: "#ff6b6b", critical: "#ff2d55" }[level] || "#888");

  const allMRMTransitions = result?.results.flatMap(r => r.mrm_transitions || []) || [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "310px 1fr", gap: 14, alignItems: "start" }}>

      {/* ══ LEFT PANEL ══ */}
      <div>
        {/* Analyte Panel */}
        <Card title={`Analyte Panel (${selectedMets.length} selected)`} extra={
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => setSelectedMets(filtered.map(m => m.id))} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)" }}>All</button>
            <button onClick={() => setSelectedMets([])} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Clear</button>
          </div>
        }>
          <input placeholder="Search name / HMDB / formula / synonym…" value={search} onChange={e => setSearch(e.target.value)} style={{
            width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
            padding: "7px 10px", borderRadius: 6, fontSize: 12, marginBottom: 6,
          }} />
          <select value={bioClass} onChange={e => setBioClass(e.target.value)} style={{
            width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
            padding: "6px 8px", borderRadius: 6, fontSize: 12, marginBottom: 8,
          }}>
            {BIO_CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map(m => {
              const checked = selectedMets.includes(m.id);
              const color = checked ? peakColors[selectedMets.indexOf(m.id) % peakColors.length] : "var(--border-light)";
              return (
                <button key={m.id} onClick={() => toggle(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
                  background: checked ? color + "18" : "transparent", border: `1px solid ${checked ? color + "50" : "transparent"}`,
                  cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: checked ? color : "var(--text-primary)", fontWeight: checked ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.formula} · {m.bio_class}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>{filtered.length}/{metabolites.length} metabolites shown</div>
        </Card>

        {/* Column */}
        <Card title="LC Column">
          <Sel val={columnId} onChange={setColumnId} opts={columns.map(c => ({ value: c.id, label: `${c.vendor} ${c.name}` }))} />
          {currentCol && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 6, fontSize: 11 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 4 }}>
                <div style={{ color: "var(--text-muted)" }}>Mode: <span style={{ color: "var(--text-primary)" }}>{currentCol.mode}</span></div>
                <div style={{ color: "var(--text-muted)" }}>Size: <span style={{ color: "var(--text-primary)" }}>{currentCol.particle_size_um}μm</span></div>
                <div style={{ color: "var(--text-muted)" }}>Dim: <span style={{ color: "var(--text-primary)" }}>{currentCol.length_mm}×{currentCol.id_mm}</span></div>
              </div>
              <div style={{ color: "var(--text-muted)" }}>Chemistry: <span style={{ color: "var(--text-primary)" }}>{currentCol.chemistry}</span></div>
              <div style={{ marginTop: 4, color: "var(--accent)", fontSize: 10 }}>✓ {(currentCol.suited_for || []).slice(0, 3).join(" · ")}</div>
            </div>
          )}
        </Card>

        {/* Mobile Phase A + B */}
        <Card title="Mobile Phase (Binary)">
          <Sel val={mpId} onChange={setMpId} opts={mobilePhases.map(m => ({ value: m.id, label: m.name }))} />
          {currentMp && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div style={{ padding: "8px 10px", background: "#378ADD18", border: "1px solid #378ADD40", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#4d9fff", marginBottom: 4, letterSpacing: "0.05em" }}>▲ SOLVENT A (Aqueous)</div>
                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{currentMp.solvent_a}</div>
                {currentMp.additive_a && currentMp.additive_a !== "None" && (
                  <div style={{ fontSize: 10, color: "#4d9fff", marginTop: 3 }}>{currentMp.additive_a}</div>
                )}
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>pH {currentMp.ph}</div>
              </div>
              <div style={{ padding: "8px 10px", background: "#ffb34718", border: "1px solid #ffb34740", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#ffb347", marginBottom: 4, letterSpacing: "0.05em" }}>▲ SOLVENT B (Organic)</div>
                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{currentMp.solvent_b}</div>
                {currentMp.additive_b && currentMp.additive_b !== "None" && (
                  <div style={{ fontSize: 10, color: "#ffb347", marginTop: 3 }}>{currentMp.additive_b}</div>
                )}
                <div style={{ fontSize: 10, color: currentMp.ms_compatible ? "var(--accent)" : "var(--red)", marginTop: 4 }}>
                  {currentMp.ms_compatible ? "✓ MS compatible" : "✗ Not MS compatible"}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Binary Gradient Program */}
        <Card title="Binary Gradient Program">
          {/* Preset buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {GRADIENT_PRESETS.map(p => (
              <button key={p.label} onClick={() => setGradient(p.grad)} style={{
                fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)",
              }}>{p.label}</button>
            ))}
          </div>

          {/* Gradient table with A and B columns */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "8px", marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "24px 60px 1fr 1fr 20px", gap: 4, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>#</span>
              <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>Time (min)</span>
              <span style={{ fontSize: 9, color: "#4d9fff", textAlign: "center", fontWeight: 700 }}>%A (Aqueous)</span>
              <span style={{ fontSize: 9, color: "#ffb347", textAlign: "center", fontWeight: 700 }}>%B (Organic)</span>
              <span />
            </div>
            {gradient.map((pt, i) => {
              const pctA = 100 - pt.pct_b;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 60px 1fr 1fr 20px", gap: 4, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>{i + 1}</span>
                  <input type="number" value={pt.time_min} step={0.5} min={0}
                    onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, time_min: +e.target.value } : p))}
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "4px 6px", borderRadius: 5, fontSize: 11, textAlign: "center", width: "100%" }} />
                  {/* %A display with bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ flex: 1, height: 14, background: "var(--bg-primary)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                      <div style={{ width: `${pctA}%`, height: "100%", background: "#378ADD", opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#4d9fff", fontFamily: "monospace", minWidth: 30, textAlign: "right" }}>{pctA}%</span>
                  </div>
                  {/* %B input with bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ flex: 1, height: 14, background: "var(--bg-primary)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                      <div style={{ width: `${pt.pct_b}%`, height: "100%", background: "#ffb347", opacity: 0.85 }} />
                    </div>
                    <input type="number" value={pt.pct_b} step={5} min={0} max={100}
                      onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, pct_b: +e.target.value } : p))}
                      style={{ background: "var(--bg-primary)", border: "1px solid #ffb34760", color: "#ffb347", padding: "3px 5px", borderRadius: 4, fontSize: 11, textAlign: "center", width: 40, fontWeight: 600 }} />
                  </div>
                  {gradient.length > 2 ? (
                    <button onClick={() => setGradient(g => g.filter((_, j) => j !== i))} style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>×</button>
                  ) : <span />}
                </div>
              );
            })}
            <button onClick={() => setGradient(g => [...g, { time_min: +(g[g.length - 1].time_min + 1).toFixed(1), pct_b: g[g.length - 1].pct_b }])} style={{
              fontSize: 10, padding: "4px 10px", borderRadius: 5, cursor: "pointer", marginTop: 4,
              background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)",
            }}>+ Add point</button>
          </div>

          {/* Live gradient chart */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "6px 4px" }}>
            <GradientSVG gradient={gradient} />
          </div>
        </Card>

        {/* ML Gradient Optimizer */}
        <Card title="🤖 ML Gradient Optimizer">
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>
            Uses LSS theory + QSRR models to find the optimal gradient for your analyte panel — minimizing co-elutions and maximizing resolution.
          </div>
          <GradientOptimizer
            metabolites={metabolites.filter(m => selectedMets.includes(m.id))}
            columnId={columnId}
            mpId={mpId}
            onApply={(grad) => setGradient(grad)}
          />
        </Card>

        {/* Instrument */}
        <Card title="Instrument">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Platform</label>
              <Sel val={instrument} onChange={setInstrument} opts={["Agilent 6495D","Agilent 6470","SCIEX 7500+","SCIEX 6500+","Waters Xevo TQ-S"].map(v => ({ value: v, label: v }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Ion Mode</label>
              <Sel val={ionMode} onChange={setIonMode} opts={[{ value: "negative", label: "Negative (−)" }, { value: "positive", label: "Positive (+)" }]} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Flow (mL/min)</label>
              <input type="number" value={flowRate} onChange={e => setFlowRate(+e.target.value)} step={0.05} min={0.1} max={1} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 8px", borderRadius: 6, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Temp (°C)</label>
              <input type="number" value={temp} onChange={e => setTemp(+e.target.value)} step={5} min={20} max={80} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 8px", borderRadius: 6, fontSize: 12 }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "6px 8px", background: includeMRM ? "var(--accent-dim)" : "var(--bg-secondary)", borderRadius: 6, border: `1px solid ${includeMRM ? "var(--accent)40" : "var(--border)"}`, cursor: "pointer" }} onClick={() => setIncludeMRM(v => !v)}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${includeMRM ? "var(--accent)" : "var(--border)"}`, background: includeMRM ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {includeMRM && <span style={{ fontSize: 10, color: "#0f1117", fontWeight: 700 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 12, color: includeMRM ? "var(--accent)" : "var(--text-secondary)", fontWeight: 600 }}>Include MRM Transitions</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Generate QQQ transitions for all analytes</div>
            </div>
          </div>
        </Card>

        <button onClick={runSim} disabled={running || !selectedMets.length} style={{
          width: "100%", padding: "12px 0",
          background: running ? "var(--border)" : "linear-gradient(135deg, #00d4a4, #00b890)",
          color: "#0f1117", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: running ? "not-allowed" : "pointer", transition: "all 0.2s",
        }}>
          {running ? "⏳ Simulating…" : `▶ Run Simulation (${selectedMets.length} analytes)`}
        </button>
        {error && <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)", padding: "8px 12px", background: "var(--red-dim)", borderRadius: 6 }}>{error}</div>}
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div>
        {!result ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 48 }}>🔬</div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
              Select metabolites and parameters,<br />then click <strong style={{ color: "var(--accent)" }}>Run Simulation</strong>
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              {metabolites.length} metabolites · {columns.length} columns · {mobilePhases.length} mobile phases
            </p>
          </div>
        ) : (
          <div>
            {/* Result tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 14, background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
              {([
                { id: "chrom", label: "📈 Chromatogram" },
                { id: "peaks", label: "📊 Peak Data" },
                { id: "mrm", label: `⚡ MRM (${allMRMTransitions.length})` },
                { id: "resolution", label: `🔍 Resolution (${result.resolution_matrix.length})` },
                { id: "suppression", label: "🧪 Ion Suppression" },
              ] as { id: typeof activeResultTab; label: string }[]).map(tab => (
                <button key={tab.id} onClick={() => setActiveResultTab(tab.id)} style={{
                  flex: 1, padding: "10px 4px", fontSize: 11, fontWeight: 600,
                  color: activeResultTab === tab.id ? "var(--accent)" : "var(--text-muted)",
                  background: activeResultTab === tab.id ? "var(--accent-dim)" : "transparent",
                  border: "none", borderRight: "1px solid var(--border)", cursor: "pointer",
                  borderBottom: activeResultTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                }}>{tab.label}</button>
              ))}
            </div>

            {/* Chromatogram tab */}
            {activeResultTab === "chrom" && (
              <Card title={`Predicted Chromatogram — ${result.column} · ${result.mobile_phase}`} extra={
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600 }}>{result.results.length} peaks</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--blue-dim)", color: "var(--blue)" }}>{result.runtime_ms}ms</span>
                </div>
              }>
                <ChromSVG result={result} peakColors={peakColors} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {result.results.map((r, i) => (
                    <div key={r.metabolite_id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: peakColors[i % peakColors.length] }} />
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {r.metabolite_name} <span style={{ fontFamily: "monospace", color: peakColors[i % peakColors.length] }}>{r.rt_min.toFixed(2)}min</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Peak data tab */}
            {activeResultTab === "peaks" && (
              <Card title="Peak Parameters">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      {["Compound","RT (min)","k","Width","Tailing","Plates","Confidence"].map(h => (
                        <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.results].sort((a, b) => a.rt_min - b.rt_min).map((r, i) => {
                      const ci = result.results.indexOf(r);
                      return (
                        <tr key={r.metabolite_id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "7px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: peakColors[ci % peakColors.length] }} />
                              <span style={{ color: peakColors[ci % peakColors.length], fontWeight: 500 }}>{r.metabolite_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>{r.rt_min.toFixed(3)}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.k_retention_factor.toFixed(2)}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.peak_width_min.toFixed(4)}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: r.tailing_factor > 1.5 ? "var(--amber)" : "var(--text-secondary)" }}>{r.tailing_factor.toFixed(2)}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.theoretical_plates.toLocaleString()}</td>
                          <td style={{ padding: "7px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ width: 50, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ width: `${r.rt_confidence * 100}%`, height: "100%", background: r.rt_confidence > 0.7 ? "var(--green)" : "var(--amber)" }} />
                              </div>
                              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-secondary)" }}>{(r.rt_confidence * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}

            {/* MRM tab */}
            {activeResultTab === "mrm" && (
              <Card title={`MRM Transitions — ${instrument} (${ionMode} mode)`} extra={
                <button onClick={() => {
                  const rows = [["Compound","Precursor m/z","Product m/z","CE (eV)","Frag V","CAV","Dwell ms","Type","RT (min)"]];
                  allMRMTransitions.forEach(t => rows.push([t.metabolite_name, String(t.precursor_mz), String(t.product_mz), String(t.collision_energy), String(t.fragmentor_voltage || ""), String(t.cell_accelerator_voltage || ""), String(t.dwell_time_ms || ""), t.transition_type, String(t.retention_time_min || "")]));
                  const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `mrm_${instrument.replace(/ /g,"_")}.csv`; a.click();
                }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, cursor: "pointer", background: "var(--blue-dim)", border: "1px solid var(--blue)40", color: "var(--blue)" }}>
                  ↓ Export CSV
                </button>
              }>
                {allMRMTransitions.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    No MRM transitions — enable "Include MRM Transitions" checkbox and re-run simulation.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-secondary)" }}>
                          {["Compound","Adduct","Precursor m/z","Product m/z","CE (eV)","Frag V","CAV","Dwell ms","Type","RT (min)"].map(h => (
                            <th key={h} style={{ padding: "7px 8px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allMRMTransitions.map((t, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)30" }}>
                            <td style={{ padding: "6px 8px", fontWeight: 500, color: "var(--text-primary)" }}>{t.metabolite_name}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)" }}>{t.adduct}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--blue)", fontWeight: 600 }}>{t.precursor_mz}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>{t.product_mz}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--amber)", fontWeight: 600 }}>{t.collision_energy}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.fragmentor_voltage || "—"}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.cell_accelerator_voltage || "—"}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.dwell_time_ms || "—"}</td>
                            <td style={{ padding: "6px 8px" }}>
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: t.is_quantifier ? "var(--accent-dim)" : "var(--blue-dim)", color: t.is_quantifier ? "var(--accent)" : "var(--blue)" }}>
                                {t.transition_type?.toUpperCase() || (t.is_quantifier ? "QUANT" : "QUAL")}
                              </span>
                            </td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.retention_time_min?.toFixed(2) || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* Resolution tab */}
            {activeResultTab === "resolution" && (
              <Card title="Co-Elution Risk Matrix">
                {result.resolution_matrix.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)" }}>Select 2+ metabolites to see resolution matrix</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {result.resolution_matrix.map((r, i) => (
                      <div key={i} style={{ padding: "8px 12px", borderRadius: 7, background: riskColor(r.risk_level) + "15", border: `1px solid ${riskColor(r.risk_level)}40` }}>
                        <div style={{ fontSize: 11, color: riskColor(r.risk_level), fontWeight: 700 }}>{r.compound_a} ↔ {r.compound_b}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Rs = <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.rs.toFixed(2)}</span> · {r.risk_level.toUpperCase()}</div>
                        <div style={{ marginTop: 4, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(r.risk_score, 100)}%`, height: "100%", background: riskColor(r.risk_level) }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Ion suppression tab */}
            {activeResultTab === "suppression" && (
              <Card title="Ion Suppression Risk (plasma matrix)">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(result.ion_suppression).map(([name, score]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 10px", background: "var(--bg-secondary)", borderRadius: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-primary)", minWidth: 160 }}>{name}</span>
                      <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${score}%`, height: "100%", background: score > 60 ? "var(--red)" : score > 30 ? "var(--amber)" : "var(--green)", borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, minWidth: 40, textAlign: "right", color: score > 60 ? "var(--red)" : score > 30 ? "var(--amber)" : "var(--green)" }}>{score}%</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 50 }}>{score > 60 ? "HIGH" : score > 30 ? "MEDIUM" : "LOW"}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
