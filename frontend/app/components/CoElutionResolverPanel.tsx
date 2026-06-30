"use client";
import { useState } from "react";
import { api } from "../lib/api";

interface Strategy {
  rank: number; type: string; title: string; description: string;
  specific_action: string; predicted_rs_improvement: number;
  confidence: string; difficulty: string;
}
interface Diagnosis {
  pair: string; current_rs: number; risk_level: string;
  root_cause: string; mechanism_explanation: string;
  similarity_factors: string[]; strategies: Strategy[];
}
interface ActionPlanItem {
  priority: number; type: string; title: string; description: string;
  affects_pairs: string[]; n_pairs_resolved: number; total_impact: number;
  difficulty: string; confidence: string;
}
interface ResolverResult {
  status: string; summary: string; n_critical_pairs: number;
  diagnoses: Diagnosis[]; action_plan: ActionPlanItem[];
  global_recommendations: string[];
}

interface Props {
  metaboliteIds: string[];
  columnId: string;
  mobilePhaseId: string;
  gradient: { time_min: number; pct_b: number }[];
  flowRate: number;
  temperature: number;
  ionMode: string;
}

const DIFFICULTY_COLOR: Record<string, string> = { easy: "var(--green)", moderate: "var(--amber)", advanced: "var(--red)" };
const CONFIDENCE_COLOR: Record<string, string> = { high: "var(--accent)", medium: "var(--blue)", low: "var(--text-muted)" };
const RISK_COLOR: Record<string, string> = { critical: "#ff2d55", high: "#ff6b6b", medium: "#ffb347", low: "#00d4a4", none: "#57d9a3" };

function StrategyCard({ s }: { s: Strategy }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 8, marginBottom: 8,
      background: s.rank === 1 ? "var(--accent-dim)" : "var(--bg-secondary)",
      border: `1px solid ${s.rank === 1 ? "var(--accent)50" : "var(--border)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, flexShrink: 0,
            background: s.rank === 1 ? "var(--accent)" : "var(--border-light)",
            color: s.rank === 1 ? "#0f1117" : "var(--text-secondary)",
          }}>{s.rank}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: s.rank === 1 ? "var(--accent)" : "var(--text-primary)" }}>{s.title}</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: CONFIDENCE_COLOR[s.confidence] + "22", color: CONFIDENCE_COLOR[s.confidence], fontWeight: 600 }}>{s.confidence} confidence</span>
          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: DIFFICULTY_COLOR[s.difficulty] + "22", color: DIFFICULTY_COLOR[s.difficulty], fontWeight: 600 }}>{s.difficulty}</span>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 6 }}>{s.description}</p>
      <div style={{ padding: "6px 10px", background: "var(--bg-primary)", borderRadius: 6, borderLeft: "3px solid var(--accent)" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", marginBottom: 2, letterSpacing: "0.04em" }}>DO THIS:</div>
        <div style={{ fontSize: 11, color: "var(--text-primary)" }}>{s.specific_action}</div>
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Predicted Rs gain:</span>
        <div style={{ width: 60, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(s.predicted_rs_improvement * 80, 100)}%`, height: "100%", background: "var(--accent)" }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>+{s.predicted_rs_improvement.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function CoElutionResolverPanel({ metaboliteIds, columnId, mobilePhaseId, gradient, flowRate, temperature, ionMode }: Props) {
  const [result, setResult] = useState<ResolverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedPair, setExpandedPair] = useState<number | null>(0);
  const [error, setError] = useState("");

  const diagnose = async () => {
    if (metaboliteIds.length < 2 || !columnId || !mobilePhaseId) {
      setError("Select at least 2 metabolites, a column, and a mobile phase.");
      return;
    }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await api.post<ResolverResult>("/resolver/diagnose", {
        metabolite_ids: metaboliteIds, column_id: columnId, mobile_phase_id: mobilePhaseId,
        gradient, flow_rate_ml_min: flowRate, temperature_c: temperature, ion_mode: ionMode,
      });
      setResult(res);
      setExpandedPair(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnosis failed");
    } finally { setLoading(false); }
  };

  return (
    <div>
      {/* Trigger */}
      <div style={{
        background: "linear-gradient(135deg, #ff6b6b10, #ffb34710)", border: "1px solid #ff6b6b30", borderRadius: 10,
        padding: 16, marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              🎯 Co-Elution Diagnosis & Resolution
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Diagnoses why compounds co-elute and prescribes ranked, specific fixes — not just a problem report, an action plan.
            </div>
          </div>
          <button onClick={diagnose} disabled={loading || metaboliteIds.length < 2} style={{
            padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "var(--border)" : "linear-gradient(135deg, #ff6b6b, #ff2d55)", color: "#fff", border: "none",
            whiteSpace: "nowrap",
          }}>
            {loading ? "⏳ Diagnosing…" : "🔬 Diagnose & Fix"}
          </button>
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--red)", padding: "8px 12px", background: "var(--red-dim)", borderRadius: 6 }}>{error}</div>}
      </div>

      {result && (
        <>
          {/* Summary */}
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 14,
            background: result.status === "resolved" ? "var(--green-dim)" : "var(--red-dim)",
            border: `1px solid ${result.status === "resolved" ? "var(--green)" : "var(--red)"}40`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>{result.status === "resolved" ? "✅" : "⚠️"}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: result.status === "resolved" ? "var(--green)" : "var(--red)" }}>
                  {result.status === "resolved" ? "Method is well-optimized" : `${result.n_critical_pairs} critical co-elution(s) found`}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{result.summary}</div>
              </div>
            </div>
          </div>

          {result.status !== "resolved" && (
            <>
              {/* Global Action Plan — the headline feature */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--accent)40", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ padding: "10px 14px", background: "var(--accent-dim)", borderBottom: "1px solid var(--accent)30" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    📋 Prioritized Action Plan — Apply These In Order
                  </span>
                </div>
                <div style={{ padding: 14 }}>
                  {result.action_plan.map((item, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, padding: "10px 0",
                      borderBottom: i < result.action_plan.length - 1 ? "1px solid var(--border)" : "none",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: i === 0 ? "linear-gradient(135deg, #00d4a4, #00b890)" : "var(--bg-secondary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: i === 0 ? "#0f1117" : "var(--text-secondary)",
                        border: i === 0 ? "none" : "1px solid var(--border)",
                      }}>{item.priority}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{item.title}</span>
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600 }}>
                            Fixes {item.n_pairs_resolved} pair{item.n_pairs_resolved > 1 ? "s" : ""}
                          </span>
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: DIFFICULTY_COLOR[item.difficulty] + "22", color: DIFFICULTY_COLOR[item.difficulty], fontWeight: 600 }}>
                            {item.difficulty}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.description}</p>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                          Affects: {item.affects_pairs.join(" · ")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Global recommendations */}
              {result.global_recommendations.length > 0 && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--blue)40", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ padding: "10px 14px", background: "var(--blue-dim)", borderBottom: "1px solid var(--blue)30" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      🧭 Strategic Method Development Notes
                    </span>
                  </div>
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {result.global_recommendations.map((rec, i) => (
                      <div key={i} style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--blue)", fontSize: 13, flexShrink: 0 }}>→</span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-pair detailed diagnosis */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    🔬 Detailed Root-Cause Analysis ({result.diagnoses.length} pairs)
                  </span>
                </div>
                <div>
                  {result.diagnoses.map((d, i) => (
                    <div key={i} style={{ borderBottom: i < result.diagnoses.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <button onClick={() => setExpandedPair(expandedPair === i ? null : i)} style={{
                        width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ color: expandedPair === i ? "var(--accent)" : "var(--text-muted)", fontSize: 12 }}>{expandedPair === i ? "▼" : "▶"}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.pair}</span>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: RISK_COLOR[d.risk_level] + "20", color: RISK_COLOR[d.risk_level], fontWeight: 600 }}>
                            Rs = {d.current_rs.toFixed(2)} · {d.risk_level.toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                          {d.root_cause.replace(/_/g, " ")}
                        </span>
                      </button>
                      {expandedPair === i && (
                        <div style={{ padding: "0 14px 16px 36px" }}>
                          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10, padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                            {d.mechanism_explanation}
                          </p>
                          {d.similarity_factors.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.04em" }}>WHY THEY ARE SIMILAR</div>
                              {d.similarity_factors.map((f, j) => (
                                <div key={j} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3, display: "flex", gap: 6 }}>
                                  <span style={{ color: "var(--amber)" }}>•</span>{f}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.04em" }}>
                            RANKED RESOLUTION STRATEGIES FOR THIS PAIR
                          </div>
                          {d.strategies.map((s, j) => <StrategyCard key={j} s={s} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
