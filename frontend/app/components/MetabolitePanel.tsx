"use client";
import { useState } from "react";
import type { Metabolite } from "../lib/api";

const BIO_CLASSES = ["All","Organic acids","Amino acids","Nucleotides","Carbohydrates","Fatty acids","Acyl-CoAs","Cofactors","Phosphorylated sugars","Neurotransmitters","Bile acids","Eicosanoids","Vitamins","Antioxidants","Purines","Sterols","Sugar alcohols","Sphingolipids"];

interface Props {
  metabolites: Metabolite[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  peakColors: string[];
  maxHeight?: number;
  title?: string;
}

export default function MetabolitePanel({ metabolites, selectedIds, onChange, peakColors, maxHeight = 260, title }: Props) {
  const [search, setSearch] = useState("");
  const [bioClass, setBioClass] = useState("All");

  const filtered = metabolites.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) ||
      (m.hmdb_id || "").toLowerCase().includes(q) ||
      (m.formula || "").toLowerCase().includes(q) ||
      (m.synonyms || []).some(s => s.toLowerCase().includes(q));
    const matchClass = bioClass === "All" || m.bio_class === bioClass;
    return matchSearch && matchClass;
  });

  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  const selectAll = () => onChange(filtered.map(m => m.id));
  const clearAll = () => onChange([]);

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {title || `Analyte Panel (${selectedIds.length} selected)`}
        </span>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={selectAll} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: "var(--accent-dim)", border: "1px solid var(--accent)40", color: "var(--accent)" }}>All</button>
          <button onClick={clearAll} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer", background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Clear</button>
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <input
          placeholder="Search name / HMDB / formula / synonym…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "7px 10px", borderRadius: 6, fontSize: 12, marginBottom: 6 }}
        />
        <select
          value={bioClass}
          onChange={e => setBioClass(e.target.value)}
          style={{ width: "100%", background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 8px", borderRadius: 6, fontSize: 12, marginBottom: 8 }}
        >
          {BIO_CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{ maxHeight, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.length === 0 && (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No metabolites found</div>
          )}
          {filtered.map(m => {
            const checked = selectedIds.includes(m.id);
            const color = checked ? peakColors[selectedIds.indexOf(m.id) % peakColors.length] : "var(--border-light)";
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6,
                  background: checked ? color + "18" : "transparent",
                  border: `1px solid ${checked ? color + "50" : "transparent"}`,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: checked ? color : "var(--text-primary)", fontWeight: checked ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.formula} · {m.bio_class}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>{filtered.length}/{metabolites.length} metabolites shown</div>
      </div>
    </div>
  );
}
