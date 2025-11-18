import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { streamText, generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

dotenv.config();

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: '*', // Allow all for testing
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} from ${req.ip} at ${new Date().toISOString()}`);
  next();
});

// Health check endpoint with detailed info
app.get("/health", (req, res) => {
  console.log('✅ Health check received from:', req.ip);
  res.json({ 
    status: "OK", 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    ip: req.ip,
    endpoint: "health"
  });
});

// Test endpoint for simple response
app.get("/test", (req, res) => {
  res.json({ message: "Hello from server!" });
});

// NORMAL TEXT RESPONSE
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    console.log("💬 Chat request:", message);

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const result = await generateText({
      model: openrouter("meituan/longcat-flash-chat:free"),
      prompt: message,
    });

    console.log("🤖 AI Response:", result.text);
    res.json({ reply: result.text });
  } catch (error) {
    console.error("❌ Chat error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🔥 Server Error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  console.log('❌ Route not found:', req.method, req.path);
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Server started successfully!`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://192.168.1.105:${PORT}`);
  console.log(`🔧 Health check: http://192.168.1.105:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://192.168.1.105:${PORT}/test`);
});