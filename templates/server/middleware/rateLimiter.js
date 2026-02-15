const rateLimit = require('express-rate-limit');

// Global rate limiter for all endpoints
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 60000) // minutes
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use IP from X-Forwarded-For if behind proxy
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  },
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health' || req.path.startsWith('/test/')
});

// Stricter rate limiter for chat endpoints (to prevent spam)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute per IP
  message: {
    error: 'You are sending messages too quickly. Please slow down.',
    retryAfter: 60
  },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  }
});

module.exports = limiter;
module.exports.chatLimiter = chatLimiter;
