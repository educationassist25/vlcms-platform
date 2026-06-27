"use client";
import { useState, useEffect } from "react";
import { api, type Metabolite, type Column, type MobilePhase } from "./lib/api";
import SimulateTab from "./components/SimulateTab";
import MRMTab from "./components/MRMTab";
import IsotopeTab from "./components/IsotopeTab";
import CopilotTab from "./components/CopilotTab";
import MethodsTab from "./components/MethodsTab";
import MLTab from "./components/MLTab";

const TABS = ["Simulate","MRM Workbench","Isotope Tracer","ML Optimizer","Methods","AI Copilot"] as const;
type Tab = typeof TABS[number];
export const PEAK_COLORS = ["#00d4a4","#4d9fff","#ffb347","#ff6b6b","#b48cff","#57d9a3","#f06292","#80deea","#ce93d8","#a5d6a7"];

const TAB_ICONS: Record<string, string> = {
  "Simulate": "📈",
  "MRM Workbench": "⚡",
  "Isotope Tracer": "⚗️",
  "ML Optimizer": "🤖",
  "Methods": "💾",
  "AI Copilot": "🔬",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Simulate");
  const [metabolites, setMetabolites] = useState<Metabolite[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [mobilePhases, setMobilePhases] = useState<MobilePhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; full_name: string } | null>(null);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const [mets, cols, mps, u] = await Promise.all([
        api.metabolites(),
        api.columns(),
        api.mobilePhases(),
        api.demoLogin().catch(() => null),
      ]);
      setMetabolites(mets.items);
      setColumns(cols);
      setMobilePhases(mps);
      if (u) setUser({ email: u.email, full_name: u.full_name });
    } catch (e) {
      setError("Cannot connect to backend. Please ensure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Top Bar */}
      <header style={{
        height: 52, display: "flex", alignItems: "center",
        background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        padding: "0 20px", position: "sticky", top: 0, zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 28 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #00d4a4, #4d9fff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#0f1117",
          }}>λ</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px", lineHeight: 1.2 }}>
              Virtual <span style={{ color: "var(--accent)" }}>LC-MS</span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>METABOLOMICS SIMULATOR</div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, color: "var(--accent)", background: "var(--accent-dim)",
            padding: "2px 6px", borderRadius: 4, marginLeft: 2, letterSpacing: "0.05em",
          }}>v1.0</span>
        </div>

        {/* Tabs */}
        <nav style={{ display: "flex", gap: 0, flex: 1 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "0 14px", height: 52, fontSize: 12, fontWeight: 500,
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
              background: "none", border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span>{TAB_ICONS[tab]}</span>
              <span>{tab}</span>
              {tab === "ML Optimizer" && (
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "var(--purple-dim)", color: "var(--purple)", fontWeight: 700 }}>NEW</span>
              )}
            </button>
          ))}
        </nav>

        {/* Stats + User */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {metabolites.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "Metabolites", value: metabolites.length },
                { label: "Columns", value: columns.length },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg, #00d4a4, #4d9fff)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "#0f1117",
              }}>{user.full_name?.[0] || "D"}</div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{user.email}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", flexDirection: "column", gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3px solid var(--border)", borderTopColor: "var(--accent)",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Initializing platform database…</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Connecting to backend server</p>
        </div>
      ) : error ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>
          <button onClick={loadData} style={{ padding: "8px 20px", background: "var(--accent)", color: "#0f1117", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700 }}>Retry</button>
        </div>
      ) : (
        <main style={{ padding: "20px 24px", maxWidth: 1700, margin: "0 auto" }}>
          {activeTab === "Simulate" && (
            <SimulateTab metabolites={metabolites} columns={columns} mobilePhases={mobilePhases} peakColors={PEAK_COLORS} />
          )}
          {activeTab === "MRM Workbench" && (
            <MRMTab metabolites={metabolites} columns={columns} mobilePhases={mobilePhases} peakColors={PEAK_COLORS} />
          )}
          {activeTab === "Isotope Tracer" && (
            <IsotopeTab metabolites={metabolites} />
          )}
          {activeTab === "ML Optimizer" && (
            <MLTab metabolites={metabolites} columns={columns} mobilePhases={mobilePhases} peakColors={PEAK_COLORS} />
          )}
          {activeTab === "Methods" && (
            <MethodsTab metabolites={metabolites} columns={columns} mobilePhases={mobilePhases} />
          )}
          {activeTab === "AI Copilot" && (
            <CopilotTab />
          )}
        </main>
      )}
    </div>
  );
}
