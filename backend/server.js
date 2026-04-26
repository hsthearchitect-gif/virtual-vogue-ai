import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import generateRouter from './routes/generate.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// In local dev, load from .env — on Render, env vars are injected by the platform
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'bypass-tunnel-reminder', 'Accept'],
  credentials: false,
}));
app.options('*', cors()); // Handle preflight for all routes

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply rate limiting to API routes
app.use('/api', rateLimiter);

// ─── Routes ─────────────────────────────────────────────────
app.use('/api', generateRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: process.env.AI_PROVIDER || 'replicate' });
});

// ─── Error Handling ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ─── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Virtual Vogue AI Backend running on http://localhost:${PORT}`);
  console.log(`📡 AI Provider: HuggingFace (IDM-VTON + Leffa fallback)`);
  console.log(`🔑 Replicate token: ${process.env.REPLICATE_API_TOKEN ? '✅ set' : '❌ MISSING'}`);
  console.log(`🤗 HF token:        ${process.env.HF_TOKEN ? '✅ set' : '❌ MISSING — required!'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}\n`);
});
