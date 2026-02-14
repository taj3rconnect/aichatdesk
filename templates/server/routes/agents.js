const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Agent } = require('../db/models');
const { authenticateAgent, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation constants
const VALID_ROLES = ['admin', 'supervisor', 'agent'];
const VALID_STATUSES = ['online', 'offline', 'away'];
const VALID_CATEGORIES = ['billing', 'technical', 'general', 'feature_request', 'bug_report'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/agents/login
 * Authenticate agent with email/password and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Invalid email or password format' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email or password format' });
    }

    // Check JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ error: 'Server configuration error' });
    }

    // Find agent by email (case-insensitive)
    const agent = await Agent.findOne({ email: email.toLowerCase() });
    if (!agent) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, agent.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    const payload = {
      agentId: agent._id.toString(),
      email: agent.email,
      role: agent.role
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

    // Update agent status and lastLogin
    agent.status = 'online';
    agent.lastLogin = new Date();
    await agent.save();

    // Return token and agent info (excluding passwordHash)
    return res.status(200).json({
      token,
      agent: {
        id: agent._id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        status: agent.status
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/agents/logout
 * Set agent status to offline (protected route)
 */
router.post('/logout', authenticateAgent, async (req, res) => {
  try {
    // Update agent status to offline
    await Agent.findByIdAndUpdate(req.agent.agentId, { status: 'offline' });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/agents/me
 * Get current agent profile (protected route)
 */
router.get('/me', authenticateAgent, async (req, res) => {
  try {
    // Find agent by ID from JWT token, exclude passwordHash
    const agent = await Agent.findById(req.agent.agentId).select('-passwordHash');

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.status(200).json({
      agent: {
        id: agent._id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        specialties: agent.specialties || [],
        lastLogin: agent.lastLogin,
        avatar: agent.avatar
      }
    });
  } catch (err) {
    console.error('Get agent profile error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/agents
 * Create new agent account (admin only)
 */
router.post('/', authenticateAgent, requireRole('admin'), async (req, res) => {
  try {
    const { email, name, password, role, specialties } = req.body;

    // Validate required fields
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate name length
    if (name.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Validate role if provided
    const agentRole = role || 'agent';
    if (!VALID_ROLES.includes(agentRole)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, supervisor, or agent' });
    }

    // Validate specialties if provided
    if (specialties) {
      if (!Array.isArray(specialties)) {
        return res.status(400).json({ error: 'Specialties must be an array' });
      }
      for (const specialty of specialties) {
        if (!VALID_CATEGORIES.includes(specialty)) {
          return res.status(400).json({ error: `Invalid specialty: ${specialty}` });
        }
      }
    }

    // Check if email already exists
    const existingAgent = await Agent.findOne({ email: email.toLowerCase() });
    if (existingAgent) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create agent
    const agent = new Agent({
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: agentRole,
      specialties: specialties || [],
      status: 'offline'
    });

    await agent.save();

    // Return agent info (excluding passwordHash)
    return res.status(201).json({
      agent: {
        id: agent._id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        specialties: agent.specialties,
        status: agent.status
      }
    });
  } catch (err) {
    console.error('Create agent error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/agents/:agentId/status
 * Update agent status (own status or admin/supervisor can update any)
 */
router.patch('/:agentId/status', authenticateAgent, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be online, offline, or away' });
    }

    // Check permissions: agent can update own status, admin/supervisor can update any
    const isOwnStatus = agentId === req.agent.agentId;
    const isAdminOrSupervisor = ['admin', 'supervisor'].includes(req.agent.role);

    if (!isOwnStatus && !isAdminOrSupervisor) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Update agent status
    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { status },
      { new: true }
    ).select('-passwordHash');

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.status(200).json({
      agent: {
        id: agent._id,
        email: agent.email,
        name: agent.name,
        status: agent.status
      }
    });
  } catch (err) {
    console.error('Update status error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/agents/:agentId/role
 * Update agent role (admin only)
 */
router.patch('/:agentId/role', authenticateAgent, requireRole('admin'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, supervisor, or agent' });
    }

    // Update agent role
    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { role },
      { new: true }
    ).select('-passwordHash');

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.status(200).json({
      agent: {
        id: agent._id,
        email: agent.email,
        name: agent.name,
        role: agent.role
      }
    });
  } catch (err) {
    console.error('Update role error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/agents/:agentId/specialties
 * Update agent specialties (admin or supervisor)
 */
router.patch('/:agentId/specialties', authenticateAgent, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const { specialties } = req.body;

    // Validate specialties
    if (!specialties || !Array.isArray(specialties)) {
      return res.status(400).json({ error: 'Specialties must be an array' });
    }

    for (const specialty of specialties) {
      if (!VALID_CATEGORIES.includes(specialty)) {
        return res.status(400).json({ error: `Invalid specialty: ${specialty}` });
      }
    }

    // Update agent specialties
    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { specialties },
      { new: true }
    ).select('-passwordHash');

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.status(200).json({
      agent: {
        id: agent._id,
        name: agent.name,
        specialties: agent.specialties
      }
    });
  } catch (err) {
    console.error('Update specialties error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/agents
 * List all agents (admin or supervisor)
 */
router.get('/', authenticateAgent, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { status, role } = req.query;

    // Build filter
    const filter = {};
    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }
    if (role && VALID_ROLES.includes(role)) {
      filter.role = role;
    }

    // Find agents (excluding passwordHash)
    const agents = await Agent.find(filter).select('-passwordHash').sort({ name: 1 });

    return res.status(200).json({
      agents: agents.map(agent => ({
        id: agent._id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        specialties: agent.specialties || [],
        lastLogin: agent.lastLogin
      }))
    });
  } catch (err) {
    console.error('List agents error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/agents/online
 * List online agents (all authenticated agents can view)
 */
router.get('/online', authenticateAgent, async (req, res) => {
  try {
    // Find online agents
    const agents = await Agent.find({ status: 'online' }).select('name status specialties');

    return res.status(200).json({
      agents: agents.map(agent => ({
        id: agent._id,
        name: agent.name,
        status: agent.status,
        specialties: agent.specialties || []
      }))
    });
  } catch (err) {
    console.error('List online agents error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
