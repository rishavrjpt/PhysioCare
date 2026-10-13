import { useState, useRef, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../config";
import "../style/chatAssistant.css";

const INITIAL_WELCOME = {
  role: "assistant",
  content: "Hi! I'm PhysioCare AI, your Physiotherapy Assistant. I specialize in physiotherapy exercise recommendations, rehabilitation guidance, posture corrections, and mobility recovery. How can I assist your physical recovery today?"
};

const SUGGESTIONS = [
  "Physiotherapy for lower back stiffness",
  "Safe neck & shoulder stretch routine",
  "Knee rehabilitation exercise tips",
  "Desk posture & spine mobility exercises"
];

function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [messages, setMessages] = useState([INITIAL_WELCOME]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [hasEmergency, setHasEmergency] = useState(false);

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Check Cyan status on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/chat/status`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.enabled === "boolean") {
          setIsEnabled(data.enabled);
        }
      })
      .catch(() => {
        setIsEnabled(false);
      });
  }, []);

  // Auto-scroll on new message / stream chunk
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isStreaming, isWaiting, isOpen, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isStreaming) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isStreaming]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsWaiting(false);
  };

  const handleClearChat = () => {
    handleStop();
    setMessages([INITIAL_WELCOME]);
    setHasEmergency(false);
  };

  const sendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || isStreaming) return;

    setInputText("");

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setIsWaiting(true);
    setIsStreaming(true);

    const token = localStorage.getItem("patientToken") || localStorage.getItem("doctorToken") || localStorage.getItem("token");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Keep at most 6 recent valid messages for context, excluding error notices
      const payloadMessages = newMessages
        .filter(m => (m.role === "user" || m.role === "assistant") && m.content)
        .filter(m => !m.content.startsWith("Could not reach") && !m.content.startsWith("Too many messages"))
        .map(m => ({
          role: m.role,
          content: m.content.slice(0, 3000)
        }))
        .slice(-6);

      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: payloadMessages }),
        signal: controller.signal
      });

      if (!response.ok) {
        let errMsg = "";
        try {
          const errJson = await response.json();
          errMsg = errJson.error || errJson.msg;
        } catch {
          // fallback
        }
        if (response.status === 429) {
          throw new Error("Too many messages. Please wait a minute before asking again.");
        }
        throw new Error(errMsg || "Could not reach PhysioCare AI right now. Please try again later.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // Add a placeholder message for the incoming assistant reply
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      setIsWaiting(false);

      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const dataPayload = trimmed.slice(5).trim();
          if (dataPayload === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(dataPayload);
            if (parsed.emergency) {
              setHasEmergency(true);
            }
            if (parsed.text) {
              setMessages(prev => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    content: next[lastIdx].content + parsed.text,
                    isEmergency: Boolean(parsed.emergency)
                  };
                }
                return next;
              });
            } else if (parsed.error) {
              setMessages(prev => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0) {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    content: next[lastIdx].content || parsed.error
                  };
                }
                return next;
              });
            }
          } catch {
            // Non-JSON SSE line, continue
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          const errMsg = err.message || "An error occurred while getting a response.";
          if (lastIdx >= 0 && next[lastIdx].role === "assistant" && !next[lastIdx].content) {
            next[lastIdx] = { ...next[lastIdx], content: errMsg };
          } else {
            next.push({ role: "assistant", content: errMsg });
          }
          return next;
        });
      }
    } finally {
      setIsStreaming(false);
      setIsWaiting(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating Launcher ── */}
      <button
        className="chat-launcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Ask PhysioCare AI"
        title="Ask PhysioCare AI"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
        {isEnabled && <span className="chat-pulse-dot" />}
      </button>

      {/* ── Chat Drawer / Popup ── */}
      {isOpen && (
        <div className="chat-assistant-drawer" role="dialog" aria-label="PhysioCare AI Assistant">
          {/* Header */}
          <div className="chat-drawer-header">
            <div className="chat-header-profile">
              <div className="chat-avatar-wrapper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span className="chat-status-dot" />
              </div>
              <div className="chat-title-group">
                <h3>PhysioCare AI</h3>
                <p>Physiotherapy Assistant</p>
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                className="chat-header-btn"
                onClick={handleClearChat}
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button
                className="chat-header-btn"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close chat"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Medical disclaimer note */}
          <div className="chat-disclaimer">
            PhysioCare AI provides general wellness guidance, not medical diagnoses.
          </div>

          {/* Messages */}
          <div className="chat-messages-container">
            {!isEnabled && (
              <div style={{
                background: "#f0fdfa",
                border: "1px solid var(--primary-100)",
                padding: "16px",
                borderRadius: "14px",
                fontSize: "13px",
                color: "var(--text-secondary)",
                lineHeight: "1.5"
              }}>
                <strong style={{ color: "var(--primary)" }}>PhysioCare AI is currently in preview mode.</strong>
                <p style={{ margin: "6px 0 0 0" }}>
                  PhysioCare AI is currently unavailable or awaiting API key setup. Please check back later or consult your PhysioCare physiotherapist directly.
                </p>
              </div>
            )}

            {messages.map((m, idx) => {
              const isLast = idx === messages.length - 1;
              const isAssistant = m.role === "assistant";
              const cleanText = (m.content || "").replace(/[*#]/g, "");

              if (m.isEmergency) {
                return (
                  <div key={idx} className="chat-emergency-card">
                    {cleanText}
                    <div className="chat-emergency-actions">
                      <a href="tel:112" className="emergency-call-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        Call Emergency (112)
                      </a>
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className={`chat-message-row ${m.role}`}>
                  <div className="chat-bubble">
                    {cleanText}
                    {isAssistant && isLast && isStreaming && <span className="chat-cursor" />}
                  </div>
                </div>
              );
            })}

            {/* Waiting indicator */}
            {isWaiting && (
              <div className="chat-message-row assistant">
                <div className="chat-bubble" style={{ padding: "8px 12px" }}>
                  <div className="typing-dots">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}

            {/* Suggestion Chips (show when only 1 message exists) */}
            {messages.length === 1 && !isStreaming && isEnabled && (
              <div className="chat-chips-row">
                {SUGGESTIONS.map((chipText, i) => (
                  <button
                    key={i}
                    className="chat-chip"
                    onClick={() => sendMessage(chipText)}
                  >
                    {chipText}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Emergency direct notice if triggered */}
          {hasEmergency && (
            <div style={{ background: "#fee2e2", padding: "6px 16px", fontSize: "11px", color: "#991b1b", textAlign: "center", borderTop: "1px solid #fecaca" }}>
              Immediate medical assistance required. Do not wait for chat responses.
            </div>
          )}

          {/* Input Bar */}
          <div className="chat-input-bar">
            <input
              ref={inputRef}
              type="text"
              className="chat-input-field"
              placeholder="Ask about exercises, recovery, posture..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              maxLength={1000}
            />

            {isStreaming ? (
              <button
                className="chat-stop-btn"
                onClick={handleStop}
                title="Stop response"
                aria-label="Stop response"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="2"></rect>
                </svg>
              </button>
            ) : (
              <button
                className="chat-send-btn"
                onClick={() => sendMessage()}
                disabled={!inputText.trim()}
                title="Send message"
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ChatAssistant;
