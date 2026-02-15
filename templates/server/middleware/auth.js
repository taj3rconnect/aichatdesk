const jwt = require('jsonwebtoken');
const { Role } = require('../db/models');

/**
 * Middleware to authenticate agent JWT tokens
 */
function authenticateAgent(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ error: 'Server configuration error' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.agent = decoded;
      next();
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      } else if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware factory to check if agent has required system role
 * Uses systemRole field, falls back to role for backward compat
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agentRole = req.agent.systemRole || req.agent.role;
    if (!agentRole || !allowedRoles.includes(agentRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Check if requesting agent manages any of the target agent's teams
 */
async function canManageAgent(requestingAgentId, targetAgent) {
  const requestingRole = targetAgent.systemRole || targetAgent.role;
  // Find roles where requesting agent is manager
  const managedRoles = await Role.find({ managerId: requestingAgentId, active: true });
  const managedRoleNames = managedRoles.map(r => r.name);
  // Check if target agent has any role managed by requesting agent
  const targetRoles = targetAgent.roles || [];
  return targetRoles.some(r => managedRoleNames.includes(r));
}

module.exports = { authenticateAgent, requireRole, canManageAgent };
