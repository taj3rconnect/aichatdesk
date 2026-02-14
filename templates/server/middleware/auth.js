const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate agent JWT tokens
 * Extracts token from Authorization header, verifies it, and attaches decoded agent to req.agent
 */
function authenticateAgent(req, res, next) {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ error: 'Server configuration error' });
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach decoded payload to request
      // Payload contains: { agentId, email, role }
      req.agent = decoded;

      next();
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      } else if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      } else {
        throw err; // Re-throw to outer catch
      }
    }
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware factory to check if agent has required role
 * Usage: requireRole('admin', 'supervisor')
 * Must be used AFTER authenticateAgent middleware
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Check if agent is authenticated (should be set by authenticateAgent)
    if (!req.agent || !req.agent.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if agent's role is in allowed roles
    if (!allowedRoles.includes(req.agent.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = { authenticateAgent, requireRole };
