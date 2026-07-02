"use client";
import type { MobilePhase } from "../lib/api";

interface Props {
  mobilePhases: MobilePhase[];
  selectedId: string;
  onSelect: (id: string) => void;
  recommendedId?: string;
  filterMode?: string;
}

export default function MobilePhaseSelector({ mobilePhases, selectedId, onSelect, recommendedId, filterMode }: Props) {
  const filtered = filterMode ? mobilePhases.filter(mp => !mp.mode || mp.mode === filterMode || mp.mode === "RP") : mobilePhases;
  const selected = mobilePhases.find(m => m.id === selectedId);

  return (
    <div>
      {/* Instrument-style reservoir display — A1/B1 bottle labels like real LC software */}
      {selected && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div style={{ padding: "10px 12px", background: "#4d9fff12", border: "1px solid #4d9fff35", borderRadius: 8, position: "relative" }}>
            <div style={{ position: "absolute", top: 8, right: 10, fontSize: 9, fontWeight: 800, color: "#4d9fff", background: "#4d9fff20", padding: "1px 6px", borderRadius: 3 }}>A1</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#4d9fff", marginBottom: 5, letterSpacing: "0.06em" }}>RESERVOIR A — AQUEOUS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{selected.solvent_a}</div>
            {selected.additive_a && selected.additive_a !== "None" && (
              <div style={{ fontSize: 11, color: "#4d9fff", marginTop: 3, fontFamily: "monospace" }}>+ {selected.additive_a}</div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>pH <strong style={{ color: "var(--text-secondary)" }}>{selected.ph}</strong></span>
            </div>
          </div>
          <div style={{ padding: "10px 12px", background: "#ffb34712", border: "1px solid #ffb34735", borderRadius: 8, position: "relative" }}>
            <div style={{ position: "absolute", top: 8, right: 10, fontSize: 9, fontWeight: 800, color: "#ffb347", background: "#ffb34720", padding: "1px 6px", borderRadius: 3 }}>B1</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#ffb347", marginBottom: 5, letterSpacing: "0.06em" }}>RESERVOIR B — ORGANIC</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{selected.solvent_b}</div>
            {selected.additive_b && selected.additive_b !== "None" && (
              <div style={{ fontSize: 11, color: "#ffb347", marginTop: 3, fontFamily: "monospace" }}>+ {selected.additive_b}</div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: selected.ms_compatible ? "var(--green)" : "var(--red)" }}>
                {selected.ms_compatible ? "✓ MS compatible" : "✗ Not MS compatible"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Method picker list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 220, overflowY: "auto" }}>
        {filtered.map(mp => {
          const isSelected = selectedId === mp.id;
          const isRecommended = recommendedId === mp.id;
          return (
            <button
              key={mp.id}
              onClick={() => onSelect(mp.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 7, cursor: "pointer",
                background: isSelected ? "var(--accent-dim)" : "var(--bg-secondary)",
                border: `1px solid ${isSelected ? "var(--accent)" : isRecommended ? "var(--accent)40" : "var(--border)"}`,
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: isSelected ? "var(--accent)" : "var(--border-light)" }} />
                <span style={{ fontSize: 12, color: isSelected ? "var(--accent)" : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>{mp.name}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {isRecommended && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 700 }}>AI</span>}
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "var(--bg-card)", color: "var(--text-muted)" }}>pH {mp.ph}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
