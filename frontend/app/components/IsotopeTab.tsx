"use client";
import { useState, useEffect } from "react";
import { api, type Metabolite, type Tracer, type IsotopeResult } from "../lib/api";
import MetabolitePanel from "./MetabolitePanel";

interface Props { metabolites: Metabolite[]; peakColors: string[]; }

function Card({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function MIDBarChart({ mid, label, color }: { mid: number[]; label: string; color: string }) {
  const max = Math.max(...mid, 0.01);
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
        {mid.map((v, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
            <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace" }}>{(v * 100).toFixed(1)}</span>
            <div style={{ width: "100%", background: color, borderRadius: "2px 2px 0 0", height: `${(v / max) * 64}px`, minHeight: v > 0 ? 2 : 0, opacity: 0.85 }} />
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>M+{i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IsotopeTab({ metabolites, peakColors }: Props) {
  const [tracers, setTracers] = useState<Tracer[]>([]);
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [tracer, setTracer] = useState("13C-glucose");
  const [ionMode, setIonMode] = useState("negative");
  const [result, setResult] = useState<IsotopeResult | null>(null);
  const [running, setRunning] = useState(false);
  const COLORS = ["#00d4a4","#4d9fff","#ffb347","#ff6b6b","#b48cff","#57d9a3","#f06292","#80deea"];

  useEffect(() => { api.tracers().then(setTracers).catch(() => {}); }, []);

  const run = async () => {
    if (!selectedMets.length) return;
    setRunning(true); setResult(null);
    try {
      const res = await api.isotopologues({ metabolite_ids: selectedMets, tracer, ion_mode: ionMode });
      setResult(res);
    } finally { setRunning(false); }
  };

  const selTracer = tracers.find(t => t.key === tracer);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>
      {/* Controls */}
      <div>
        <Card title="Tracer Selection">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tracers.map(t => (
              <button key={t.key} onClick={() => setTracer(t.key)} style={{
                padding: "10px 12px", borderRadius: 8, textAlign: "left", cursor: "pointer",
                background: tracer === t.key ? "var(--accent-dim)" : "var(--bg-hover)",
                border: `1px solid ${tracer === t.key ? "var(--accent)60" : "var(--border)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: tracer === t.key ? "var(--accent)" : "var(--text-primary)", marginBottom: 2 }}>{t.description}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {t.heavy_isotope === 13 ? "¹³C" : t.heavy_isotope === 15 ? "¹⁵N" : "²H"} tracer · {t.applications[0]}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {selTracer && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>APPLICATIONS</div>
            {selTracer.applications.map((a, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", padding: "2px 0" }}>• {a}</div>
            ))}
          </div>
        )}

        <MetabolitePanel metabolites={metabolites} selectedIds={selectedMets} onChange={setSelectedMets} peakColors={peakColors} maxHeight={200} />

        <Card title="Ion Mode">
          <select value={ionMode} onChange={e => setIonMode(e.target.value)} style={{
            background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
            padding: "7px 10px", borderRadius: 6, fontSize: 12, width: "100%",
          }}>
            <option value="negative">Negative mode</option>
            <option value="positive">Positive mode</option>
          </select>
        </Card>

        <button onClick={run} disabled={running || !selectedMets.length} style={{
          width: "100%", padding: "10px 0", background: running ? "var(--border)" : "linear-gradient(135deg, #b48cff, #7c4dff)",
          color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: running ? "not-allowed" : "pointer",
        }}>
          {running ? "⏳ Generating…" : `⚗ Generate Isotopologues (${selectedMets.length})`}
        </button>
      </div>

      {/* Results */}
      <div>
        {!result ? (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
            padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>⚗️</div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, textAlign: "center" }}>
              Select a tracer and metabolites,<br />then click <strong style={{ color: "var(--purple)" }}>Generate Isotopologues</strong>
            </p>
          </div>
        ) : (
          <>
            {result.results.map((r, ri) => (
              <Card key={ri} title={`${r.metabolite} — ${r.tracer_description}`} extra={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>C{r.n_carbons_metabolite} · {r.n_carbons_traced} traced</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--purple-dim)", color: "var(--purple)", fontWeight: 600 }}>
                    FE {(r.fractional_enrichment * 100).toFixed(1)}%
                  </span>
                </div>
              }>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
                  <MIDBarChart mid={r.mid_raw} label="Raw MID" color={COLORS[ri % COLORS.length]} />
                  <MIDBarChart mid={r.mid_corrected} label="Natural Abundance Corrected" color={COLORS[(ri + 3) % COLORS.length]} />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)" }}>
                        {["Label","# Labeled","m/z","MID Raw","MID Corrected","Rel. Intensity","Precursor → Product","CE"].map(h => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.isotopologues.map((iso, i) => {
                        const mrm = r.mrm_transitions[i];
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", fontWeight: 600, color: COLORS[ri % COLORS.length] }}>{iso.label}</td>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{iso.n_labeled}</td>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "var(--text-primary)" }}>{iso.mz.toFixed(4)}</td>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{(iso.mid_raw * 100).toFixed(2)}%</td>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "var(--accent)" }}>{(iso.mid_corrected * 100).toFixed(2)}%</td>
                            <td style={{ padding: "5px 8px" }}>
                              <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ width: `${iso.intensity_relative}%`, height: "100%", background: COLORS[ri % COLORS.length], borderRadius: 2 }} />
                              </div>
                            </td>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 10, color: "var(--text-secondary)" }}>
                              {mrm ? `${mrm.precursor_mz.toFixed(3)} → ${mrm.product_mz.toFixed(3)}` : "—"}
                            </td>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "var(--amber)" }}>{mrm?.collision_energy || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
