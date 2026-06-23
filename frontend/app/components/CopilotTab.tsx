"use client";
import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";

interface Message { role: "user" | "assistant"; content: string; source?: string; }

const SUGGESTIONS = [
  "Which column is best for Acetyl-CoA and TCA cycle metabolites?",
  "Why is citrate not retained on RP C18 columns?",
  "How can I improve HILIC separation of glutamine vs glutamate?",
  "How can I reduce ion suppression in plasma metabolomics?",
  "What buffer should I use for negative mode polar metabolomics?",
  "Generate a complete method for 400 polar metabolites",
  "How does 13C-glucose label the TCA cycle?",
  "What collision energy should I use for organic acids in negative mode?",
];

export default function CopilotTab() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your LC-MS Metabolomics AI Copilot.\n\nI can help you with:\n• Column and mobile phase selection\n• MRM transition optimization\n• Ion suppression troubleshooting\n• Stable isotope tracing strategy\n• Metabolomics method development\n\nWhat would you like to know?",
      source: "Virtual LC-MS Copilot",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await api.ask(q);
      setMessages(m => [...m, { role: "assistant", content: res.answer, source: res.source }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: "I'm having trouble connecting to the AI service. Please ensure the backend is running.", source: "Error" }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, height: "calc(100vh - 120px)", maxHeight: 780 }}>
      {/* Suggestions Panel */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Suggested Questions</span>
        </div>
        <div style={{ padding: 10, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => ask(s)} style={{
              padding: "8px 10px", borderRadius: 7, textAlign: "left", cursor: "pointer",
              background: "var(--bg-hover)", border: "1px solid var(--border)",
              color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.4,
              transition: "all 0.15s",
            }} onMouseEnter={e => { (e.target as HTMLElement).style.background = "var(--accent-dim)"; (e.target as HTMLElement).style.color = "var(--accent)"; (e.target as HTMLElement).style.borderColor = "var(--accent)60"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "var(--bg-hover)"; (e.target as HTMLElement).style.color = "var(--text-secondary)"; (e.target as HTMLElement).style.borderColor = "var(--border)"; }}>
              {s}
            </button>
          ))}
        </div>

        {/* Model info */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>POWERED BY</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
            Claude Sonnet + RAG
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Metabolomics knowledge base</div>
        </div>
      </div>

      {/* Chat Panel */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, #00d4a4, #4d9fff)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
          }}>🔬</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>LC-MS Copilot</div>
            <div style={{ fontSize: 11, color: "var(--accent)" }}>● Online</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && (
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #00d4a4, #4d9fff)", flexShrink: 0, marginRight: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>λ</div>
              )}
              <div style={{ maxWidth: "80%" }}>
                <div style={{
                  padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "2px 12px 12px 12px",
                  background: msg.role === "user" ? "linear-gradient(135deg, #00d4a4, #00b890)" : "var(--bg-secondary)",
                  border: msg.role === "user" ? "none" : "1px solid var(--border)",
                  color: msg.role === "user" ? "#0f1117" : "var(--text-primary)",
                  fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>
                {msg.source && msg.role === "assistant" && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, paddingLeft: 4 }}>Source: {msg.source}</div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #00d4a4, #4d9fff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>λ</div>
              <div style={{ padding: "12px 16px", borderRadius: "2px 12px 12px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{
                      width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
                      animation: `bounce 1.2s ease-in-out ${j * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && ask(input)}
            placeholder="Ask about column selection, MRM optimization, ion suppression, isotope tracing…"
            disabled={loading}
            style={{
              flex: 1, background: "var(--bg-secondary)", border: "1px solid var(--border)",
              color: "var(--text-primary)", padding: "10px 14px", borderRadius: 8, fontSize: 13,
              outline: "none",
            }}
          />
          <button onClick={() => ask(input)} disabled={loading || !input.trim()} style={{
            padding: "10px 16px", background: input.trim() && !loading ? "var(--accent)" : "var(--border)",
            color: input.trim() && !loading ? "#0f1117" : "var(--text-muted)",
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
            transition: "all 0.15s",
          }}>Send</button>
        </div>
      </div>
    </div>
  );
}
