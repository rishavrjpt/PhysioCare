import { Anthropic } from "@anthropic-ai/sdk";

// In-memory rate limiting: userId -> [timestamps]
const userMessageTimestamps = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MESSAGES_PER_WINDOW = 60;

// Emergency triggers
const EMERGENCY_KEYWORDS = [
  "chest pain",
  "can't breathe",
  "cant breathe",
  "trouble breathing",
  "sudden numbness",
  "paralysis",
  "loss of bladder",
  "loss of bowel",
  "severe trauma",
  "broken bone",
  "unbearable pain"
];

const EMERGENCY_RESPONSE = `⚠️ This sounds like it may require urgent medical attention.
Please contact emergency services (112 in India, 911 in US) or go to the nearest hospital immediately. PhysioCare AI cannot assist with medical emergencies.`;

const SYSTEM_PROMPT = `You are PhysioCare AI, the specialized AI Physiotherapy Assistant for PhysioCare.

STRICT DOMAIN LIMITATION:
- You ONLY answer questions related to physiotherapy, physical therapy exercises, rehabilitation programs, mobility, stretches, posture, ergonomic adjustments, musculoskeletal pain relief, and sports recovery.
- If the user asks about ANY unrelated topic (for example: coding, math, general history, politics, pop culture, creative writing, cooking, or general medical diseases unrelated to physical rehab), you MUST politely refuse and state:
"I am PhysioCare AI, your Physiotherapy Assistant. I am specialized only in physiotherapy recommendations, recovery exercises, posture tips, and mobility rehabilitation. Please feel free to ask any question regarding physical therapy or your rehabilitation journey!"

STRICT FORMATTING RULES (CRITICAL):
- DO NOT USE ASTERISKS (*) OR DOUBLE ASTERISKS (**) ANYWHERE IN YOUR REPLY.
- DO NOT USE HASH SYMBOLS (#, ##, ###) FOR HEADINGS.
- Do NOT use markdown bolding (**) or italics (*).
- Output clean, readable plain text.
- For section titles or headings, simply write the title on its own line in plain text (e.g. 1. Upper Trapezius Stretch).
- For bullet points, use plain dashes (-) or numbers (1., 2., 3.).
- Keep the output completely free of any '*' and '#' characters.

PHYSIOTHERAPY RECOMMENDATION GUIDELINES:
- Provide clear, actionable physiotherapy recommendations: recommended gentle stretches/exercises, step-by-step cues, target muscle groups, suggested sets/reps or hold times, and breathing advice.
- Emphasize proper form and gradual progression.
- NEVER diagnose formal medical conditions or prescribe pharmaceutical drugs/medications.
- If a user describes acute, sharp, radiating, or severe worsening pain, tell them to stop the exercise immediately and consult their PhysioCare physiotherapist or physician.
- Always remind users that your guidance complements, but does not replace, personalized in-person clinical assessment by their licensed physiotherapist.`;

/**
 * GET /api/chat/status
 * Public endpoint to check if Cyan is configured with an active AI provider
 */
export const getStatus = (req, res) => {
  const isGemini = Boolean(process.env.GEMINI_API_KEY);
  const isAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  res.json({
    enabled: isGemini || isAnthropic,
    provider: isGemini ? "gemini" : isAnthropic ? "anthropic" : "none"
  });
};

/**
 * Stream responses using Google Gemini SSE REST API
 */
const streamGemini = async (messages, res, req) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const models = [
    process.env.CHAT_MODEL || "gemini-flash-lite-latest",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];

  // Filter unique model list
  const uniqueModels = [...new Set(models)];

  // Map messages to Gemini format: user -> "user", assistant -> "model"
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content.trim() }]
  }));

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents
  };

  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  let responseStream = null;

  for (const model of uniqueModels) {
    try {
      console.log(`[Cyan/Gemini] Trying model ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
      const resAttempt = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
      });

      console.log(`[Cyan/Gemini] Model ${model} responded with ${resAttempt.status}`);
      if (resAttempt.ok) {
        responseStream = resAttempt;
        break;
      }
      console.warn(`[Cyan/Gemini] Model ${model} returned HTTP ${resAttempt.status}`);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(`[Cyan/Gemini] Model ${model} request error:`, err.message);
    }
  }

  if (!responseStream || !responseStream.body) {
    res.write(`data: ${JSON.stringify({ error: "Cyan AI is temporarily unavailable. Please try again shortly." })}\n\n`);
    res.write("data: [DONE]\n\n");
    return res.end();
  }

  const reader = responseStream.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payloadStr = trimmed.slice(5).trim();
        if (!payloadStr) continue;

        try {
          const parsed = JSON.parse(payloadStr);
          const rawChunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawChunk) {
            const textChunk = rawChunk.replace(/[*#]/g, "");
            if (textChunk) {
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
              if (typeof res.flush === "function") res.flush();
            }
          }
        } catch {
          // Skip invalid chunk JSON
        }
      }
    }
  } catch (readErr) {
    if (readErr.name !== "AbortError") {
      console.error("[Cyan/Gemini] Stream read error:", readErr);
    }
  } finally {
    res.write("data: [DONE]\n\n");
    res.end();
  }
};

/**
 * Stream responses using Anthropic Claude SDK
 */
const streamAnthropic = async (messages, res, req) => {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model: process.env.CHAT_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({ role: m.role, content: m.content.trim() }))
    });

    stream.on("text", (textDelta) => {
      const cleanDelta = textDelta.replace(/[*#]/g, "");
      if (cleanDelta) {
        res.write(`data: ${JSON.stringify({ text: cleanDelta })}\n\n`);
      }
    });

    stream.on("end", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("error", (err) => {
      console.error("Cyan assistant Anthropic error:", err);
      res.write(`data: ${JSON.stringify({ error: "Failed to generate response." })}\n\n`);
      res.end();
    });

    req.on("close", () => {
      try {
        stream.abort();
      } catch (e) {
        // Ignore abort error
      }
    });
  } catch (error) {
    console.error("Failed to start Anthropic stream:", error);
    res.write(`data: ${JSON.stringify({ error: "Failed to generate response." })}\n\n`);
    res.end();
  }
};

/**
 * POST /api/chat/stream
 * Protected endpoint providing Server-Sent Events stream for Cyan assistant
 */
export const streamChat = async (req, res) => {
  const userId = req.user?.id || req.user?._id?.toString() || req.ip || "guest";

  const { messages } = req.body;

  // Validation
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 10) {
    return res.status(400).json({ error: "Messages must be a non-empty array with at most 10 messages." });
  }

  for (const m of messages) {
    if (!m || typeof m !== "object") {
      return res.status(400).json({ error: "Invalid message format." });
    }
    if (m.role !== "user" && m.role !== "assistant") {
      return res.status(400).json({ error: "Message role must be 'user' or 'assistant'." });
    }
    if (typeof m.content !== "string" || !m.content.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty." });
    }
    if (m.content.length > 8000) {
      m.content = m.content.slice(0, 8000);
    }
  }

  // Rate Limiting (20 messages per 10 minutes)
  const now = Date.now();
  const timestamps = (userMessageTimestamps.get(userId) || []).filter(
    ts => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    return res.status(429).json({ error: "Too many messages. Please wait a few minutes." });
  }

  timestamps.push(now);
  userMessageTimestamps.set(userId, timestamps);

  // Check last user message for critical emergencies
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  const lastUserText = lastUserMsg ? lastUserMsg.content.toLowerCase() : "";

  const isEmergency = EMERGENCY_KEYWORDS.some(kw => lastUserText.includes(kw));

  // Set SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.writeHead(200);
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  if (isEmergency) {
    res.write(`data: ${JSON.stringify({ text: EMERGENCY_RESPONSE, emergency: true })}\n\n`);
    res.write("data: [DONE]\n\n");
    return res.end();
  }

  if (process.env.GEMINI_API_KEY) {
    return streamGemini(messages, res, req);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return streamAnthropic(messages, res, req);
  }

  res.write(`data: ${JSON.stringify({ error: "Cyan AI is not configured. Please check back later." })}\n\n`);
  res.write("data: [DONE]\n\n");
  return res.end();
};
