"use client";
import { useState, useEffect } from "react";
import { api, type Metabolite, type Column, type MobilePhase, type SavedMethod, type GradientPoint } from "../lib/api";
import MetabolitePanel from "./MetabolitePanel";
import GradientTable from "./GradientTable";
import MobilePhaseSelector from "./MobilePhaseSelector";

interface Props { metabolites: Metabolite[]; columns: Column[]; mobilePhases: MobilePhase[]; }

const PRESET_METHODS = [
  { name:"HILIC TCA Panel", instrument:"Agilent 6495D", ion_mode:"negative", column:"ZIC-pHILIC", mobile_phase:"HILIC: 5 mM Ammonium Acetate / ACN", gradient:[{time_min:0,pct_b:90},{time_min:2,pct_b:90},{time_min:14,pct_b:40},{time_min:16,pct_b:40},{time_min:16.5,pct_b:90},{time_min:18,pct_b:90}], flow_rate_ml_min:0.15, temperature_c:25, classes:["TCA Cycle","Organic acids","Amino acids"] },
  { name:"RP Lipid Panel", instrument:"SCIEX 7500+", ion_mode:"positive", column:"ACQUITY UPLC CSH C18", mobile_phase:"Water + 5 mM Ammonium Formate pH 9 / MeOH", gradient:[{time_min:0,pct_b:60},{time_min:2,pct_b:85},{time_min:12,pct_b:99},{time_min:14,pct_b:99},{time_min:14.5,pct_b:60},{time_min:16,pct_b:60}], flow_rate_ml_min:0.4, temperature_c:55, classes:["Fatty acids","Lipids","Sphingolipids","Sterols"] },
  { name:"RP Amino Acid Panel", instrument:"Waters Xevo TQ-S", ion_mode:"positive", column:"ACQUITY UPLC HSS T3", mobile_phase:"Water + 0.1% Formic Acid / ACN", gradient:[{time_min:0,pct_b:2},{time_min:1,pct_b:2},{time_min:10,pct_b:60},{time_min:12,pct_b:60},{time_min:12.5,pct_b:2},{time_min:14,pct_b:2}], flow_rate_ml_min:0.4, temperature_c:40, classes:["Amino acids","Neurotransmitters"] },
  { name:"Nucleotide Panel", instrument:"Agilent 6495D", ion_mode:"negative", column:"ACQUITY UPLC BEH Amide", mobile_phase:"HILIC: 5 mM Ammonium Formate / ACN", gradient:[{time_min:0,pct_b:85},{time_min:2,pct_b:85},{time_min:12,pct_b:40},{time_min:14,pct_b:40},{time_min:14.5,pct_b:85},{time_min:16,pct_b:85}], flow_rate_ml_min:0.2, temperature_c:30, classes:["Nucleotides","Cofactors","Purines"] },
];

function Card({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden", marginBottom:12 }}>
      <div style={{ padding:"9px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:11, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.07em" }}>{title}</span>
        {extra}
      </div>
      <div style={{ padding:12 }}>{children}</div>
    </div>
  );
}

export default function MethodsTab({ metabolites, columns, mobilePhases }: Props) {
  const PEAK_COLORS = ["#00d4a4","#4d9fff","#ffb347","#ff6b6b","#b48cff","#57d9a3"];
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [selectedMets, setSelectedMets] = useState<string[]>([]);
  const [colId, setColId] = useState(columns[0]?.id || "");
  const [mpId, setMpId] = useState(mobilePhases[0]?.id || "");
  const [gradient, setGradient] = useState<GradientPoint[]>([{time_min:0,pct_b:5},{time_min:1,pct_b:5},{time_min:9,pct_b:95},{time_min:11,pct_b:95},{time_min:11.5,pct_b:5},{time_min:13,pct_b:5}]);
  const [flowRate, setFlowRate] = useState(0.4);
  const [temp, setTemp] = useState(40);
  const [ionMode, setIonMode] = useState("negative");
  const [instrument, setInstrument] = useState("Agilent 6495D");
  const [methodName, setMethodName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const currentCol = columns.find(c => c.id === colId);

  useEffect(() => {
    api.listMethods().then(setSavedMethods).catch(() => {});
  }, []);

  const saveMethod = async () => {
    if (!methodName.trim() || !colId || !mpId) return;
    setSaving(true); setSaveMsg("");
    try {
      await api.saveMethods({ name: methodName, description, instrument, column_id: colId, mobile_phase_id: mpId, gradient_program: gradient, flow_rate_ml_min: flowRate, temperature_c: temp, ion_mode: ionMode });
      setSaveMsg("✓ Method saved successfully");
      const updated = await api.listMethods();
      setSavedMethods(updated);
    } catch { setSaveMsg("Failed to save method"); }
    finally { setSaving(false); }
  };

  const loadPreset = (p: typeof PRESET_METHODS[0]) => {
    setInstrument(p.instrument);
    setIonMode(p.ion_mode);
    setGradient(p.gradient);
    setFlowRate(p.flow_rate_ml_min);
    setTemp(p.temperature_c);
    const col = columns.find(c => c.name.includes(p.column.split(" ").pop() || ""));
    if (col) setColId(col.id);
    const mp = mobilePhases.find(m => m.name.includes(p.mobile_phase.split(":")[0].trim().slice(0,10)));
    if (mp) setMpId(mp.id);
    setMethodName(p.name);
    setDescription(`Preset: ${p.classes.join(", ")}`);
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:14, alignItems:"start" }}>
      {/* Left */}
      <div>
        <MetabolitePanel metabolites={metabolites} selectedIds={selectedMets} onChange={setSelectedMets} peakColors={PEAK_COLORS} maxHeight={200} />

        <Card title="Method Name">
          <input value={methodName} onChange={e => setMethodName(e.target.value)} placeholder="e.g. TCA Cycle HILIC v2" style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"8px 10px", borderRadius:6, fontSize:12, marginBottom:8 }} />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-secondary)", padding:"7px 10px", borderRadius:6, fontSize:12 }} />
        </Card>

        <Card title="Instrument">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div>
              <label style={{ fontSize:10, color:"var(--text-muted)", display:"block", marginBottom:3 }}>Platform</label>
              <select value={instrument} onChange={e => setInstrument(e.target.value)} style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"6px 8px", borderRadius:6, fontSize:11 }}>
                {["Agilent 6495D","Agilent 6470","SCIEX 7500+","SCIEX 6500+","Waters Xevo TQ-S"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:"var(--text-muted)", display:"block", marginBottom:3 }}>Ion Mode</label>
              <select value={ionMode} onChange={e => setIonMode(e.target.value)} style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"6px 8px", borderRadius:6, fontSize:11 }}>
                <option value="negative">Negative (−)</option>
                <option value="positive">Positive (+)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:"var(--text-muted)", display:"block", marginBottom:3 }}>Temp (°C)</label>
              <input type="number" value={temp} onChange={e => setTemp(+e.target.value)} step={5} min={20} max={80} style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"6px 8px", borderRadius:6, fontSize:11 }} />
            </div>
          </div>
        </Card>

        <Card title="Column">
          <select value={colId} onChange={e => setColId(e.target.value)} style={{ width:"100%", background:"var(--bg-primary)", border:"1px solid var(--border)", color:"var(--text-primary)", padding:"7px 10px", borderRadius:6, fontSize:12, marginBottom:8 }}>
            {columns.map(c => <option key={c.id} value={c.id}>{c.vendor} {c.name}</option>)}
          </select>
          {currentCol && (
            <div style={{ fontSize:11, color:"var(--text-muted)", padding:"6px 10px", background:"var(--bg-secondary)", borderRadius:6 }}>
              {currentCol.mode} · {currentCol.chemistry} · {currentCol.particle_size_um}μm · {currentCol.length_mm}×{currentCol.id_mm}mm
            </div>
          )}
        </Card>

        <button onClick={saveMethod} disabled={saving || !methodName.trim()} style={{
          width:"100%", padding:"10px 0", background: saving ? "var(--border)" : "linear-gradient(135deg, #00d4a4, #00b890)",
          color:"#0f1117", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor: saving ? "not-allowed" : "pointer",
        }}>{saving ? "Saving…" : "💾 Save Method"}</button>
        {saveMsg && <div style={{ marginTop:8, fontSize:12, padding:"6px 12px", background:"var(--accent-dim)", borderRadius:6, color:"var(--accent)" }}>{saveMsg}</div>}
      </div>

      {/* Right */}
      <div>
        {/* Preset methods */}
        <Card title="Preset Methods — Click to Load">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {PRESET_METHODS.map(p => (
              <button key={p.name} onClick={() => loadPreset(p)} style={{
                padding:"12px 14px", borderRadius:8, textAlign:"left", cursor:"pointer",
                background:"var(--bg-secondary)", border:"1px solid var(--border)",
                transition:"all 0.15s",
              }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--accent)", marginBottom:4 }}>{p.name}</div>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:3 }}>{p.instrument} · {p.ion_mode} mode</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                  {p.classes.slice(0,3).map(c => (
                    <span key={c} style={{ fontSize:9, padding:"1px 5px", borderRadius:3, background:"var(--accent-dim)", color:"var(--accent)" }}>{c}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Mobile Phase — A1/B1 reservoir style */}
        <Card title="Mobile Phase — A1 / B1 Reservoirs">
          <MobilePhaseSelector mobilePhases={mobilePhases} selectedId={mpId} onSelect={setMpId} />
        </Card>

        {/* Gradient table — instrument style */}
        <Card title="Binary Gradient Program" extra={
          <div style={{ display:"flex", gap:4 }}>
            {[
              { l:"RP", g:[{time_min:0,pct_b:5},{time_min:1,pct_b:5},{time_min:9,pct_b:95},{time_min:11,pct_b:95},{time_min:11.5,pct_b:5},{time_min:13,pct_b:5}] },
              { l:"HILIC", g:[{time_min:0,pct_b:90},{time_min:2,pct_b:90},{time_min:14,pct_b:40},{time_min:16,pct_b:40},{time_min:16.5,pct_b:90},{time_min:18,pct_b:90}] },
              { l:"Lipid", g:[{time_min:0,pct_b:60},{time_min:2,pct_b:85},{time_min:12,pct_b:99},{time_min:14,pct_b:99},{time_min:14.5,pct_b:60},{time_min:16,pct_b:60}] },
            ].map(p => (
              <button key={p.l} onClick={() => setGradient(p.g)} style={{ fontSize:10, padding:"2px 8px", borderRadius:4, cursor:"pointer", background:"var(--bg-hover)", border:"1px solid var(--border)", color:"var(--text-secondary)" }}>{p.l}</button>
            ))}
          </div>
        }>
          <GradientTable gradient={gradient} onChange={setGradient} flowRate={flowRate} onFlowRateChange={setFlowRate} curve={5} onCurveChange={() => {}} />
        </Card>

        {/* Saved methods */}
        {savedMethods.length > 0 && (
          <Card title={`Saved Methods (${savedMethods.length})`}>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {savedMethods.map((m, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:"var(--bg-secondary)", borderRadius:7, border:"1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)" }}>{m.name}</div>
                    <div style={{ fontSize:10, color:"var(--text-muted)" }}>{m.instrument} · {m.ion_mode} · {new Date(m.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:4, background:"var(--accent-dim)", color:"var(--accent)" }}>Saved</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
