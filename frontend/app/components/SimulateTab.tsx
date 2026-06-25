"use client";
import { useState, useCallback } from "react";
import { api, type Metabolite, type Column, type MobilePhase, type SimulateResult, type GradientPoint, type RTResult } from "../lib/api";

interface Props {
  metabolites: Metabolite[];
  columns: Column[];
  mobilePhases: MobilePhase[];
  peakColors: string[];
}

function Card({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function sel(val: string, onChange: (v: string) => void, opts: { value: string; label: string }[]) {
  return (
    <select value={val} onChange={e => onChange(e.target.value)} style={{
      background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
      padding: "6px 8px", borderRadius: 6, fontSize: 12, width: "100%", cursor: "pointer",
    }}>
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ChromatogramSVG({ result, peakColors }: { result: SimulateResult; peakColors: string[] }) {
  if (!result.results.length) return null;
  const W = 680, H = 210, PL = 48, PR = 16, PT = 24, PB = 36;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const maxRT = Math.max(...result.results.map(r => r.rt_min)) * 1.2 || 12;
  const nPts = 600;
  const times = Array.from({ length: nPts }, (_, i) => (i / nPts) * maxRT);
  const peakCurves = result.results.map(peak => {
    const sigma = Math.max(peak.peak_width_min / 2.354, 0.005);
    const tailing = peak.tailing_factor || 1.1;
    return times.map(t => {
      const dt = t - peak.rt_min;
      const sig = dt > 0 ? sigma * tailing : sigma;
      return Math.exp(-0.5 * (dt / sig) ** 2);
    });
  });
  const maxI = Math.max(...times.map((_, i) => peakCurves.reduce((s, c) => s + c[i], 0)), 0.01);
  const toX = (t: number) => PL + (t / maxRT) * plotW;
  const toY = (v: number) => PT + plotH - (v / maxI) * plotH;
  const xTicks = Array.from({ length: 7 }, (_, i) => (i * maxRT) / 6);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {xTicks.map((t, i) => (
        <line key={i} x1={toX(t)} y1={PT} x2={toX(t)} y2={PT + plotH} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
      ))}
      <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      {peakCurves.map((curve, idx) => {
        const color = peakColors[idx % peakColors.length];
        const path = times.map((t, i) => `${i === 0 ? "M" : "L"}${toX(t).toFixed(1)},${toY(curve[i]).toFixed(1)}`).join(" ");
        return (
          <g key={idx}>
            <path d={`${path} L${toX(maxRT)},${toY(0)} L${toX(0)},${toY(0)} Z`} fill={color} fillOpacity={0.1} />
            <path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeOpacity={0.9} />
          </g>
        );
      })}
      {result.results.map((peak, idx) => {
        const color = peakColors[idx % peakColors.length];
        const x = toX(peak.rt_min);
        const peakMax = Math.max(...peakCurves[idx]);
        const y = Math.max(toY(peakMax) - 6, PT + 6);
        return (
          <g key={idx}>
            <line x1={x} y1={y + 2} x2={x} y2={PT + plotH} stroke={color} strokeWidth={0.5} strokeDasharray="2 2" strokeOpacity={0.5} />
            <text x={x} y={y} textAnchor="middle" fontSize={9} fill={color} fontFamily="monospace" fontWeight={600}>
              {peak.metabolite_name.length > 10 ? peak.metabolite_name.slice(0, 9) + "…" : peak.metabolite_name}
            </text>
            <text x={x} y={y + 10} textAnchor="middle" fontSize={8} fill={color} opacity={0.7}>{peak.rt_min.toFixed(2)}min</text>
          </g>
        );
      })}
      {xTicks.map((t, i) => (
        <g key={i}>
          <line x1={toX(t)} y1={PT + plotH} x2={toX(t)} y2={PT + plotH + 4} stroke="var(--border-light)" strokeWidth={1} />
          <text x={toX(t)} y={PT + plotH + 14} textAnchor="middle" fontSize={9} fill="var(--text-muted)" fontFamily="monospace">{t.toFixed(1)}</text>
        </g>
      ))}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)">Retention Time (min)</text>
      <text x={12} y={PT + plotH / 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)" transform={`rotate(-90,12,${PT + plotH / 2})`}>Signal (a.u.)</text>

      {/* Gradient profile overlay */}
    </svg>
  );
}

function GradientProfileSVG({ gradient }: { gradient: GradientPoint[] }) {
  if (gradient.length < 2) return null;
  const W = 680, H = 80, PL = 48, PR = 16, PT = 8, PB = 24;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const maxT = gradient[gradient.length - 1].time_min || 12;
  const toX = (t: number) => PL + (t / maxT) * plotW;
  const toY = (pct: number) => PT + plotH - (pct / 100) * plotH;
  const path = gradient.map((pt, i) => `${i === 0 ? "M" : "L"}${toX(pt.time_min).toFixed(1)},${toY(pt.pct_b).toFixed(1)}`).join(" ");
  const fillPath = `${path} L${toX(maxT)},${toY(0)} L${toX(0)},${toY(0)} Z`;
  const xTicks = Array.from({ length: 5 }, (_, i) => (i * maxT) / 4);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <text x={PL - 4} y={PT + 4} textAnchor="end" fontSize={8} fill="var(--text-muted)">100%</text>
      <text x={PL - 4} y={PT + plotH} textAnchor="end" fontSize={8} fill="var(--text-muted)">0%</text>
      <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="var(--border)" strokeWidth={0.5} />
      <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="var(--border)" strokeWidth={0.5} />
      <path d={fillPath} fill="#4d9fff" fillOpacity={0.15} />
      <path d={path} stroke="#4d9fff" strokeWidth={2} fill="none" />
      {gradient.map((pt, i) => (
        <circle key={i} cx={toX(pt.time_min)} cy={toY(pt.pct_b)} r={3} fill="#4d9fff" />
      ))}
      {xTicks.map((t, i) => (
        <text key={i} x={toX(t)} y={PT + plotH + 12} textAnchor="middle" fontSize={8} fill="var(--text-muted)" fontFamily="monospace">{t.toFixed(1)}</text>
      ))}
      <text x={PL + 8} y={PT + 12} fontSize={9} fill="#4d9fff" fontWeight={600}>%B (organic)</text>
      <text x={W / 2} y={H - 1} textAnchor="middle" fontSize={8} fill="var(--text-muted)">Time (min)</text>
    </svg>
  );
}

function confidenceBar(v: number) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 50, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${v * 100}%`, height: "100%", background: v > 0.7 ? "var(--green)" : v > 0.4 ? "var(--amber)" : "var(--red)", borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "monospace" }}>{(v * 100).toFixed(0)}%</span>
    </div>
  );
}

const BIO_CLASSES = ["All Classes","Organic acids","Amino acids","Nucleotides","Carbohydrates","Fatty acids","Acyl-CoAs","Cofactors","Phosphorylated sugars","Neurotransmitters","Bile acids","Eicosanoids","Vitamins","Antioxidants","Purines","Sterols","Sugar alcohols","Sphingolipids"];

export default function SimulateTab({ metabolites, columns, mobilePhases, peakColors }: Props) {
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [columnId, setColumnId] = useState(columns[0]?.id || "");
  const [mpId, setMpId] = useState(mobilePhases[0]?.id || "");
  const [instrument, setInstrument] = useState("Agilent 6495D");
  const [ionMode, setIonMode] = useState("negative");
  const [flowRate, setFlowRate] = useState(0.4);
  const [temp, setTemp] = useState(40);
  const [gradient, setGradient] = useState<GradientPoint[]>([
    { time_min: 0, pct_b: 5 },
    { time_min: 2, pct_b: 5 },
    { time_min: 8, pct_b: 95 },
    { time_min: 10, pct_b: 95 },
    { time_min: 10.1, pct_b: 5 },
    { time_min: 12, pct_b: 5 },
  ]);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [bioClass, setBioClass] = useState("All Classes");
  const [includeMRM, setIncludeMRM] = useState(false);

  // Get current column and mobile phase details
  const currentCol = columns.find(c => c.id === columnId);
  const currentMp = mobilePhases.find(m => m.id === mpId);

  const filtered = metabolites.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.hmdb_id || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.formula || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.synonyms || []).some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchClass = bioClass === "All Classes" || m.bio_class === bioClass;
    return matchSearch && matchClass;
  });

  const toggle = (id: string) => setSelectedMets(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selectAll = () => setSelectedMets(filtered.map(m => m.id));
  const clearAll = () => setSelectedMets([]);

  const runSim = async () => {
    if (!selectedMets.length || !columnId || !mpId) { setError("Select metabolites, column and mobile phase."); return; }
    setRunning(true); setError(""); setResult(null);
    try {
      const res = await api.simulate({
        metabolite_ids: selectedMets, column_id: columnId, mobile_phase_id: mpId,
        gradient, flow_rate_ml_min: flowRate, temperature_c: temp,
        ion_mode: ionMode, instrument, include_chromatogram: true, include_mrm: includeMRM,
      });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally { setRunning(false); }
  };

  const riskColor = (level: string) => ({ none: "#57d9a3", low: "#00d4a4", medium: "#ffb347", high: "#ff6b6b", critical: "#ff2d55" }[level] || "#888");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, alignItems: "start" }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Analyte Panel */}
        <Card title={`Analyte Panel ${selectedMets.length > 0 ? `(${selectedMets.length} selected)` : ""}`} extra={
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={selectAll} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)" }}>All</button>
            <button onClick={clearAll} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Clear</button>
          </div>
        }>
          <input placeholder="Search name, HMDB, formula, synonym…" value={search} onChange={e => setSearch(e.target.value)} style={{
            width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
            padding: "7px 10px", borderRadius: 6, fontSize: 12, marginBottom: 8,
          }} />
          <select value={bioClass} onChange={e => setBioClass(e.target.value)} style={{
            width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
            padding: "6px 8px", borderRadius: 6, fontSize: 12, marginBottom: 8,
          }}>
            {BIO_CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
          <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.length === 0 && (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No metabolites found</div>
            )}
            {filtered.map((m, idx) => {
              const checked = selectedMets.includes(m.id);
              const colorIdx = selectedMets.indexOf(m.id);
              const color = checked ? peakColors[colorIdx % peakColors.length] : "var(--border-light)";
              return (
                <button key={m.id} onClick={() => toggle(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
                  background: checked ? color + "18" : "transparent",
                  border: `1px solid ${checked ? color + "50" : "transparent"}`,
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
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>{filtered.length} of {metabolites.length} metabolites</div>
        </Card>

        {/* Column */}
        <Card title="Column">
          {sel(columnId, setColumnId, columns.map(c => ({ value: c.id, label: `${c.vendor} ${c.name}` })))}
          {currentCol && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 6, fontSize: 11 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <div><span style={{ color: "var(--text-muted)" }}>Mode: </span><span style={{ color: "var(--text-primary)" }}>{currentCol.mode}</span></div>
                <div><span style={{ color: "var(--text-muted)" }}>Size: </span><span style={{ color: "var(--text-primary)" }}>{currentCol.particle_size_um}μm</span></div>
                <div><span style={{ color: "var(--text-muted)" }}>Dim: </span><span style={{ color: "var(--text-primary)" }}>{currentCol.length_mm}×{currentCol.id_mm}mm</span></div>
                <div><span style={{ color: "var(--text-muted)" }}>Chem: </span><span style={{ color: "var(--text-primary)" }}>{currentCol.chemistry}</span></div>
              </div>
              <div style={{ marginTop: 4, color: "var(--accent)", fontSize: 10 }}>
                Best for: {(currentCol.suited_for || []).slice(0, 3).join(", ")}
              </div>
            </div>
          )}
        </Card>

        {/* Mobile Phase A and B */}
        <Card title="Mobile Phase">
          {sel(mpId, setMpId, mobilePhases.map(m => ({ value: m.id, label: m.name })))}
          {currentMp && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 6 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ padding: "6px 8px", background: "var(--bg-card)", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, color: "var(--blue)", fontWeight: 600, marginBottom: 2 }}>SOLVENT A (Aqueous)</div>
                  <div style={{ fontSize: 11, color: "var(--text-primary)" }}>{currentMp.solvent_a}</div>
                  {currentMp.additive_a && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{currentMp.additive_a}</div>}
                </div>
                <div style={{ padding: "6px 8px", background: "var(--bg-card)", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, color: "var(--amber)", fontWeight: 600, marginBottom: 2 }}>SOLVENT B (Organic)</div>
                  <div style={{ fontSize: 11, color: "var(--text-primary)" }}>{currentMp.solvent_b}</div>
                  {currentMp.additive_b && currentMp.additive_b !== "None" && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{currentMp.additive_b}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>pH {currentMp.ph}</span>
                {currentMp.ms_compatible && <span style={{ fontSize: 10, color: "var(--accent)" }}>✓ MS compatible</span>}
              </div>
            </div>
          )}
        </Card>

        {/* Gradient Program */}
        <Card title="Binary Gradient Program" extra={
          <button onClick={() => setGradient(g => [...g, { time_min: g[g.length - 1].time_min + 1, pct_b: g[g.length - 1].pct_b }])} style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 4, cursor: "pointer",
            background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)",
          }}>+ Add</button>
        }>
          {/* Gradient table */}
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 24px", gap: 4, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>#</div>
            <div style={{ fontSize: 10, color: "var(--blue)", fontWeight: 600 }}>Time (min)</div>
            <div style={{ fontSize: 10, color: "var(--amber)", fontWeight: 600 }}>%B (organic)</div>
            <div />
            {gradient.map((pt, i) => (
              <>
                <div key={`n${i}`} style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                <input key={`t${i}`} type="number" value={pt.time_min} step={0.5} min={0}
                  onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, time_min: +e.target.value } : p))}
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--blue)", padding: "4px 6px", borderRadius: 5, fontSize: 12, textAlign: "center" }} />
                <div key={`brow${i}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="number" value={pt.pct_b} step={5} min={0} max={100}
                    onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, pct_b: +e.target.value } : p))}
                    style={{ width: "60%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--amber)", padding: "4px 6px", borderRadius: 5, fontSize: 12, textAlign: "center" }} />
                  <div style={{ width: "35%", height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pt.pct_b}%`, height: "100%", background: "var(--amber)", borderRadius: 3 }} />
                  </div>
                </div>
                {gradient.length > 2 ? (
                  <button key={`d${i}`} onClick={() => setGradient(g => g.filter((_, j) => j !== i))} style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>×</button>
                ) : <div key={`d${i}`} />}
              </>
            ))}
          </div>

          {/* Gradient profile visualization */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "4px 0", marginTop: 4 }}>
            <GradientProfileSVG gradient={gradient} />
          </div>

          {/* Quick presets */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Quick Presets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {[
                { label: "RP Short", grad: [{time_min:0,pct_b:5},{time_min:1,pct_b:5},{time_min:8,pct_b:95},{time_min:10,pct_b:95},{time_min:10.1,pct_b:5},{time_min:12,pct_b:5}] },
                { label: "RP Long", grad: [{time_min:0,pct_b:2},{time_min:2,pct_b:2},{time_min:18,pct_b:98},{time_min:20,pct_b:98},{time_min:20.1,pct_b:2},{time_min:22,pct_b:2}] },
                { label: "HILIC", grad: [{time_min:0,pct_b:90},{time_min:2,pct_b:90},{time_min:15,pct_b:40},{time_min:17,pct_b:40},{time_min:17.1,pct_b:90},{time_min:20,pct_b:90}] },
                { label: "Isocratic", grad: [{time_min:0,pct_b:50},{time_min:10,pct_b:50}] },
              ].map(p => (
                <button key={p.label} onClick={() => setGradient(p.grad)} style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                  background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)",
                }}>{p.label}</button>
              ))}
            </div>
          </div>
        </Card>

        {/* Instrument Settings */}
        <Card title="Instrument Settings">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Instrument</label>
              {sel(instrument, setInstrument, ["Agilent 6495D","Agilent 6470","SCIEX 7500+","SCIEX 6500+","Waters Xevo TQ-S"].map(v => ({ value: v, label: v })))}
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Ion Mode</label>
              {sel(ionMode, setIonMode, [{ value: "negative", label: "Negative (−)" }, { value: "positive", label: "Positive (+)" }])}
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Flow Rate (mL/min)</label>
              <input type="number" value={flowRate} onChange={e => setFlowRate(+e.target.value)} step={0.05} min={0.1} max={1} style={{
                width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
                padding: "6px 8px", borderRadius: 6, fontSize: 12,
              }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Temp (°C)</label>
              <input type="number" value={temp} onChange={e => setTemp(+e.target.value)} step={5} min={20} max={80} style={{
                width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
                padding: "6px 8px", borderRadius: 6, fontSize: 12,
              }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input type="checkbox" id="incMRM" checked={includeMRM} onChange={e => setIncludeMRM(e.target.checked)} />
            <label htmlFor="incMRM" style={{ fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}>Include MRM transitions</label>
          </div>
        </Card>

        <button onClick={runSim} disabled={running || !selectedMets.length} style={{
          padding: "11px 0", background: running ? "var(--border)" : "linear-gradient(135deg, #00d4a4, #00b890)",
          color: "#0f1117", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: running ? "not-allowed" : "pointer",
        }}>
          {running ? "⏳ Simulating…" : `▶ Run Simulation (${selectedMets.length} analytes)`}
        </button>

        {error && <div style={{ fontSize: 12, color: "var(--red)", padding: "8px 12px", background: "var(--red-dim)", borderRadius: 6 }}>{error}</div>}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!result ? (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
            padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>🔬</div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
              Select metabolites and LC parameters,<br />then click <strong style={{ color: "var(--accent)" }}>Run Simulation</strong>
            </p>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              {metabolites.length} metabolites · {columns.length} columns · {mobilePhases.length} mobile phases available
            </div>
          </div>
        ) : (
          <>
            {/* Chromatogram */}
            <Card title={`Predicted Chromatogram — ${result.column}`} extra={
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 500 }}>{result.results.length} peaks</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--blue-dim)", color: "var(--blue)", fontWeight: 500 }}>{result.runtime_ms}ms</span>
              </div>
            }>
              <ChromatogramSVG result={result} peakColors={peakColors} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {result.results.map((r, i) => (
                  <div key={r.metabolite_id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: peakColors[i % peakColors.length] }} />
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.metabolite_name} <span style={{ fontFamily: "monospace", color: peakColors[i % peakColors.length] }}>{r.rt_min.toFixed(2)}</span></span>
                  </div>
                ))}
              </div>
            </Card>

            {/* RT Table */}
            <Card title="Retention Times & Peak Parameters">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      {["Compound","RT (min)","k factor","Width (min)","Tailing","Plates","Confidence"].map(h => (
                        <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.results].sort((a, b) => a.rt_min - b.rt_min).map((r, i) => {
                      const origIdx = result.results.indexOf(r);
                      return (
                        <tr key={r.metabolite_id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "7px 10px", fontWeight: 500 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: peakColors[origIdx % peakColors.length] }} />
                              <span style={{ color: peakColors[origIdx % peakColors.length] }}>{r.metabolite_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>{r.rt_min.toFixed(3)}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.k_retention_factor.toFixed(2)}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.peak_width_min.toFixed(4)}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: r.tailing_factor > 1.5 ? "var(--amber)" : "var(--text-secondary)" }}>{r.tailing_factor.toFixed(2)}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.theoretical_plates.toLocaleString()}</td>
                          <td style={{ padding: "7px 10px" }}>{confidenceBar(r.rt_confidence)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Resolution */}
            {result.resolution_matrix.length > 0 && (
              <Card title="Co-Elution Risk">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {result.resolution_matrix.slice(0, 24).map((r, i) => (
                    <div key={i} style={{ padding: "7px 10px", borderRadius: 6, background: riskColor(r.risk_level) + "15", border: `1px solid ${riskColor(r.risk_level)}40` }}>
                      <div style={{ fontSize: 11, color: riskColor(r.risk_level), fontWeight: 600 }}>{r.compound_a} ↔ {r.compound_b}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Rs = <span style={{ fontFamily: "monospace" }}>{r.rs.toFixed(2)}</span> · {r.risk_level.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Ion suppression */}
            {Object.keys(result.ion_suppression).length > 0 && (
              <Card title="Ion Suppression Risk">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(result.ion_suppression).map(([name, score]) => (
                    <div key={name} style={{ padding: "5px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{name}</span>
                      <div style={{ width: 50, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${score}%`, height: "100%", background: score > 60 ? "var(--red)" : score > 30 ? "var(--amber)" : "var(--green)" }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: score > 60 ? "var(--red)" : score > 30 ? "var(--amber)" : "var(--green)" }}>{score}%</span>
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
