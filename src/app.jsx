import { useState, useRef, useEffect } from "react";

// ─── Utility: call our backend proxy ────────────────────────────────────────
async function callBackend(endpoint, body) {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown server error" }));
    throw new Error(err.error || "Server error");
  }
  return res.json();
}

// ─── Sentiment badge component ───────────────────────────────────────────────
function SentimentBadge({ sentiment }) {
  if (!sentiment) return null;
  const map = {
    positive: { emoji: "😊", color: "#22c55e", label: "Positive" },
    negative: { emoji: "😞", color: "#ef4444", label: "Negative" },
    neutral:  { emoji: "😐", color: "#94a3b8", label: "Neutral"  },
  };
  const s = map[sentiment.toLowerCase()] ?? map.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: s.color + "22", color: s.color,
      border: `1px solid ${s.color}55`,
      borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600,
    }}>
      {s.emoji} {s.label}
    </span>
  );
}

// ─── Single chat bubble ──────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 14, animation: "fadeUp 0.3s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, marginRight: 8, marginTop: 2,
        }}>🤖</div>
      )}
      <div style={{ maxWidth: "72%" }}>
        <div style={{
          background: isUser
            ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
            : "rgba(255,255,255,0.06)",
          color: "#f1f5f9",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "10px 14px", lineHeight: 1.55, fontSize: 14,
          border: isUser ? "none" : "1px solid rgba(255,255,255,0.08)",
          whiteSpace: "pre-wrap",
        }}>
          {msg.content}
        </div>
        {msg.sentiment && (
          <div style={{ marginTop: 5, paddingLeft: isUser ? 0 : 4, textAlign: isUser ? "right" : "left" }}>
            <SentimentBadge sentiment={msg.sentiment} />
          </div>
        )}
        <div style={{
          fontSize: 11, color: "#64748b", marginTop: 4,
          textAlign: isUser ? "right" : "left", paddingLeft: isUser ? 0 : 4,
        }}>
          {msg.time}
        </div>
      </div>
      {isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg,#f59e0b,#ef4444)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, marginLeft: 8, marginTop: 2,
        }}>👤</div>
      )}
    </div>
  );
}

// ─── Loading dots ─────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 14px", alignItems: "center" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#6366f1", display: "inline-block",
          animation: `bounce 1.2s ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages]   = useState([
    {
      id: 0, role: "assistant",
      content: "Hey there! 👋 I'm your AI assistant. Type anything — I'll reply AND analyze the sentiment of what you write!",
      time: now(), sentiment: null,
    },
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [tab, setTab]             = useState("chat"); // "chat" | "sentiment"
  const [saInput, setSaInput]     = useState("");
  const [saResult, setSaResult]   = useState(null);
  const [saLoading, setSaLoading] = useState(false);
  const [saError, setSaError]     = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Input validation ──────────────────────────────────────────────────────
  function validateChat(text) {
    if (!text.trim()) return "Please type a message.";
    if (text.trim().length < 2) return "Message is too short.";
    if (text.length > 2000) return "Message must be under 2000 characters.";
    return null;
  }

  function validateSA(text) {
    if (!text.trim()) return "Please enter some text to analyze.";
    if (text.trim().length < 3) return "Text is too short to analyze.";
    if (text.length > 3000) return "Text must be under 3000 characters.";
    return null;
  }

  // ── Send chat message ─────────────────────────────────────────────────────
  async function sendMessage() {
    const err = validateChat(input);
    if (err) { setError(err); return; }
    setError("");

    const userMsg = {
      id: Date.now(), role: "user",
      content: input.trim(), time: now(), sentiment: null,
    };
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Single backend call: get reply + sentiment of user message
      const data = await callBackend("chat", {
        message: userMsg.content,
        history,
      });

      // Attach sentiment to user bubble
      setMessages(prev =>
        prev.map(m => m.id === userMsg.id ? { ...m, sentiment: data.userSentiment } : m)
      );

      // Add assistant reply
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1, role: "assistant",
          content: data.reply, time: now(), sentiment: null,
        },
      ]);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Standalone sentiment analysis ─────────────────────────────────────────
  async function analyzeSentiment() {
    const err = validateSA(saInput);
    if (err) { setSaError(err); return; }
    setSaError(""); setSaResult(null); setSaLoading(true);
    try {
      const data = await callBackend("sentiment", { text: saInput });
      setSaResult(data);
    } catch (e) {
      setSaError(e.message || "Analysis failed.");
    } finally {
      setSaLoading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Space Grotesk', sans-serif; background: #0a0f1e; color: #f1f5f9; height: 100dvh; overflow: hidden; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,80%,100% { transform:scale(0.6); } 40% { transform:scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        textarea, input { font-family: inherit; }
      `}</style>

      <div style={{
        display: "flex", flexDirection: "column", height: "100dvh",
        maxWidth: 720, margin: "0 auto", padding: "0 0",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "18px 24px 14px",
          background: "rgba(15,23,42,0.9)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          }}>✨</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.3px" }}>NeuralChat</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>AI Chatbot + Sentiment Analysis · Powered by Claude</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {["chat","sentiment"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit", transition: "all .2s",
                background: tab === t ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.06)",
                color: tab === t ? "#fff" : "#94a3b8",
              }}>{t === "chat" ? "💬 Chat" : "🔍 Analyze"}</button>
            ))}
          </div>
        </div>

        {/* ── Chat Tab ── */}
        {tab === "chat" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {messages.map(m => <Bubble key={m.id} msg={m} />)}
              {loading && (
                <div style={{ display: "flex", marginBottom: 14 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, marginRight: 8,
                  }}>🤖</div>
                  <div style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px 18px 18px 4px",
                  }}>
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{
              padding: "14px 24px 20px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(15,23,42,0.9)", backdropFilter: "blur(12px)",
            }}>
              {error && (
                <div style={{
                  background: "#ef444420", border: "1px solid #ef444440",
                  color: "#f87171", borderRadius: 10, padding: "8px 12px",
                  fontSize: 13, marginBottom: 10,
                }}>⚠️ {error}</div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 14, padding: "10px 14px", color: "#f1f5f9",
                    fontSize: 14, resize: "none", outline: "none",
                    transition: "border-color .2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading}
                  style={{
                    width: 48, height: 48, borderRadius: 14, border: "none",
                    background: loading ? "#334155" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    color: "#fff", fontSize: 20, cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    alignSelf: "flex-end", transition: "opacity .2s",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading
                    ? <span style={{ width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                    : "➤"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 6, textAlign: "right" }}>
                {input.length}/2000
              </div>
            </div>
          </>
        )}

        {/* ── Sentiment Tab ── */}
        {tab === "sentiment" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>🔍 Sentiment Analyzer</h2>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
              Paste any text below to get a detailed sentiment breakdown.
            </p>

            <textarea
              value={saInput}
              onChange={e => setSaInput(e.target.value)}
              placeholder="Paste text here to analyze sentiment… e.g. a review, tweet, paragraph…"
              rows={6}
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14, padding: "12px 14px", color: "#f1f5f9",
                fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit",
              }}
              onFocus={e => e.target.style.borderColor = "#6366f1"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "#475569" }}>{saInput.length}/3000</span>
              {saError && <span style={{ fontSize: 13, color: "#f87171" }}>⚠️ {saError}</span>}
            </div>

            <button
              onClick={analyzeSentiment}
              disabled={saLoading}
              style={{
                padding: "12px 28px", borderRadius: 12, border: "none", fontFamily: "inherit",
                background: saLoading ? "#334155" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff", fontWeight: 600, fontSize: 14, cursor: saLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {saLoading && <span style={{ width: 16, height: 16, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
              {saLoading ? "Analyzing…" : "Analyze Sentiment"}
            </button>

            {saResult && (
              <div style={{
                marginTop: 24, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: 20, animation: "fadeUp .4s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <SentimentBadge sentiment={saResult.sentiment} />
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>
                    Confidence: <strong style={{ color: "#f1f5f9" }}>{saResult.confidence}</strong>
                  </span>
                </div>

                {/* Score bar */}
                <div style={{ marginBottom: 16 }}>
                  {[
                    { label: "Positive", score: saResult.scores?.positive ?? 0, color: "#22c55e" },
                    { label: "Neutral",  score: saResult.scores?.neutral  ?? 0, color: "#94a3b8" },
                    { label: "Negative", score: saResult.scores?.negative ?? 0, color: "#ef4444" },
                  ].map(s => (
                    <div key={s.label} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginBottom: 3 }}>
                        <span>{s.label}</span><span>{s.score}%</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${s.score}%`, height: "100%", background: s.color, borderRadius: 4, transition: "width .6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                  <strong style={{ color: "#f1f5f9" }}>Explanation:</strong> {saResult.explanation}
                </div>
                {saResult.keywords?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 7 }}>KEY PHRASES</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {saResult.keywords.map((k, i) => (
                        <span key={i} style={{
                          background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                          border: "1px solid rgba(99,102,241,0.3)",
                          borderRadius: 20, padding: "3px 10px", fontSize: 12,
                        }}>{k}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
