"use client";
import { useState, useEffect } from "react";
import { api, type Metabolite, type Column, type MobilePhase } from "./lib/api";
import SimulateTab from "./components/SimulateTab";
import MRMTab from "./components/MRMTab";
import IsotopeTab from "./components/IsotopeTab";
import CopilotTab from "./components/CopilotTab";
import MethodsTab from "./components/MethodsTab";

const TABS = ["Simulate", "MRM Workbench", "Isotope Tracer", "Methods", "AI Copilot"] as const;
type Tab = typeof TABS[number];

export const PEAK_COLORS = ["#00d4a4","#4d9fff","#ffb347","#ff6b6b","#b48cff","#57d9a3","#f06292","#80deea","#ce93d8","#a5d6a7"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Simulate");
  const [metabolites, setMetabolites] = useState<Metabolite[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [mobilePhases, setMobilePhases] = useState<MobilePhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; full_name: string } | null>(null);

  useEffect(() => {
    Promise.all([
      api.metabolites(),
      api.columns(),
      api.mobilePhases(),
      api.demoLogin().catch(() => null),
    ]).then(([mets, cols, mps, u]) => {
      setMetabolites(mets.items);
      setColumns(cols);
      setMobilePhases(mps);
      if (u) setUser({ email: u.email, full_name: u.full_name });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <header style={{
        height: 52, display: "flex", alignItems: "center", gap: 0,
        background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        padding: "0 20px", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 32 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "linear-gradient(135deg, #00d4a4, #4d9fff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#0f1117",
          }}>λ</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            Virtual <span style={{ color: "var(--accent)" }}>LC-MS</span>
          </span>
          <span style={{
            fontSize: 10, fontWeight: 500, color: "var(--accent)", background: "var(--accent-dim)",
            padding: "2px 6px", borderRadius: 4, marginLeft: 4,
          }}>BETA</span>
        </div>
        <nav style={{ display: "flex", gap: 0, flex: 1 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "0 16px", height: 52, fontSize: 13, fontWeight: 500,
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{tab}</button>
          ))}
        </nav>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #00d4a4, #4d9fff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#0f1117",
            }}>{user.full_name?.[0] || "D"}</div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{user.email}</span>
          </div>
        )}
      </header>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", flexDirection: "column", gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3px solid var(--border)", borderTopColor: "var(--accent)",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Initializing platform database…</p>
        </div>
      ) : (
        <main style={{ padding: "20px 24px", maxWidth: 1600, margin: "0 auto" }}>
          {activeTab === "Simulate" && <SimulateTab metabolites={metabolites} columns={columns} mobilePhases={mobilePhases} peakColors={PEAK_COLORS} />}
          {activeTab === "MRM Workbench" && <MRMTab metabolites={metabolites} columns={columns} mobilePhases={mobilePhases} peakColors={PEAK_COLORS} />}
          {activeTab === "Isotope Tracer" && <IsotopeTab metabolites={metabolites} />}
          {activeTab === "Methods" && <MethodsTab metabolites={metabolites} columns={columns} mobilePhases={mobilePhases} />}
          {activeTab === "AI Copilot" && <CopilotTab />}
        </main>
      )}
    </div>
  );
}
