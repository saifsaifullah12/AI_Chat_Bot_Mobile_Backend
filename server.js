import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

dotenv.config();

const app = express();

// CORS
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Log every request
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} from ${req.ip} at ${new Date().toISOString()}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  console.log("🔍 Health check");
  res.json({
    status: "OK",
    message: "Server is running",
    time: new Date().toISOString()
  });
});

// Test endpoint
app.get("/test", (req, res) => {
  res.json({ msg: "Server is working!" });
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    console.log("💬 Chat message:", message);

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    // Verify API key
    if (!process.env.OPENROUTER_API_KEY) {
      console.error("❌ OPENROUTER_API_KEY not found in environment");
      return res.status(500).json({ error: "API key not configured" });
    }

    // Set streaming headers BEFORE any writes
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering
    res.flushHeaders();

    // Create OpenRouter provider
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    console.log("🚀 Starting AI stream...");

    // AI STREAM with system prompt to get plain text
    const result = streamText({
      model: openrouter("nvidia/nemotron-nano-12b-v2-vl:free"),
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant. Respond naturally in plain text without any JSON formatting, special characters, or metadata. Just provide direct, conversational responses."
        },
        {
          role: "user",
          content: message
        }
      ],
    });

    // Stream text chunks
    let chunkCount = 0;
    for await (const chunk of result.textStream) {
      chunkCount++;
      console.log(`📦 Chunk ${chunkCount}:`, chunk);
      
      // Write chunk and flush immediately
      res.write(chunk);
      
      // Force flush (some environments need this)
      if (typeof res.flush === 'function') {
        res.flush();
      }
    }

    console.log(`✅ Stream completed successfully (${chunkCount} chunks)`);
    res.end();

  } catch (error) {
    console.error("❌ Streaming error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    
    // Send error to client
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Server error", 
        details: error.message,
        type: error.name
      });
    } else {
      // If headers already sent, send error in stream
      try {
        res.write(`\n\n[ERROR: ${error.message}]`);
        res.end();
      } catch (writeError) {
        console.error("Failed to write error:", writeError);
      }
    }
  }
});

// 404
app.use((req, res) => {
  console.log("❌ Not found:", req.method, req.path);
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("🔥 Server Error:", error);
  res.status(500).json({ 
    error: "Internal server error",
    details: error.message 
  });
});

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Server started!`);
  console.log(`📌 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://192.168.1.105:${PORT}`);
  console.log(`🔧 Health: http://192.168.1.105:${PORT}/health`);
  console.log(`🔑 API Key configured: ${process.env.OPENROUTER_API_KEY ? 'YES ✅' : 'NO ❌'}`);
});