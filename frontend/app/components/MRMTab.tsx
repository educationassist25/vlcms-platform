"use client";
import { useState } from "react";
import { api, type Metabolite, type Column, type MobilePhase, type MRMResult, type MRMTransition } from "../lib/api";

interface Props { metabolites: Metabolite[]; columns: Column[]; mobilePhases: MobilePhase[]; peakColors: string[]; }

function Card({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export default function MRMTab({ metabolites, peakColors }: Props) {
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [ionMode, setIonMode] = useState("negative");
  const [instrument, setInstrument] = useState("Agilent 6495D");
  const [rtWindow, setRtWindow] = useState(1.0);
  const [result, setResult] = useState<MRMResult | null>(null);
  const [scheduled, setScheduled] = useState<{ total_transitions: number; transitions: MRMTransition[] } | null>(null);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [filterQuant, setFilterQuant] = useState(false);

  const filtered = metabolites.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id: string) => setSelectedMets(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const generate = async () => {
    if (!selectedMets.length) return;
    setRunning(true); setResult(null); setScheduled(null);
    try {
      const res = await api.generateMRM({ metabolite_ids: selectedMets, ion_mode: ionMode, instrument, rt_window_min: rtWindow });
      setResult(res);
      const sched = await api.scheduledMRM({ metabolite_ids: selectedMets, ion_mode: ionMode, instrument, rt_window_min: rtWindow });
      setScheduled(sched);
    } finally { setRunning(false); }
  };

  const exportCSV = () => {
    if (!result) return;
    const rows = [["Compound","Precursor m/z","Product m/z","CE (eV)","Fragmentor V","CAV","Dwell (ms)","Type","RT (min)","RT Start","RT End"]];
    result.method.forEach(m => m.transitions.forEach(t => {
      rows.push([t.metabolite_name, String(t.precursor_mz), String(t.product_mz), String(t.collision_energy),
        String(t.fragmentor_voltage || ""), String(t.cell_accelerator_voltage || ""),
        String(t.dwell_time_ms || ""), t.transition_type,
        String(t.retention_time_min || ""), String((t as any).rt_window_start || ""), String((t as any).rt_window_end || "")]);
    }));
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `mrm_method_${instrument.replace(/ /g,"_")}.csv`; a.click();
  };

  const allTransitions = result?.method.flatMap(m => m.transitions) || [];
  const displayTransitions = filterQuant ? allTransitions.filter(t => t.is_quantifier) : allTransitions;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
      {/* Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title="Select Metabolites">
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{
            width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
            padding: "7px 10px", borderRadius: 6, fontSize: 12, marginBottom: 8,
          }} />
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map((m, i) => {
              const checked = selectedMets.includes(m.id);
              const color = peakColors[i % peakColors.length];
              return (
                <button key={m.id} onClick={() => toggle(m.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
                  background: checked ? color + "15" : "transparent", border: `1px solid ${checked ? color + "40" : "transparent"}`,
                  cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: checked ? color : "var(--border-light)" }} />
                  <div>
                    <div style={{ fontSize: 12, color: checked ? color : "var(--text-primary)", fontWeight: checked ? 600 : 400 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.exact_mass?.toFixed(4)} Da · {m.bio_class}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="Instrument Settings">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Instrument</label>
              <select value={instrument} onChange={e => setInstrument(e.target.value)} style={{
                background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
                padding: "6px 10px", borderRadius: 6, fontSize: 12, width: "100%",
              }}>
                {["Agilent 6495D","Agilent 6470","SCIEX 7500+","SCIEX 6500+","Waters Xevo TQ-S"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Ion Mode</label>
              <select value={ionMode} onChange={e => setIonMode(e.target.value)} style={{
                background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
                padding: "6px 10px", borderRadius: 6, fontSize: 12, width: "100%",
              }}>
                <option value="negative">Negative (−)</option>
                <option value="positive">Positive (+)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>RT Window (±min)</label>
              <input type="number" value={rtWindow} onChange={e => setRtWindow(+e.target.value)} step={0.25} min={0.25} max={5} style={{
                width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
                padding: "6px 10px", borderRadius: 6, fontSize: 12,
              }} />
            </div>
          </div>
        </Card>

        <button onClick={generate} disabled={running || !selectedMets.length} style={{
          padding: "10px 0", background: running ? "var(--border)" : "linear-gradient(135deg, #4d9fff, #0077ff)",
          color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: running ? "not-allowed" : "pointer",
        }}>
          {running ? "⏳ Generating…" : "⚡ Generate MRM"}
        </button>
      </div>

      {/* Results */}
      <div>
        {!result ? (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
            padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>⚡</div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center" }}>
              Select metabolites and instrument,<br />then click <strong style={{ color: "var(--blue)" }}>Generate MRM</strong>
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Metabolites", value: result.n_metabolites, color: "var(--accent)" },
                { label: "Total Transitions", value: result.total_transitions, color: "var(--blue)" },
                { label: "Quantifiers", value: allTransitions.filter(t => t.is_quantifier).length, color: "var(--green)" },
                { label: "Qualifiers", value: allTransitions.filter(t => !t.is_quantifier).length, color: "var(--purple)" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Scheduled MRM info */}
            {scheduled && (
              <div style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)40", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "var(--accent)" }}>
                ✓ Scheduled MRM optimized: {scheduled.total_transitions} transitions with dynamic dwell times
              </div>
            )}

            <Card title={`MRM Transition Table — ${instrument} (${ionMode} mode)`} extra={
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setFilterQuant(f => !f)} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                  background: filterQuant ? "var(--accent-dim)" : "var(--bg-hover)", border: `1px solid ${filterQuant ? "var(--accent)" : "var(--border)"}`,
                  color: filterQuant ? "var(--accent)" : "var(--text-secondary)",
                }}>Quantifiers only</button>
                <button onClick={exportCSV} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                  background: "var(--blue-dim)", border: "1px solid var(--blue)40", color: "var(--blue)",
                }}>↓ Export CSV</button>
              </div>
            }>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      {["Compound","Adduct","Precursor m/z","Product m/z","CE","Frag V","CAV","Dwell ms","Type","RT (min)"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayTransitions.map((t, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)30" }}>
                        <td style={{ padding: "7px 10px", fontWeight: 500, color: "var(--text-primary)" }}>{t.metabolite_name}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{t.adduct}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--blue)" }}>{t.precursor_mz}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--accent)" }}>{t.product_mz}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--amber)" }}>{t.collision_energy}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.fragmentor_voltage || "—"}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.cell_accelerator_voltage || "—"}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.dwell_time_ms || "—"}</td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: t.is_quantifier ? "var(--accent-dim)" : "var(--blue-dim)", color: t.is_quantifier ? "var(--accent)" : "var(--blue)" }}>
                            {t.transition_type.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{t.retention_time_min?.toFixed(2) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
