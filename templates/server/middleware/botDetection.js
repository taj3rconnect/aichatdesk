// Simple bot detection middleware
// Flags suspicious patterns: missing user agent, known bot signatures, rapid requests

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

const requestCounts = new Map(); // IP -> { count, firstRequest }

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
