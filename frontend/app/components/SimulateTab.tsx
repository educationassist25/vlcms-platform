"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api, type Metabolite, type Column, type MobilePhase, type SimulateResult, type GradientPoint, type RTResult } from "../lib/api";
import CoElutionResolverPanel from "./CoElutionResolverPanel";

interface Props {
  metabolites: Metabolite[];
  columns: Column[];
  mobilePhases: MobilePhase[];
  peakColors: string[];
}

// ── Reusable UI ────────────────────────────────────────────────────────────────
function Card({ title, children, extra, accent }: { title: string; children: React.ReactNode; extra?: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: `1px solid ${accent ? accent + "40" : "var(--border)"}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "9px 14px", borderBottom: `1px solid ${accent ? accent + "30" : "var(--border)"}`, background: accent ? accent + "08" : "transparent", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: accent || "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: color + "22", color, fontWeight: 600 }}>{text}</span>;
}

// ── Chromatogram SVG ───────────────────────────────────────────────────────────
function ChromSVG({ result, peakColors }: { result: SimulateResult; peakColors: string[] }) {
  const W = 700, H = 220, PL = 50, PR = 16, PT = 28, PB = 36;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const maxRT = Math.max(...result.results.map(r => r.rt_min), 1) * 1.18;
  const nPts = 800;
  const times = Array.from({ length: nPts }, (_, i) => (i / nPts) * maxRT);

  const curves = result.results.map(peak => {
    const sigma = Math.max(peak.peak_width_min / 2.354, 0.004);
    const t = Math.max(peak.tailing_factor, 1.0);
    return times.map(ti => {
      const dt = ti - peak.rt_min;
      const s = dt > 0 ? sigma * t : sigma;
      return Math.exp(-0.5 * (dt / s) ** 2);
    });
  });

  const total = times.map((_, i) => curves.reduce((s, c) => s + c[i], 0));
  const maxI = Math.max(...total, 0.01);
  const X = (t: number) => PL + (t / maxRT) * plotW;
  const Y = (v: number) => PT + plotH - (v / maxI) * plotH;
  const xTicks = Array.from({ length: 7 }, (_, i) => (i * maxRT) / 6);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Grid */}
      {xTicks.map((t, i) => <line key={i} x1={X(t)} y1={PT} x2={X(t)} y2={PT + plotH} stroke="var(--border)" strokeWidth={0.4} strokeDasharray="3 3" />)}
      <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />

      {/* Peak fills + lines */}
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

      {/* Peak labels */}
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

      {/* X axis */}
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

// ── Gradient Profile SVG ────────────────────────────────────────────────────────
function GradientSVG({ gradient }: { gradient: GradientPoint[] }) {
  if (gradient.length < 2) return null;
  const W = 640, H = 100, PL = 44, PR = 12, PT = 8, PB = 26;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const maxT = Math.max(...gradient.map(g => g.time_min), 1);
  const X = (t: number) => PL + (t / maxT) * plotW;
  const Yb = (p: number) => PT + plotH - (p / 100) * plotH;
  const Ya = (p: number) => PT + plotH - ((100 - p) / 100) * plotH;
  const pathB = gradient.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.time_min).toFixed(1)},${Yb(pt.pct_b).toFixed(1)}`).join(" ");
  const pathA = gradient.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.time_min).toFixed(1)},${Ya(pt.pct_b).toFixed(1)}`).join(" ");
  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = Array.from({ length: 5 }, (_, i) => (i * maxT) / 4);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PL} y1={Yb(v)} x2={W - PR} y2={Yb(v)} stroke="var(--border)" strokeWidth={0.4} strokeDasharray="3 3" />
          <text x={PL - 4} y={Yb(v) + 3} textAnchor="end" fontSize={8} fill="var(--text-muted)" fontFamily="monospace">{v}%</text>
        </g>
      ))}
      {xTicks.map((t, i) => (
        <text key={i} x={X(t)} y={PT + plotH + 14} textAnchor="middle" fontSize={8} fill="var(--text-muted)" fontFamily="monospace">{t.toFixed(1)}</text>
      ))}
      <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      {/* Solvent A fill */}
      <path d={`${pathA} L${X(maxT)},${PT} L${X(0)},${PT} Z`} fill="#4d9fff" fillOpacity={0.12} />
      <path d={pathA} stroke="#4d9fff" strokeWidth={1.5} fill="none" strokeDasharray="5 3" />
      {/* Solvent B fill */}
      <path d={`${pathB} L${X(maxT)},${PT + plotH} L${X(0)},${PT + plotH} Z`} fill="#ffb347" fillOpacity={0.2} />
      <path d={pathB} stroke="#ffb347" strokeWidth={2} fill="none" />
      {gradient.map((pt, i) => (
        <g key={i}>
          <circle cx={X(pt.time_min)} cy={Yb(pt.pct_b)} r={3.5} fill="#ffb347" stroke="var(--bg-card)" strokeWidth={1.5} />
          <circle cx={X(pt.time_min)} cy={Ya(pt.pct_b)} r={2.5} fill="#4d9fff" stroke="var(--bg-card)" strokeWidth={1} />
        </g>
      ))}
      {/* Legend */}
      <rect x={PL + 4} y={PT + 2} width={8} height={5} fill="#4d9fff" rx={1} />
      <text x={PL + 16} y={PT + 8} fontSize={9} fill="#4d9fff" fontWeight={600}>%A Aqueous</text>
      <rect x={PL + 90} y={PT + 2} width={8} height={5} fill="#ffb347" rx={1} />
      <text x={PL + 102} y={PT + 8} fontSize={9} fill="#ffb347" fontWeight={600}>%B Organic</text>
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--text-muted)">Time (min)</text>
    </svg>
  );
}

// ── Dynamic Column Card ─────────────────────────────────────────────────────────
function ColumnCard({ column, selected, onSelect, score }: {
  column: Column; selected: boolean; onSelect: () => void; score?: number;
}) {
  const modeColor = column.mode === "HILIC" ? "#4d9fff" : column.mode === "RP" ? "#00d4a4" : "#ffb347";
  return (
    <div onClick={onSelect} style={{
      padding: "10px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
      background: selected ? modeColor + "15" : "var(--bg-secondary)",
      border: `1.5px solid ${selected ? modeColor : "var(--border)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: selected ? modeColor : "var(--border-light)" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: selected ? modeColor : "var(--text-primary)" }}>{column.name}</span>
        </div>
        {score !== undefined && (
          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: modeColor + "22", color: modeColor, fontWeight: 700 }}>
            {(score * 100).toFixed(0)}% match
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Badge text={column.mode} color={modeColor} />
        <Badge text={column.vendor} color="var(--text-muted)" />
        <Badge text={`${column.particle_size_um}μm`} color="var(--text-muted)" />
        <Badge text={`${column.length_mm}×${column.id_mm}mm`} color="var(--text-muted)" />
      </div>
      {selected && (
        <div style={{ marginTop: 6, fontSize: 10, color: modeColor, opacity: 0.8 }}>
          ✓ Best for: {(column.suited_for || []).slice(0, 3).join(" · ")}
        </div>
      )}
    </div>
  );
}

// ── Dynamic Mobile Phase Card ───────────────────────────────────────────────────
function MobilePhaseCard({ mp, selected, onSelect, recommended }: {
  mp: MobilePhase; selected: boolean; onSelect: () => void; recommended?: boolean;
}) {
  return (
    <div onClick={onSelect} style={{
      padding: "10px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
      background: selected ? "var(--accent-dim)" : "var(--bg-secondary)",
      border: `1.5px solid ${selected ? "var(--accent)" : recommended ? "var(--accent)40" : "var(--border)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: selected ? "var(--accent)" : "var(--text-primary)" }}>{mp.name}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {recommended && <Badge text="AI Recommended" color="var(--accent)" />}
          {mp.ms_compatible && <Badge text="MS ✓" color="var(--green)" />}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ padding: "5px 8px", background: "#4d9fff15", border: "1px solid #4d9fff30", borderRadius: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#4d9fff", marginBottom: 2 }}>▲ SOLVENT A</div>
          <div style={{ fontSize: 11, color: "var(--text-primary)" }}>{mp.solvent_a}</div>
          {mp.additive_a && <div style={{ fontSize: 10, color: "#4d9fff", marginTop: 1 }}>{mp.additive_a}</div>}
        </div>
        <div style={{ padding: "5px 8px", background: "#ffb34715", border: "1px solid #ffb34730", borderRadius: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#ffb347", marginBottom: 2 }}>▲ SOLVENT B</div>
          <div style={{ fontSize: 11, color: "var(--text-primary)" }}>{mp.solvent_b}</div>
          {mp.additive_b && mp.additive_b !== "None" && <div style={{ fontSize: 10, color: "#ffb347", marginTop: 1 }}>{mp.additive_b}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>pH {mp.ph}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{mp.mode} mode</span>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────
const BIO_CLASSES = ["All","Organic acids","Amino acids","Nucleotides","Carbohydrates","Fatty acids","Acyl-CoAs","Cofactors","Phosphorylated sugars","Neurotransmitters","Bile acids","Eicosanoids","Vitamins","Antioxidants","Purines","Sterols","Sugar alcohols","Sphingolipids"];

const GRADIENT_PRESETS = [
  { label: "RP Standard", grad: [{time_min:0,pct_b:5},{time_min:1,pct_b:5},{time_min:9,pct_b:95},{time_min:11,pct_b:95},{time_min:11.5,pct_b:5},{time_min:13,pct_b:5}] },
  { label: "RP Fast", grad: [{time_min:0,pct_b:5},{time_min:6,pct_b:95},{time_min:7,pct_b:95},{time_min:7.5,pct_b:5},{time_min:9,pct_b:5}] },
  { label: "RP Long", grad: [{time_min:0,pct_b:2},{time_min:2,pct_b:2},{time_min:18,pct_b:98},{time_min:20,pct_b:98},{time_min:20.5,pct_b:2},{time_min:22,pct_b:2}] },
  { label: "HILIC", grad: [{time_min:0,pct_b:90},{time_min:2,pct_b:90},{time_min:14,pct_b:40},{time_min:16,pct_b:40},{time_min:16.5,pct_b:90},{time_min:18,pct_b:90}] },
  { label: "Lipidomics", grad: [{time_min:0,pct_b:60},{time_min:2,pct_b:85},{time_min:12,pct_b:99},{time_min:14,pct_b:99},{time_min:14.5,pct_b:60},{time_min:16,pct_b:60}] },
  { label: "Step", grad: [{time_min:0,pct_b:5},{time_min:3,pct_b:5},{time_min:3.1,pct_b:35},{time_min:6,pct_b:35},{time_min:6.1,pct_b:70},{time_min:9,pct_b:70},{time_min:9.1,pct_b:95},{time_min:11,pct_b:95},{time_min:11.5,pct_b:5},{time_min:13,pct_b:5}] },
];

export default function SimulateTab({ metabolites, columns, mobilePhases, peakColors }: Props) {
  // Selections
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [columnId, setColumnId] = useState(columns[0]?.id || "");
  const [mpId, setMpId] = useState(mobilePhases[0]?.id || "");
  const [instrument, setInstrument] = useState("Agilent 6495D");
  const [ionMode, setIonMode] = useState("negative");
  const [flowRate, setFlowRate] = useState(0.4);
  const [temp, setTemp] = useState(40);
  const [gradient, setGradient] = useState<GradientPoint[]>(GRADIENT_PRESETS[0].grad);
  const [includeMRM, setIncludeMRM] = useState(true);

  // Search / filter
  const [search, setSearch] = useState("");
  const [bioClass, setBioClass] = useState("All");

  // Results
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [activeResultTab, setActiveResultTab] = useState<"chrom"|"peaks"|"mrm"|"resolution"|"suppression"|"resolver">("chrom");

  // Smart recommendations
  const [colScores, setColScores] = useState<Record<string, number>>({});
  const [recommendedMpId, setRecommendedMpId] = useState("");
  const [mlGradients, setMlGradients] = useState<{gradient: GradientPoint[]; total_score: number; optimization_notes: string; n_coelutions_critical: number}[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [bufferSuggestions, setBufferSuggestions] = useState<string[]>([]);

  const currentCol = columns.find(c => c.id === columnId);
  const currentMp = mobilePhases.find(m => m.id === mpId);

  // ── Dynamic smart recommendations when analytes change ──────────────────────
  useEffect(() => {
    if (selectedMets.length === 0) {
      setColScores({}); setRecommendedMpId(""); setBufferSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        // ML column recommendation
        const colRes = await api.mlColumnSelect({ metabolite_ids: selectedMets, mode_preference: "auto" });
        const scores: Record<string, number> = {};
        colRes.recommendations.forEach(rec => {
          columns.forEach(col => {
            if (col.chemistry?.toLowerCase().includes(rec.chemistry.toLowerCase()) ||
                rec.chemistry.toLowerCase().includes(col.chemistry?.toLowerCase() || "")) {
              scores[col.id] = Math.max(scores[col.id] || 0, rec.score);
            }
          });
        });
        setColScores(scores);

        // Auto-select best column
        if (colRes.recommendations.length > 0) {
          const bestChem = colRes.recommendations[0].chemistry;
          const bestCol = columns.find(c =>
            c.chemistry?.toLowerCase().includes(bestChem.toLowerCase()) ||
            bestChem.toLowerCase().includes(c.chemistry?.toLowerCase() || "")
          );
          if (bestCol) setColumnId(bestCol.id);
        }

        // Buffer recommendation
        const bufRes = await api.mlBufferOptimize({
          metabolite_ids: selectedMets,
          column_chemistry: colRes.recommendations[0]?.chemistry || "C18",
          ion_mode: ionMode,
          gradient,
        });
        setBufferSuggestions(bufRes.optimization_suggestions || []);

        // Auto-select best mobile phase
        const bestBuf = bufRes.recommended_buffer;
        const bestMp = mobilePhases.find(mp =>
          mp.name.toLowerCase().includes(bestBuf.split(" ")[0].toLowerCase()) ||
          bestBuf.toLowerCase().includes(mp.solvent_a?.toLowerCase() || "")
        );
        if (bestMp) { setMpId(bestMp.id); setRecommendedMpId(bestMp.id); }
      } catch {}
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedMets, ionMode]);

  // ── Dynamic gradient optimization when column/mobile phase changes ───────────
  useEffect(() => {
    if (selectedMets.length === 0 || !currentCol) return;
    const timer = setTimeout(async () => {
      setOptimizing(true);
      try {
        const res = await api.mlGradientOptimize({
          metabolite_ids: selectedMets,
          column_chemistry: currentCol.chemistry || "C18",
          mobile_phase_id: mpId,
          max_time_min: currentCol.mode === "HILIC" ? 18 : 13,
          ion_mode: ionMode,
        });
        setMlGradients(res.optimized_gradients || []);
        // Auto-apply best gradient
        if (res.optimized_gradients?.length > 0) {
          setGradient(res.optimized_gradients[0].gradient);
        }
      } catch {} finally { setOptimizing(false); }
    }, 1200);
    return () => clearTimeout(timer);
  }, [columnId, mpId, ionMode]);

  // ── Auto-run simulation when key params change ────────────────────────────────
  const autoRunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (selectedMets.length === 0 || !columnId || !mpId) return;
    if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
    autoRunTimer.current = setTimeout(() => { runSim(); }, 1500);
    return () => { if (autoRunTimer.current) clearTimeout(autoRunTimer.current); };
  }, [gradient, columnId, mpId, flowRate, temp, ionMode, selectedMets]);

  const filtered = metabolites.filter(m => {
    const q = search.toLowerCase();
    return (!q || m.name.toLowerCase().includes(q) || (m.hmdb_id||"").toLowerCase().includes(q) || (m.formula||"").toLowerCase().includes(q) || (m.synonyms||[]).some(s => s.toLowerCase().includes(q))) &&
           (bioClass === "All" || m.bio_class === bioClass);
  });

  const toggle = (id: string) => setSelectedMets(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const runSim = useCallback(async () => {
    if (!selectedMets.length || !columnId || !mpId) return;
    setRunning(true); setError("");
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
  }, [selectedMets, columnId, mpId, gradient, flowRate, temp, ionMode, instrument, includeMRM]);

  const riskColor = (level: string) => ({ none: "#57d9a3", low: "#00d4a4", medium: "#ffb347", high: "#ff6b6b", critical: "#ff2d55" }[level] || "#888");
  const allMRM = result?.results.flatMap(r => r.mrm_transitions || []) || [];

  // Sort columns by score
  const sortedColumns = [...columns].sort((a, b) => (colScores[b.id] || 0) - (colScores[a.id] || 0));
  // Filter mobile phases by column mode
  const filteredMps = currentCol ? mobilePhases.filter(mp => !mp.mode || mp.mode === currentCol.mode || mp.mode === "RP") : mobilePhases;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>

      {/* ══ LEFT PANEL ══ */}
      <div>
        {/* Analyte Panel */}
        <Card title={`Analyte Panel (${selectedMets.length} selected)`} extra={
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => setSelectedMets(filtered.map(m => m.id))} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)" }}>All</button>
            <button onClick={() => setSelectedMets([])} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Clear</button>
          </div>
        }>
          <input placeholder="Search name / HMDB / formula…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 12, marginBottom: 6 }} />
          <select value={bioClass} onChange={e => setBioClass(e.target.value)} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 8px", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
            {BIO_CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map(m => {
              const checked = selectedMets.includes(m.id);
              const color = checked ? peakColors[selectedMets.indexOf(m.id) % peakColors.length] : "var(--border-light)";
              return (
                <button key={m.id} onClick={() => toggle(m.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, background: checked ? color + "18" : "transparent", border: `1px solid ${checked ? color + "50" : "transparent"}`, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: checked ? color : "var(--text-primary)", fontWeight: checked ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.formula} · {m.bio_class}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>{filtered.length}/{metabolites.length} metabolites</div>
        </Card>

        {/* Dynamic Column Selection */}
        <Card title="LC Column Selection" accent="#00d4a4" extra={
          Object.keys(colScores).length > 0 ? <Badge text="AI Scored" color="var(--accent)" /> : undefined
        }>
          {Object.keys(colScores).length > 0 && (
            <div style={{ padding: "6px 10px", background: "var(--accent-dim)", borderRadius: 6, marginBottom: 8, fontSize: 11, color: "var(--accent)" }}>
              🤖 Columns ranked by ML model based on your analyte panel
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
            {sortedColumns.map(col => (
              <ColumnCard key={col.id} column={col} selected={columnId === col.id} onSelect={() => setColumnId(col.id)} score={colScores[col.id]} />
            ))}
          </div>
        </Card>

        {/* Dynamic Mobile Phase */}
        <Card title="Mobile Phase (Binary)" accent="#4d9fff" extra={
          recommendedMpId ? <Badge text="AI Selected" color="var(--blue)" /> : undefined
        }>
          {bufferSuggestions.length > 0 && (
            <div style={{ padding: "6px 10px", background: "#4d9fff15", border: "1px solid #4d9fff30", borderRadius: 6, marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#4d9fff", marginBottom: 4 }}>AI BUFFER RECOMMENDATIONS</div>
              {bufferSuggestions.slice(0, 2).map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>→ {s}</div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {filteredMps.map(mp => (
              <MobilePhaseCard key={mp.id} mp={mp} selected={mpId === mp.id} onSelect={() => setMpId(mp.id)} recommended={mp.id === recommendedMpId} />
            ))}
          </div>
        </Card>

        {/* Dynamic Gradient Program */}
        <Card title="Binary Gradient Program" accent="#ffb347" extra={
          optimizing ? <Badge text="ML Optimizing…" color="var(--amber)" /> :
          mlGradients.length > 0 ? <Badge text="ML Optimized" color="var(--amber)" /> : undefined
        }>
          {/* ML gradient suggestions */}
          {mlGradients.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--amber)", marginBottom: 6 }}>ML GRADIENT CANDIDATES</div>
              {mlGradients.slice(0, 3).map((g, i) => (
                <div key={i} onClick={() => setGradient(g.gradient)} style={{
                  padding: "6px 10px", borderRadius: 6, cursor: "pointer", marginBottom: 4,
                  background: JSON.stringify(gradient) === JSON.stringify(g.gradient) ? "#ffb34720" : "var(--bg-secondary)",
                  border: `1px solid ${JSON.stringify(gradient) === JSON.stringify(g.gradient) ? "#ffb34760" : "var(--border)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? "var(--amber)" : "var(--text-secondary)" }}>
                      {i === 0 ? "🥇 Best" : i === 1 ? "🥈 Fast" : "🥉 Alternative"}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Badge text={`Score ${(g.total_score * 100).toFixed(0)}%`} color="var(--amber)" />
                      <Badge text={g.n_coelutions_critical === 0 ? "✓ No overlap" : `⚠ ${g.n_coelutions_critical}`} color={g.n_coelutions_critical === 0 ? "var(--green)" : "var(--red)"} />
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{g.optimization_notes.slice(0, 60)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Presets */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {GRADIENT_PRESETS.map(p => (
              <button key={p.label} onClick={() => setGradient(p.grad)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer", background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{p.label}</button>
            ))}
          </div>

          {/* Gradient table */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "20px 60px 1fr 1fr 20px", gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>#</span>
              <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>min</span>
              <span style={{ fontSize: 9, color: "#4d9fff", textAlign: "center", fontWeight: 700 }}>%A Aqueous</span>
              <span style={{ fontSize: 9, color: "#ffb347", textAlign: "center", fontWeight: 700 }}>%B Organic</span>
              <span />
            </div>
            {gradient.map((pt, i) => {
              const pctA = 100 - pt.pct_b;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 60px 1fr 1fr 20px", gap: 4, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>{i + 1}</span>
                  <input type="number" value={pt.time_min} step={0.5} min={0}
                    onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, time_min: +e.target.value } : p))}
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "3px 5px", borderRadius: 4, fontSize: 11, textAlign: "center" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ flex: 1, height: 12, background: "var(--bg-primary)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)" }}>
                      <div style={{ width: `${pctA}%`, height: "100%", background: "#4d9fff", opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#4d9fff", fontFamily: "monospace", minWidth: 28, textAlign: "right" }}>{pctA}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="number" value={pt.pct_b} step={5} min={0} max={100}
                      onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, pct_b: +e.target.value } : p))}
                      style={{ width: 40, background: "var(--bg-primary)", border: "1px solid #ffb34760", color: "#ffb347", padding: "3px 5px", borderRadius: 4, fontSize: 11, textAlign: "center", fontWeight: 600 }} />
                    <div style={{ flex: 1, height: 12, background: "var(--bg-primary)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)" }}>
                      <div style={{ width: `${pt.pct_b}%`, height: "100%", background: "#ffb347", opacity: 0.8 }} />
                    </div>
                  </div>
                  {gradient.length > 2 ? <button onClick={() => setGradient(g => g.filter((_, j) => j !== i))} style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>×</button> : <span />}
                </div>
              );
            })}
            <button onClick={() => setGradient(g => [...g, { time_min: +(g[g.length - 1].time_min + 1).toFixed(1), pct_b: g[g.length - 1].pct_b }])} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, cursor: "pointer", marginTop: 4, background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)" }}>+ Add point</button>
          </div>

          {/* Live gradient chart */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 7, padding: "4px 2px" }}>
            <GradientSVG gradient={gradient} />
          </div>
        </Card>

        {/* Instrument */}
        <Card title="Instrument Settings">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Instrument", val: instrument, setter: setInstrument, opts: ["Agilent 6495D","Agilent 6470","SCIEX 7500+","SCIEX 6500+","Waters Xevo TQ-S"] },
              { label: "Ion Mode", val: ionMode, setter: setIonMode, opts: ["negative","positive"] },
            ].map(s => (
              <div key={s.label}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>{s.label}</label>
                <select value={s.val} onChange={e => s.setter(e.target.value)} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 8px", borderRadius: 6, fontSize: 12 }}>
                  {s.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            {[
              { label: "Flow Rate (mL/min)", val: flowRate, setter: setFlowRate, step: 0.05, min: 0.1, max: 1 },
              { label: "Temperature (°C)", val: temp, setter: setTemp, step: 5, min: 20, max: 80 },
            ].map(s => (
              <div key={s.label}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>{s.label}</label>
                <input type="number" value={s.val} onChange={e => s.setter(+e.target.value)} step={s.step} min={s.min} max={s.max} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 8px", borderRadius: 6, fontSize: 12 }} />
              </div>
            ))}
          </div>
          <div onClick={() => setIncludeMRM(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "6px 10px", background: includeMRM ? "var(--accent-dim)" : "var(--bg-secondary)", borderRadius: 6, border: `1px solid ${includeMRM ? "var(--accent)40" : "var(--border)"}`, cursor: "pointer" }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${includeMRM ? "var(--accent)" : "var(--border)"}`, background: includeMRM ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {includeMRM && <span style={{ fontSize: 10, color: "#0f1117", fontWeight: 800 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 12, color: includeMRM ? "var(--accent)" : "var(--text-secondary)", fontWeight: 600 }}>Include MRM Transitions</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Auto-generate QQQ method</div>
            </div>
          </div>
        </Card>

        <button onClick={runSim} disabled={running || !selectedMets.length} style={{
          width: "100%", padding: "11px 0",
          background: running ? "var(--border)" : "linear-gradient(135deg, #00d4a4, #00b890)",
          color: "#0f1117", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: running ? "not-allowed" : "pointer",
        }}>
          {running ? "⏳ Simulating…" : `▶ Run Simulation (${selectedMets.length} analytes)`}
        </button>
        {selectedMets.length > 0 && <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Auto-updates when parameters change</div>}
        {error && <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)", padding: "8px 12px", background: "var(--red-dim)", borderRadius: 6 }}>{error}</div>}
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div>
        {!result ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 48 }}>🔬</div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
              Select metabolites — column, mobile phase, and gradient<br />will <strong style={{ color: "var(--accent)" }}>automatically optimize</strong> and simulate
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{metabolites.length} metabolites · {columns.length} columns · {mobilePhases.length} mobile phases</p>
          </div>
        ) : (
          <>
            {/* Current method summary bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Column", value: currentCol?.name?.split(" ").slice(-1)[0] || "—", color: "var(--accent)" },
                { label: "Mobile Phase", value: currentMp?.mode || "—", color: "#4d9fff" },
                { label: "Peaks", value: String(result.results.length), color: "var(--amber)" },
                { label: "MRM Transitions", value: String(allMRM.length), color: "var(--purple)" },
                { label: "Runtime", value: `${result.runtime_ms}ms`, color: "var(--text-secondary)" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Result tabs */}
            <div style={{ display: "flex", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 14 }}>
              {([
                { id: "chrom", label: "📈 Chromatogram" },
                { id: "peaks", label: "📊 Peak Data" },
                { id: "mrm", label: `⚡ MRM (${allMRM.length})` },
                { id: "resolution", label: `🔍 Resolution` },
                { id: "resolver", label: "🎯 Fix Co-Elutions" },
                { id: "suppression", label: "🧪 Ion Suppression" },
              ] as { id: typeof activeResultTab; label: string }[]).map(tab => (
                <button key={tab.id} onClick={() => setActiveResultTab(tab.id)} style={{
                  flex: 1, padding: "9px 4px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                  color: activeResultTab === tab.id ? "var(--accent)" : "var(--text-muted)",
                  background: activeResultTab === tab.id ? "var(--accent-dim)" : "transparent",
                  borderBottom: activeResultTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                  borderRight: "1px solid var(--border)",
                }}>{tab.label}</button>
              ))}
            </div>

            {/* Chromatogram */}
            {activeResultTab === "chrom" && (
              <Card title={`Predicted Chromatogram — ${result.column}`}>
                <ChromSVG result={result} peakColors={peakColors} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {result.results.map((r, i) => (
                    <div key={r.metabolite_id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: peakColors[i % peakColors.length] }} />
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.metabolite_name} <span style={{ fontFamily: "monospace", color: peakColors[i % peakColors.length] }}>{r.rt_min.toFixed(2)}min</span></span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Peaks */}
            {activeResultTab === "peaks" && (
              <Card title="Peak Parameters">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ background: "var(--bg-secondary)" }}>
                    {["Compound","RT (min)","k","Width (min)","Tailing","Plates","Confidence"].map(h => (
                      <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...result.results].sort((a, b) => a.rt_min - b.rt_min).map((r) => {
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

            {/* MRM */}
            {activeResultTab === "mrm" && (
              <Card title={`MRM Transitions — ${instrument} (${ionMode})`} extra={
                <button onClick={() => {
                  const rows = [["Compound","Precursor m/z","Product m/z","CE (eV)","Frag V","Dwell ms","Type","RT (min)"]];
                  allMRM.forEach(t => rows.push([t.metabolite_name,String(t.precursor_mz),String(t.product_mz),String(t.collision_energy),String(t.fragmentor_voltage||""),String(t.dwell_time_ms||""),t.transition_type,String(t.retention_time_min||"")]));
                  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")],{type:"text/csv"})); a.download = `mrm_${instrument}.csv`; a.click();
                }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, cursor: "pointer", background: "var(--blue-dim)", border: "1px solid var(--blue)40", color: "var(--blue)" }}>↓ CSV</button>
              }>
                {allMRM.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Enable "Include MRM Transitions" and re-run simulation</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ background: "var(--bg-secondary)" }}>
                        {["Compound","Adduct","Precursor","Product","CE","Frag V","Dwell ms","Type","RT"].map(h => (
                          <th key={h} style={{ padding: "7px 8px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {allMRM.map((t, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)30" }}>
                            <td style={{ padding: "6px 8px", fontWeight: 500, color: "var(--text-primary)" }}>{t.metabolite_name}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)" }}>{t.adduct}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--blue)", fontWeight: 600 }}>{t.precursor_mz}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>{t.product_mz}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--amber)", fontWeight: 600 }}>{t.collision_energy}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.fragmentor_voltage || "—"}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.dwell_time_ms || "—"}</td>
                            <td style={{ padding: "6px 8px" }}>
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: t.is_quantifier ? "var(--accent-dim)" : "var(--blue-dim)", color: t.is_quantifier ? "var(--accent)" : "var(--blue)" }}>{t.is_quantifier ? "QUANT" : "QUAL"}</span>
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

            {/* Resolution */}
            {activeResultTab === "resolution" && (
              <Card title="Co-Elution Risk Matrix">
                {result.resolution_matrix.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>Select 2+ metabolites to see resolution matrix</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {result.resolution_matrix.map((r, i) => (
                      <div key={i} style={{ padding: "8px 12px", borderRadius: 7, background: riskColor(r.risk_level) + "15", border: `1px solid ${riskColor(r.risk_level)}40` }}>
                        <div style={{ fontSize: 11, color: riskColor(r.risk_level), fontWeight: 700 }}>{r.compound_a} ↔ {r.compound_b}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Rs = <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.rs.toFixed(2)}</span> · {r.risk_level.toUpperCase()}</div>
                        <div style={{ marginTop: 5, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(r.risk_score, 100)}%`, height: "100%", background: riskColor(r.risk_level) }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Co-Elution Resolver */}
            {activeResultTab === "resolver" && (
              <CoElutionResolverPanel
                metaboliteIds={selectedMets}
                columnId={columnId}
                mobilePhaseId={mpId}
                gradient={gradient}
                flowRate={flowRate}
                temperature={temp}
                ionMode={ionMode}
              />
            )}

            {/* Ion Suppression */}
            {activeResultTab === "suppression" && (
              <Card title="Ion Suppression Risk">
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
          </>
        )}
      </div>
    </div>
  );
}
