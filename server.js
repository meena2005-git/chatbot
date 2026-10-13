
require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Groq using a secret environment variable.
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })
  : null;

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
    limit: 10,
      standardHeaders: true,
        legacyHeaders: false,
          validate: {
              xForwardedForHeader: false,
                },
                });


// Check whether the backend is running.
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    aiConfigured: Boolean(groq),
  });
});

// Chat with Groq AI.
app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    if (!groq) {
      return res.status(503).json({
        error: "Groq API key is not configured.",
      });
    }

    const messages = req.body?.messages;

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 20
    ) {
      return res.status(400).json({
        error: "Please send between 1 and 20 messages.",
      });
    }

    const valid = messages.every(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0 &&
        message.content.length <= 4000
    );

    if (!valid || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({
        error: "Invalid chat messages.",
      });
    }

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are SmartBot, a friendly AI assistant. Give helpful, clear and accurate answers.",
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      max_tokens: 700,
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content;

    return res.json({
      reply: reply || "Sorry, I could not generate a reply.",
    });
  } catch (error) {
    console.error("Groq API error:", error.status || error.message);

    return res.status(500).json({
      error: "Unable to get an AI reply. Please try again.",
    });
  }
});

// Return a JSON error for unknown API routes.
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API route not found.",
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SmartBot running on port ${PORT}`);
  });
}

module.exports = app;
