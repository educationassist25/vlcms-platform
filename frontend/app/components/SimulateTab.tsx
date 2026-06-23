"use client";
import { useState, useCallback } from "react";
import { api, type Metabolite, type Column, type MobilePhase, type SimulateResult, type GradientPoint, type RTResult } from "../lib/api";

interface Props {
  metabolites: Metabolite[];
  columns: Column[];
  mobilePhases: MobilePhase[];
  peakColors: string[];
}

const DEFAULT_GRADIENT: GradientPoint[] = [
  { time_min: 0, pct_b: 5 },
  { time_min: 10, pct_b: 95 },
  { time_min: 12, pct_b: 95 },
];

function Card({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: color + "22", color, fontWeight: 500 }}>{text}</span>
  );
}

function ChromatogramSVG({ result, metabolites, peakColors }: { result: SimulateResult; metabolites: Metabolite[]; peakColors: string[] }) {
  if (!result.results.length) return null;

  const W = 680, H = 200, PL = 50, PR = 20, PT = 20, PB = 36;
  const plotW = W - PL - PR, plotH = H - PT - PB;

  const maxRT = Math.max(...result.results.map(r => r.rt_min)) * 1.15 || 12;
  const peaks = result.results;

  // Generate EMG peak curves
  const nPts = 500;
  const times = Array.from({ length: nPts }, (_, i) => (i / nPts) * maxRT);

  const peakCurves = peaks.map((peak, idx) => {
    const sigma = peak.peak_width_min / 2.354;
    const tailing = peak.tailing_factor || 1.1;
    return times.map(t => {
      const dt = t - peak.rt_min;
      if (dt < -3 * sigma) return 0;
      const sig = dt > 0 ? sigma * tailing : sigma;
      return Math.exp(-0.5 * (dt / sig) ** 2);
    });
  });

  const totalCurve = times.map((_, i) => peakCurves.reduce((sum, c) => sum + c[i], 0));
  const maxIntensity = Math.max(...totalCurve, 0.01);

  const toX = (t: number) => PL + (t / maxRT) * plotW;
  const toY = (v: number) => PT + plotH - (v / maxIntensity) * plotH;

  const totalPath = times.map((t, i) => `${i === 0 ? "M" : "L"}${toX(t).toFixed(1)},${toY(totalCurve[i]).toFixed(1)}`).join(" ");

  const xTicks = Array.from({ length: 7 }, (_, i) => (i * maxRT) / 6);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Grid lines */}
      {xTicks.map((t, i) => (
        <line key={i} x1={toX(t)} y1={PT} x2={toX(t)} y2={PT + plotH} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
      ))}
      <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />
      <line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH} stroke="var(--border-light)" strokeWidth={1} />

      {/* Individual peak fills */}
      {peakCurves.map((curve, idx) => {
        const color = peakColors[idx % peakColors.length];
        const fillPath = times.map((t, i) => `${i === 0 ? "M" : "L"}${toX(t).toFixed(1)},${toY(curve[i]).toFixed(1)}`).join(" ");
        return (
          <g key={idx}>
            <path d={`${fillPath} L${toX(maxRT)},${toY(0)} L${toX(0)},${toY(0)} Z`} fill={color} fillOpacity={0.12} />
            <path d={fillPath} stroke={color} strokeWidth={1.5} fill="none" strokeOpacity={0.85} />
          </g>
        );
      })}

      {/* Total chromatogram */}
      <path d={totalPath} stroke="#ffffff" strokeWidth={1} fill="none" strokeOpacity={0.25} />

      {/* Peak labels */}
      {peaks.map((peak, idx) => {
        const color = peakColors[idx % peakColors.length];
        const x = toX(peak.rt_min);
        const peakMax = Math.max(...peakCurves[idx]);
        const y = toY(peakMax) - 6;
        return (
          <g key={idx}>
            <line x1={x} y1={y + 2} x2={x} y2={PT + plotH} stroke={color} strokeWidth={0.5} strokeDasharray="2 2" strokeOpacity={0.5} />
            <text x={x} y={Math.max(y, PT + 8)} textAnchor="middle" fontSize={9} fill={color} fontFamily="monospace" fontWeight={600}>
              {peak.metabolite_name.length > 10 ? peak.metabolite_name.slice(0, 9) + "…" : peak.metabolite_name}
            </text>
            <text x={x} y={Math.max(y, PT + 8) + 10} textAnchor="middle" fontSize={8} fill={color} opacity={0.7}>
              {peak.rt_min.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* X-axis ticks & labels */}
      {xTicks.map((t, i) => (
        <g key={i}>
          <line x1={toX(t)} y1={PT + plotH} x2={toX(t)} y2={PT + plotH + 4} stroke="var(--border-light)" strokeWidth={1} />
          <text x={toX(t)} y={PT + plotH + 14} textAnchor="middle" fontSize={9} fill="var(--text-muted)" fontFamily="monospace">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)">Retention Time (min)</text>
      <text x={12} y={PT + plotH / 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)" transform={`rotate(-90,12,${PT + plotH / 2})`}>Intensity</text>
    </svg>
  );
}

export default function SimulateTab({ metabolites, columns, mobilePhases, peakColors }: Props) {
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [columnId, setColumnId] = useState(columns[0]?.id || "");
  const [mpId, setMpId] = useState(mobilePhases[0]?.id || "");
  const [instrument, setInstrument] = useState("Agilent 6495D");
  const [ionMode, setIonMode] = useState("negative");
  const [flowRate, setFlowRate] = useState(0.4);
  const [temp, setTemp] = useState(40);
  const [gradient, setGradient] = useState<GradientPoint[]>(DEFAULT_GRADIENT);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [includeMRM, setIncludeMRM] = useState(false);

  const filtered = metabolites.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.bio_class || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleMet = (id: string) => {
    setSelectedMets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectGroup = (bioClass: string) => {
    const ids = metabolites.filter(m => m.bio_class === bioClass).map(m => m.id);
    setSelectedMets(prev => {
      const allIn = ids.every(id => prev.includes(id));
      return allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });
  };

  const runSimulation = async () => {
    if (!selectedMets.length || !columnId || !mpId) {
      setError("Select at least one metabolite, column, and mobile phase.");
      return;
    }
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

  const riskColor = (level: string) => ({ none: "var(--green)", low: "var(--accent)", medium: "var(--amber)", high: "var(--red)", critical: "#ff2d55" }[level] || "var(--text-muted)");
  const confidenceBar = (v: number) => <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${v * 100}%`, height: "100%", background: v > 0.7 ? "var(--green)" : v > 0.4 ? "var(--amber)" : "var(--red)", borderRadius: 2 }} />
    </div>
    <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{(v * 100).toFixed(0)}%</span>
  </div>;

  const bioClasses = [...new Set(metabolites.map(m => m.bio_class).filter(Boolean))];

  const sel = (val: string, onChange: (v: string) => void, opts: { value: string; label: string }[]) => (
    <select value={val} onChange={e => onChange(e.target.value)} style={{
      background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
      padding: "6px 10px", borderRadius: 6, fontSize: 12, width: "100%", cursor: "pointer",
    }}>
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
      {/* Left Panel - Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title="Analyte Panel">
          <input
            placeholder="Search metabolites…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)",
              color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 12, marginBottom: 8,
            }}
          />
          {/* Quick-select groups */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {bioClasses.slice(0, 6).map(bc => (
              <button key={bc} onClick={() => selectGroup(bc!)} style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer",
                background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)",
              }}>{bc}</button>
            ))}
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map((m, idx) => {
              const checked = selectedMets.includes(m.id);
              const color = peakColors[selectedMets.indexOf(m.id) % peakColors.length] || "var(--text-secondary)";
              return (
                <button key={m.id} onClick={() => toggleMet(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
                  background: checked ? color + "15" : "transparent",
                  border: `1px solid ${checked ? color + "40" : "transparent"}`,
                  cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: checked ? color : "var(--border-light)", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: checked ? color : "var(--text-primary)", fontWeight: checked ? 600 : 400 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.formula} · {m.bio_class}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedMets.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--accent)" }}>
              {selectedMets.length} analyte{selectedMets.length > 1 ? "s" : ""} selected
            </div>
          )}
        </Card>

        <Card title="LC Method">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Column</label>
              {sel(columnId, setColumnId, columns.map(c => ({ value: c.id, label: `${c.vendor} ${c.name}` })))}
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Mobile Phase</label>
              {sel(mpId, setMpId, mobilePhases.map(m => ({ value: m.id, label: m.name })))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Ion Mode</label>
                {sel(ionMode, setIonMode, [{ value: "negative", label: "Negative (−)" }, { value: "positive", label: "Positive (+)" }])}
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Instrument</label>
                {sel(instrument, setInstrument, ["Agilent 6495D","Agilent 6470","SCIEX 7500+","SCIEX 6500+","Waters Xevo TQ-S"].map(v => ({ value: v, label: v })))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Flow (mL/min)</label>
                <input type="number" value={flowRate} onChange={e => setFlowRate(+e.target.value)} step={0.05} min={0.1} max={1} style={{
                  width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
                  padding: "6px 10px", borderRadius: 6, fontSize: 12,
                }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Temp (°C)</label>
                <input type="number" value={temp} onChange={e => setTemp(+e.target.value)} step={5} min={20} max={80} style={{
                  width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
                  padding: "6px 10px", borderRadius: 6, fontSize: 12,
                }} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Gradient Program">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {gradient.map((pt, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="number" value={pt.time_min} step={0.5}
                  onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, time_min: +e.target.value } : p))}
                  style={{ width: 60, background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "4px 6px", borderRadius: 5, fontSize: 11 }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>min</span>
                <input type="number" value={pt.pct_b} step={5} min={0} max={100}
                  onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, pct_b: +e.target.value } : p))}
                  style={{ width: 55, background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "4px 6px", borderRadius: 5, fontSize: 11 }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>%B</span>
                {gradient.length > 2 && (
                  <button onClick={() => setGradient(g => g.filter((_, j) => j !== i))} style={{
                    fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer", padding: "0 4px",
                  }}>×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setGradient(g => [...g, { time_min: g[g.length - 1].time_min + 2, pct_b: 95 }])} style={{
            fontSize: 11, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent)40",
            padding: "4px 10px", borderRadius: 5, cursor: "pointer",
          }}>+ Add Point</button>
        </Card>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <input type="checkbox" id="incMRM" checked={includeMRM} onChange={e => setIncludeMRM(e.target.checked)} />
          <label htmlFor="incMRM" style={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>Include MRM transitions in results</label>
        </div>

        <button onClick={runSimulation} disabled={running || !selectedMets.length} style={{
          padding: "10px 0", background: running ? "var(--border)" : "linear-gradient(135deg, #00d4a4, #00b890)",
          color: "#0f1117", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: running ? "not-allowed" : "pointer", transition: "all 0.2s",
        }}>
          {running ? "⏳ Simulating…" : "▶ Run Simulation"}
        </button>

        {error && <div style={{ fontSize: 12, color: "var(--red)", padding: "8px 12px", background: "var(--red-dim)", borderRadius: 6 }}>{error}</div>}
      </div>

      {/* Right Panel - Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!result ? (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
            padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>🔬</div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
              Select metabolites and LC parameters,<br />then click <strong style={{ color: "var(--accent)" }}>Run Simulation</strong>
            </p>
          </div>
        ) : (
          <>
            {/* Chromatogram */}
            <Card title={`Predicted Chromatogram — ${result.column}`} extra={
              <div style={{ display: "flex", gap: 6 }}>
                <Badge text={`${result.results.length} peaks`} color="var(--accent)" />
                <Badge text={`${result.runtime_ms}ms`} color="var(--blue)" />
              </div>
            }>
              <ChromatogramSVG result={result} metabolites={[]} peakColors={peakColors} />
              {/* Legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {result.results.map((r, i) => (
                  <div key={r.metabolite_id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: peakColors[i % peakColors.length] }} />
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.metabolite_name} <span style={{ fontFamily: "monospace" }}>{r.rt_min.toFixed(2)}min</span></span>
                  </div>
                ))}
              </div>
            </Card>

            {/* RT Results Table */}
            <Card title="Predicted Retention Times & Peak Parameters">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      {["Compound","RT (min)","k","Width (min)","Tailing","Plates","Confidence"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.sort((a, b) => a.rt_min - b.rt_min).map((r, i) => (
                      <tr key={r.metabolite_id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 500, color: peakColors[result.results.indexOf(r) % peakColors.length] }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: peakColors[result.results.indexOf(r) % peakColors.length] }} />
                            {r.metabolite_name}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-primary)" }}>{r.rt_min.toFixed(3)}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.k_retention_factor.toFixed(2)}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.peak_width_min.toFixed(4)}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: r.tailing_factor > 1.5 ? "var(--amber)" : "var(--text-secondary)" }}>{r.tailing_factor.toFixed(2)}</td>
                        <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.theoretical_plates.toLocaleString()}</td>
                        <td style={{ padding: "8px 10px" }}>{confidenceBar(r.rt_confidence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Resolution Matrix */}
            {result.resolution_matrix.length > 0 && (
              <Card title="Co-Elution Risk Matrix">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {result.resolution_matrix.slice(0, 20).map((r, i) => (
                    <div key={i} style={{
                      padding: "8px 12px", borderRadius: 6,
                      background: riskColor(r.risk_level) + "15",
                      border: `1px solid ${riskColor(r.risk_level)}40`,
                    }}>
                      <div style={{ fontSize: 11, color: riskColor(r.risk_level), fontWeight: 600, marginBottom: 2 }}>
                        {r.compound_a} ↔ {r.compound_b}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        Rs = <span style={{ fontFamily: "monospace", color: riskColor(r.risk_level) }}>{r.rs.toFixed(2)}</span>
                        {" · "}{r.risk_level.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Ion Suppression */}
            {Object.keys(result.ion_suppression).length > 0 && (
              <Card title="Ion Suppression Risk">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(result.ion_suppression).map(([name, score]) => (
                    <div key={name} style={{
                      padding: "6px 12px", borderRadius: 6, display: "flex", alignItems: "center", gap: 8,
                      background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    }}>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{name}</span>
                      <div style={{ width: 50, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          width: `${score}%`, height: "100%", borderRadius: 2,
                          background: score > 60 ? "var(--red)" : score > 30 ? "var(--amber)" : "var(--green)",
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: score > 60 ? "var(--red)" : score > 30 ? "var(--amber)" : "var(--green)" }}>{score}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* MRM Transitions in results */}
            {includeMRM && result.results.some(r => r.mrm_transitions?.length) && (
              <Card title="Generated MRM Transitions">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)" }}>
                        {["Compound","Precursor m/z","Product m/z","CE (eV)","Frag V","Dwell ms","Type","RT (min)"].map(h => (
                          <th key={h} style={{ padding: "7px 8px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.flatMap(r => r.mrm_transitions || []).map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "6px 8px", fontWeight: 500, color: "var(--text-primary)" }}>{t.metabolite_name}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{t.precursor_mz}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{t.product_mz}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--accent)" }}>{t.collision_energy}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.fragmentor_voltage || "—"}</td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.dwell_time_ms || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>
                            <Badge text={t.transition_type} color={t.is_quantifier ? "var(--accent)" : "var(--blue)"} />
                          </td>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.retention_time_min?.toFixed(2) || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function confidenceBar(v: number) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${v * 100}%`, height: "100%", background: v > 0.7 ? "var(--green)" : v > 0.4 ? "var(--amber)" : "var(--red)", borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{(v * 100).toFixed(0)}%</span>
    </div>
  );
}
