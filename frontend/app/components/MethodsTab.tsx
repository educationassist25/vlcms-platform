"use client";
import { useState, useEffect } from "react";
import { api, type Metabolite, type Column, type MobilePhase, type SavedMethod, type GradientPoint } from "../lib/api";

interface Props { metabolites: Metabolite[]; columns: Column[]; mobilePhases: MobilePhase[]; }

const DEFAULT_GRADIENT: GradientPoint[] = [
  { time_min: 0, pct_b: 5 },
  { time_min: 10, pct_b: 95 },
  { time_min: 12, pct_b: 95 },
];

const PRESET_METHODS = [
  {
    name: "TCA Cycle — ZIC-pHILIC Neg Mode",
    description: "Gold-standard HILIC method for TCA cycle polar metabolites. ZIC-pHILIC 150×2.1mm with 5mM ammonium acetate.",
    instrument: "Agilent 6495D", ion_mode: "negative",
    gradient: [{ time_min: 0, pct_b: 90 }, { time_min: 15, pct_b: 40 }, { time_min: 17, pct_b: 40 }],
    flow_rate_ml_min: 0.15, temperature_c: 25,
  },
  {
    name: "Lipidomics — CSH C18 Pos/Neg Mode",
    description: "Waters CSH C18 for lipidomics. Excellent phospholipid, sphingomyelin, TG separation. pH 9 mobile phase.",
    instrument: "Waters Xevo TQ-S", ion_mode: "positive",
    gradient: [{ time_min: 0, pct_b: 60 }, { time_min: 2, pct_b: 85 }, { time_min: 12, pct_b: 99 }, { time_min: 14, pct_b: 99 }],
    flow_rate_ml_min: 0.4, temperature_c: 55,
  },
  {
    name: "Amino Acids — HSS T3 Neg Mode",
    description: "Waters HSS T3 for amino acids and organic acids in negative mode. 10mM ammonium formate pH 3.0.",
    instrument: "SCIEX 7500+", ion_mode: "negative",
    gradient: [{ time_min: 0, pct_b: 2 }, { time_min: 8, pct_b: 95 }, { time_min: 10, pct_b: 95 }],
    flow_rate_ml_min: 0.4, temperature_c: 40,
  },
  {
    name: "Untargeted Metabolomics — BEH C18 Dual Mode",
    description: "Waters BEH C18 broad coverage method. 10mM ammonium acetate pH 6.8. Run in both pos and neg mode.",
    instrument: "Thermo Exploris", ion_mode: "negative",
    gradient: [{ time_min: 0, pct_b: 5 }, { time_min: 10, pct_b: 95 }, { time_min: 12, pct_b: 95 }],
    flow_rate_ml_min: 0.4, temperature_c: 40,
  },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export default function MethodsTab({ columns, mobilePhases }: Props) {
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState(columns[0]?.id || "");
  const [mpId, setMpId] = useState(mobilePhases[0]?.id || "");
  const [instrument, setInstrument] = useState("Agilent 6495D");
  const [ionMode, setIonMode] = useState("negative");
  const [flowRate, setFlowRate] = useState(0.4);
  const [temp, setTemp] = useState(40);
  const [gradient, setGradient] = useState<GradientPoint[]>(DEFAULT_GRADIENT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.listMethods().then(setSavedMethods).catch(() => {});
  }, []);

  const saveMethod = async () => {
    if (!name || !columnId || !mpId) return;
    setSaving(true);
    try {
      await api.saveMethods({ name, description, instrument, column_id: columnId, mobile_phase_id: mpId, gradient_program: gradient, flow_rate_ml_min: flowRate, temperature_c: temp, ion_mode: ionMode });
      setSaved(true);
      const methods = await api.listMethods();
      setSavedMethods(methods);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const applyPreset = (preset: typeof PRESET_METHODS[0]) => {
    setName(preset.name);
    setDescription(preset.description);
    setInstrument(preset.instrument);
    setIonMode(preset.ion_mode);
    setGradient(preset.gradient);
    setFlowRate(preset.flow_rate_ml_min);
    setTemp(preset.temperature_c);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* Preset Methods */}
      <div>
        <Card title="Preset Published Methods">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PRESET_METHODS.map((pm, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{pm.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>{pm.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--accent-dim)", color: "var(--accent)" }}>{pm.instrument}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--blue-dim)", color: "var(--blue)" }}>{pm.ion_mode}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-muted)" }}>{pm.flow_rate_ml_min} mL/min · {pm.temperature_c}°C</span>
                    </div>
                  </div>
                  <button onClick={() => applyPreset(pm)} style={{
                    padding: "6px 12px", borderRadius: 6, cursor: "pointer", flexShrink: 0,
                    background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)", fontSize: 11, fontWeight: 600,
                  }}>Use</button>
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 3 }}>
                  {pm.gradient.map((pt, j) => (
                    <div key={j} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {pt.time_min}min<br />{pt.pct_b}%B
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Saved Methods */}
        <div style={{ marginTop: 16 }}>
          <Card title={`Saved Methods (${savedMethods.length})`}>
            {savedMethods.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No saved methods yet. Create one using the form →</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {savedMethods.map(m => (
                  <div key={m.id} style={{ padding: "10px 12px", borderRadius: 7, background: "var(--bg-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.instrument} · {m.ion_mode} · {m.created_at?.slice(0, 10)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create Method Form */}
      <Card title="Create New Method">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Method Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., TCA-HILIC-NEG-v1" style={{
              width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
              padding: "8px 10px", borderRadius: 6, fontSize: 12,
            }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Method notes, application, reference…" style={{
              width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
              padding: "8px 10px", borderRadius: 6, fontSize: 12, resize: "vertical",
            }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Column</label>
              <select value={columnId} onChange={e => setColumnId(e.target.value)} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 11 }}>
                {columns.map(c => <option key={c.id} value={c.id}>{c.vendor} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Mobile Phase</label>
              <select value={mpId} onChange={e => setMpId(e.target.value)} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 11 }}>
                {mobilePhases.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Instrument</label>
              <select value={instrument} onChange={e => setInstrument(e.target.value)} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 11 }}>
                {["Agilent 6495D","Agilent 6470","SCIEX 7500+","SCIEX 6500+","Waters Xevo TQ-S","Thermo Exploris"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Ion Mode</label>
              <select value={ionMode} onChange={e => setIonMode(e.target.value)} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 11 }}>
                <option value="negative">Negative</option>
                <option value="positive">Positive</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Flow Rate (mL/min)</label>
              <input type="number" value={flowRate} onChange={e => setFlowRate(+e.target.value)} step={0.05} min={0.1} max={1} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Temperature (°C)</label>
              <input type="number" value={temp} onChange={e => setTemp(+e.target.value)} step={5} min={20} max={80} style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 12 }} />
            </div>
          </div>

          {/* Gradient */}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Gradient Program</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {gradient.map((pt, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="number" value={pt.time_min} step={0.5} onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, time_min: +e.target.value } : p))} style={{ width: 65, background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "5px 7px", borderRadius: 5, fontSize: 11 }} />
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>min</span>
                  <input type="number" value={pt.pct_b} step={5} min={0} max={100} onChange={e => setGradient(g => g.map((p, j) => j === i ? { ...p, pct_b: +e.target.value } : p))} style={{ width: 55, background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "5px 7px", borderRadius: 5, fontSize: 11 }} />
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>%B</span>
                  {gradient.length > 2 && <button onClick={() => setGradient(g => g.filter((_, j) => j !== i))} style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>×</button>}
                </div>
              ))}
              <button onClick={() => setGradient(g => [...g, { time_min: g[g.length - 1].time_min + 2, pct_b: 95 }])} style={{ fontSize: 11, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent)40", padding: "4px 10px", borderRadius: 5, cursor: "pointer", alignSelf: "flex-start" }}>+ Add Point</button>
            </div>
          </div>

          <button onClick={saveMethod} disabled={saving || !name || !columnId || !mpId} style={{
            padding: "10px 0", marginTop: 4,
            background: saved ? "var(--green)" : saving ? "var(--border)" : "linear-gradient(135deg, #00d4a4, #00b890)",
            color: "#0f1117", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {saved ? "✓ Method Saved!" : saving ? "Saving…" : "💾 Save Method"}
          </button>
        </div>
      </Card>
    </div>
  );
}
