/**
 * @file botDetection.js — Heuristic bot and scraper detection middleware
 * @description Uses three detection signals to identify automated/malicious traffic:
 *   1. Missing User-Agent header (production only)
 *   2. Known bot signatures in User-Agent (bot, crawl, spider, scrape, curl, wget, python-requests, postman)
 *   3. Rate-based detection: >20 requests per 10-second window from the same IP
 *
 *   Bypasses: Health check (/health) and OPTIONS preflight requests skip detection entirely.
 *
 *   Blocking policy (production only): Requests are blocked (403) only when multiple flags
 *   combine (e.g., bot UA + rapid fire, or missing UA + rapid fire). A single flag alone
 *   is logged but allowed through. In non-production environments, nothing is blocked.
 *
 *   Cleanup: Old IP tracking records are probabilistically pruned (1% chance per request)
 *   to prevent memory leaks from the in-memory Map.
 * @requires none (standalone middleware)
 */

/** @type {RegExp[]} User-Agent patterns that indicate automated/bot traffic */
const suspiciousPatterns = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /scrape/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /postman/i // Remove in dev if using Postman for testing
];

/** @type {Map<string, {count: number, firstRequest: number}>} Per-IP request tracking for rate-based detection */
const requestCounts = new Map();

/**
 * Bot detection middleware. Sets req.isBot, req.isSuspicious, req.isRapidFire flags.
 * Blocks only in production when multiple signals combine.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function botDetection(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

  // Skip health checks and OPTIONS requests
  if (req.path === '/health' || req.method === 'OPTIONS') {
    return next();
  }

  // Flag 1: Missing user agent
  if (!userAgent && process.env.NODE_ENV === 'production') {
    console.warn(`Suspicious request: no user agent from ${ip}`);
    req.isSuspicious = true;
  }

  // Flag 2: Known bot patterns in user agent
  const isBot = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  if (isBot) {
    console.warn(`Bot detected: ${userAgent} from ${ip}`);
    req.isBot = true;
  }

  // Flag 3: Rapid requests (>20 in 10 seconds)
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record) {
    requestCounts.set(ip, { count: 1, firstRequest: now });
  } else {
    const elapsed = now - record.firstRequest;

    if (elapsed < 10000) { // Within 10 seconds
      record.count++;

      if (record.count > 20) {
        console.warn(`Rapid requests detected from ${ip}: ${record.count} in ${elapsed}ms`);
        req.isRapidFire = true;
      }
    } else {
      // Reset counter after 10 seconds
      requestCounts.set(ip, { count: 1, firstRequest: now });
    }
  }

  // Clean up old records every 60 seconds
  if (Math.random() < 0.01) { // 1% chance per request
    const cutoff = now - 60000;
    for (const [key, value] of requestCounts.entries()) {
      if (value.firstRequest < cutoff) {
        requestCounts.delete(key);
      }
    }
  }

  // Block if multiple flags OR known bot in production
  if (process.env.NODE_ENV === 'production' && (
    (req.isSuspicious && req.isRapidFire) ||
    (req.isBot && req.isRapidFire)
  )) {
    return res.status(403).json({
      error: 'Access denied',
      reason: 'Suspicious activity detected'
    });
  }

  next();
}

module.exports = botDetection;
