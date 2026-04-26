import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import generateRouter from './routes/generate.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// Load env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: true, // Allow all origins for tunnel/deployment compatibility
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'bypass-tunnel-reminder'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  console.log(`📡 AI Provider: ${process.env.AI_PROVIDER || 'replicate'}`);
  console.log(`🔗 Frontend URL: ${FRONTEND_URL}\n`);
});
