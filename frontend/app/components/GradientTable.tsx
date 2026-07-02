"use client";
import type { GradientPoint } from "../lib/api";

interface Props {
  gradient: GradientPoint[];
  onChange: (g: GradientPoint[]) => void;
  flowRate: number;
  onFlowRateChange: (v: number) => void;
  curve?: number; // 1-9, like real instrument gradient curve shapes (5 = linear)
  onCurveChange?: (v: number) => void;
  readOnly?: boolean;
}

const CURVE_LABELS: Record<number, string> = {
  1: "Step (early)", 2: "Convex", 3: "Convex", 4: "Convex",
  5: "Linear", 6: "Concave", 7: "Concave", 8: "Concave", 9: "Step (late)",
};

export default function GradientTable({ gradient, onChange, flowRate, onFlowRateChange, curve = 5, onCurveChange, readOnly = false }: Props) {
  const addRow = () => {
    const last = gradient[gradient.length - 1];
    onChange([...gradient, { time_min: +(last.time_min + 1).toFixed(1), pct_b: last.pct_b }]);
  };
  const removeRow = (i: number) => onChange(gradient.filter((_, j) => j !== i));
  const updateRow = (i: number, field: "time_min" | "pct_b", value: number) => {
    onChange(gradient.map((p, j) => j === i ? { ...p, [field]: value } : p));
  };

  return (
    <div>
      {/* Instrument-style header row — mirrors Agilent/Waters/SCIEX method tables */}
      <div style={{ display: "grid", gridTemplateColumns: "32px 70px 1fr 90px 28px", gap: 6, marginBottom: 6, padding: "0 2px" }}>
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textAlign: "center" }}>STEP</span>
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textAlign: "center" }}>TIME (min)</span>
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textAlign: "center" }}>%A / %B COMPOSITION</span>
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textAlign: "center" }}>FLOW (mL/min)</span>
        <span />
      </div>

      <div style={{ background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
        {gradient.map((pt, i) => {
          const pctA = 100 - pt.pct_b;
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "32px 70px 1fr 90px 28px", gap: 6, alignItems: "center",
              padding: "6px 8px", borderBottom: i < gradient.length - 1 ? "1px solid var(--border)" : "none",
              background: i % 2 === 0 ? "transparent" : "var(--bg-card)30",
            }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", fontFamily: "monospace" }}>{i + 1}</span>

              <input
                type="number" value={pt.time_min} step={0.1} min={0} disabled={readOnly}
                onChange={e => updateRow(i, "time_min", +e.target.value)}
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "4px 6px", borderRadius: 5, fontSize: 11, textAlign: "center", fontFamily: "monospace" }}
              />

              {/* Composition bar — single visual bar split A/B like real instrument software */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "#4d9fff", fontFamily: "monospace", minWidth: 30, textAlign: "right" }}>{pctA}%A</span>
                <div style={{ flex: 1, height: 16, borderRadius: 4, overflow: "hidden", display: "flex", border: "1px solid var(--border)" }}>
                  <div style={{ width: `${pctA}%`, background: "#4d9fff", opacity: 0.75 }} />
                  <div style={{ width: `${pt.pct_b}%`, background: "#ffb347", opacity: 0.9 }} />
                </div>
                <input
                  type="number" value={pt.pct_b} step={1} min={0} max={100} disabled={readOnly}
                  onChange={e => updateRow(i, "pct_b", Math.max(0, Math.min(100, +e.target.value)))}
                  style={{ width: 42, background: "var(--bg-primary)", border: "1px solid #ffb34760", color: "#ffb347", padding: "3px 4px", borderRadius: 4, fontSize: 11, textAlign: "center", fontWeight: 700, fontFamily: "monospace" }}
                />
                <span style={{ fontSize: 10, color: "#ffb347", fontWeight: 600 }}>%B</span>
              </div>

              <input
                type="number" value={flowRate} step={0.05} min={0.05} max={2} disabled={readOnly || i > 0}
                onChange={e => onFlowRateChange(+e.target.value)}
                title={i > 0 ? "Flow rate set on step 1 (isocratic flow)" : "Flow rate (mL/min)"}
                style={{
                  background: i > 0 ? "var(--bg-secondary)" : "var(--bg-primary)",
                  border: "1px solid var(--border)", color: i > 0 ? "var(--text-muted)" : "var(--text-primary)",
                  padding: "4px 6px", borderRadius: 5, fontSize: 11, textAlign: "center", fontFamily: "monospace",
                  opacity: i > 0 ? 0.5 : 1,
                }}
              />

              {!readOnly && gradient.length > 2 ? (
                <button onClick={() => removeRow(i)} style={{ fontSize: 13, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>×</button>
              ) : <span />}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <button onClick={addRow} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, cursor: "pointer", background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)" }}>
            + Add step
          </button>
          {onCurveChange && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Curve:</span>
              <select value={curve} onChange={e => onCurveChange(+e.target.value)} style={{
                background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)",
                padding: "3px 6px", borderRadius: 5, fontSize: 10,
              }}>
                {[1,2,3,4,5,6,7,8,9].map(c => <option key={c} value={c}>{c} — {CURVE_LABELS[c]}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
