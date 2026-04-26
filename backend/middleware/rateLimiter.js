import rateLimit from 'express-rate-limit';

/**
 * Rate limiter: max 60 requests per minute per IP
 * (raised from 10 — the polling loop needs enough headroom)
 */
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: 'Too many requests. Please wait a moment and try again.',
    retryAfter: 60,
  },
  handler: (req, res, next, options) => {
    console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(options.message);
  },
});
