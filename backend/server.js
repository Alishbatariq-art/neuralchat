import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

// Groq Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Chat Endpoint ──
app.post("/api/chat", async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message too long" });
  }

  try {
    const chatMessages = [
      {
        role: "system",
        content: "You are a helpful friendly AI assistant. Reply in 1-3 short paragraphs.",
      },
      ...history.slice(-10).map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const chatRes = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: chatMessages,
      max_tokens: 512,
    });

    const reply = chatRes.choices[0].message.content.trim();

    // Sentiment of user message
    const sentRes = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "Reply with EXACTLY one word: positive, negative, or neutral.",
        },
        {
          role: "user",
          content: `Classify sentiment: "${message}"`,
        },
      ],
      max_tokens: 5,
    });

    const userSentiment = sentRes.choices[0].message.content.trim().toLowerCase();

    return res.json({ reply, userSentiment });

  } catch (e) {
    console.error("Chat error:", e.message);
    return res.status(502).json({ error: "AI error. Try again." });
  }
});

// ── Sentiment Endpoint ──
app.post("/api/sentiment", async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Text is required" });
  }
  if (text.length > 3000) {
    return res.status(400).json({ error: "Text too long" });
  }

  try {
    const prompt = `Analyze sentiment of this text and reply ONLY in raw JSON (no markdown, no backticks):
Text: """${text}"""
Reply with this exact format:
{
  "sentiment": "positive" or "negative" or "neutral",
  "confidence": "High" or "Medium" or "Low",
  "scores": { "positive": 0-100, "neutral": 0-100, "negative": 0-100 },
  "explanation": "2-3 sentences",
  "keywords": ["phrase1", "phrase2"]
}
Scores must sum to 100. Raw JSON only, no extra text.`;

    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a sentiment analysis expert. Reply only with raw JSON, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
    });

    const raw = result.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return res.json(parsed);

  } catch (e) {
    console.error("Sentiment error:", e.message);
    return res.status(502).json({ error: "Analysis failed." });
  }
});

// ── Serve React Frontend (Production) ──
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
