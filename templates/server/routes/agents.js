const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { Agent, Role, InviteLink } = require('../db/models');
const { authenticateAgent, requireRole, canManageAgent } = require('../middleware/auth');

const router = express.Router();

const VALID_SYSTEM_ROLES = ['admin', 'manager', 'agent'];
const VALID_STATUSES = ['online', 'offline', 'away'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSystemRole(agent) {
  return agent.systemRole || agent.role || 'agent';
}

// --- AI icon picker for roles ---
async function pickRoleIcon(name, description) {
  try {
    if (!process.env.CLAUDE_API_KEY) return '👥';
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const res = await client.messages.create({
      model: 'claude-haiku-3-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: `Pick ONE emoji icon for this team/role.\nRole: ${name}\nDescription: ${(description || '').substring(0, 200)}\n\nRespond with ONLY the single emoji.` }]
    });
    const emoji = res.content[0].text.trim();
    if (emoji.length <= 8 && emoji.length > 0) return emoji;
    return '👥';
  } catch (err) { return '👥'; }
}

// ============================================================
// AUTH ENDPOINTS
// ============================================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (!process.env.JWT_SECRET) return res.status(503).json({ error: 'Server configuration error' });

    const agent = await Agent.findOne({ email: email.toLowerCase(), active: { $ne: false } });
    if (!agent) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, agent.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const sysRole = getSystemRole(agent);
    const token = jwt.sign(
      { agentId: agent._id.toString(), email: agent.email, role: sysRole, systemRole: sysRole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    agent.status = 'online';
    agent.lastLogin = new Date();
    await agent.save();

    return res.json({
      token,
      agent: {
        id: agent._id, email: agent.email, name: agent.name,
        role: sysRole, systemRole: sysRole, roles: agent.roles || [],
        managerId: agent.managerId, status: agent.status,
        office365Email: agent.office365Email || '', teamsEmail: agent.teamsEmail || ''
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticateAgent, async (req, res) => {
  try {
    await Agent.findByIdAndUpdate(req.agent.agentId, { status: 'offline' });
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateAgent, async (req, res) => {
  try {
    const agent = await Agent.findById(req.agent.agentId).select('-passwordHash');
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const manager = agent.managerId ? await Agent.findById(agent.managerId).select('name email') : null;

    return res.json({
      agent: {
        id: agent._id, email: agent.email, name: agent.name,
        role: getSystemRole(agent), systemRole: getSystemRole(agent),
        roles: agent.roles || [], managerId: agent.managerId,
        managerName: manager ? manager.name : null,
        status: agent.status, specialties: agent.specialties || [],
        lastLogin: agent.lastLogin, avatar: agent.avatar,
        office365Email: agent.office365Email || '',
        teamsEmail: agent.teamsEmail || ''
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// PROFILE UPDATE (self)
// ============================================================

router.put('/me', authenticateAgent, async (req, res) => {
  try {
    const agent = await Agent.findById(req.agent.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { name, office365Email, teamsEmail } = req.body;
    if (name) agent.name = name;
    if (office365Email !== undefined) agent.office365Email = office365Email;
    if (teamsEmail !== undefined) agent.teamsEmail = teamsEmail;

    await agent.save();

    return res.json({
      agent: {
        id: agent._id, email: agent.email, name: agent.name,
        office365Email: agent.office365Email || '',
        teamsEmail: agent.teamsEmail || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// PASSWORD RESET (admin/manager can reset for their agents)
// ============================================================

// Admin/manager resets password for an agent
router.post('/:agentId/reset-password', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const target = await Agent.findById(req.params.agentId);
    if (!target) return res.status(404).json({ error: 'Agent not found' });

    const callerRole = req.agent.systemRole || req.agent.role;
    if (callerRole === 'manager') {
      const canManage = await canManageAgent(req.agent.agentId, target);
      if (!canManage) return res.status(403).json({ error: 'You can only reset passwords for agents in your teams' });
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    target.passwordHash = await bcrypt.hash(newPassword, 10);
    await target.save();

    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent changes own password
router.post('/change-password', authenticateAgent, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const agent = await Agent.findById(req.agent.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const valid = await bcrypt.compare(currentPassword, agent.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    agent.passwordHash = await bcrypt.hash(newPassword, 10);
    await agent.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// AGENT CRUD
// ============================================================

router.get('/online', authenticateAgent, async (req, res) => {
  try {
    const agents = await Agent.find({ status: 'online', active: { $ne: false } }).select('name status specialties roles');
    return res.json({
      agents: agents.map(a => ({
        id: a._id, name: a.name, status: a.status,
        specialties: a.specialties || [], roles: a.roles || []
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List agents (admin sees all, manager sees their teams)
router.get('/', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const sysRole = req.agent.systemRole || req.agent.role;
    const filter = { active: { $ne: false } };

    if (req.query.status && VALID_STATUSES.includes(req.query.status)) filter.status = req.query.status;

    let agents;
    if (sysRole === 'admin') {
      agents = await Agent.find(filter).select('-passwordHash').sort({ name: 1 });
    } else {
      // Manager: only agents in teams they manage
      const managedRoles = await Role.find({ managerId: req.agent.agentId, active: true });
      const managedRoleNames = managedRoles.map(r => r.name);
      filter.roles = { $in: managedRoleNames };
      agents = await Agent.find(filter).select('-passwordHash').sort({ name: 1 });
    }

    // Get all managers for display
    const managerIds = [...new Set(agents.filter(a => a.managerId).map(a => a.managerId.toString()))];
    const managers = managerIds.length > 0 ? await Agent.find({ _id: { $in: managerIds } }).select('name') : [];
    const managerMap = {};
    managers.forEach(m => { managerMap[m._id.toString()] = m.name; });

    return res.json({
      agents: agents.map(a => ({
        id: a._id, email: a.email, name: a.name,
        systemRole: getSystemRole(a), roles: a.roles || [],
        managerId: a.managerId,
        managerName: a.managerId ? (managerMap[a.managerId.toString()] || '') : '',
        status: a.status, specialties: a.specialties || [],
        lastLogin: a.lastLogin,
        office365Email: a.office365Email || '',
        teamsEmail: a.teamsEmail || ''
      }))
    });
  } catch (err) {
    console.error('List agents error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create agent (admin or manager for their teams)
router.post('/', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { email, name, password, systemRole, roles, managerId } = req.body;

    if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password are required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const agentSysRole = systemRole || 'agent';
    if (!VALID_SYSTEM_ROLES.includes(agentSysRole)) {
      return res.status(400).json({ error: 'Invalid systemRole' });
    }

    const callerRole = req.agent.systemRole || req.agent.role;
    // Managers can only create agents (not admins or other managers)
    if (callerRole === 'manager' && agentSysRole !== 'agent') {
      return res.status(403).json({ error: 'Managers can only create agents' });
    }

    // Managers can only assign roles they manage
    if (callerRole === 'manager' && roles && roles.length > 0) {
      const managedRoles = await Role.find({ managerId: req.agent.agentId, active: true });
      const managedNames = managedRoles.map(r => r.name);
      const invalid = roles.filter(r => !managedNames.includes(r));
      if (invalid.length > 0) {
        return res.status(403).json({ error: `You don't manage these roles: ${invalid.join(', ')}` });
      }
    }

    const existing = await Agent.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const agent = new Agent({
      email: email.toLowerCase(), name, passwordHash,
      role: agentSysRole, systemRole: agentSysRole,
      roles: roles || [], managerId: managerId || null,
      status: 'offline'
    });
    await agent.save();

    return res.status(201).json({
      agent: {
        id: agent._id, email: agent.email, name: agent.name,
        systemRole: agentSysRole, roles: agent.roles,
        managerId: agent.managerId, status: agent.status
      }
    });
  } catch (err) {
    console.error('Create agent error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update agent
router.put('/:agentId', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const target = await Agent.findById(req.params.agentId);
    if (!target) return res.status(404).json({ error: 'Agent not found' });

    const callerRole = req.agent.systemRole || req.agent.role;

    // Managers can only edit agents in their teams
    if (callerRole === 'manager') {
      const canManage = await canManageAgent(req.agent.agentId, target);
      if (!canManage) return res.status(403).json({ error: 'You can only manage agents in your teams' });
    }

    const { name, email, systemRole, roles, managerId, password, office365Email, teamsEmail } = req.body;

    if (name) target.name = name;
    if (email && EMAIL_REGEX.test(email)) target.email = email.toLowerCase();
    if (callerRole === 'admin' && systemRole && VALID_SYSTEM_ROLES.includes(systemRole)) {
      target.systemRole = systemRole;
      target.role = systemRole;
    }
    if (roles !== undefined) target.roles = roles;
    if (managerId !== undefined) target.managerId = managerId || null;
    if (password && password.length >= 8) {
      target.passwordHash = await bcrypt.hash(password, 10);
    }
    if (office365Email !== undefined) target.office365Email = office365Email;
    if (teamsEmail !== undefined) target.teamsEmail = teamsEmail;

    await target.save();

    return res.json({
      agent: {
        id: target._id, email: target.email, name: target.name,
        systemRole: getSystemRole(target), roles: target.roles || [],
        managerId: target.managerId, status: target.status
      }
    });
  } catch (err) {
    console.error('Update agent error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate agent (admin only)
router.delete('/:agentId', authenticateAgent, requireRole('admin'), async (req, res) => {
  try {
    const agent = await Agent.findByIdAndUpdate(req.params.agentId, { active: false, status: 'offline' }, { new: true });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    return res.json({ message: 'Agent deactivated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update agent status
router.patch('/:agentId/status', authenticateAgent, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const isOwnStatus = req.params.agentId === req.agent.agentId;
    const callerRole = req.agent.systemRole || req.agent.role;
    if (!isOwnStatus && !['admin', 'manager'].includes(callerRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const agent = await Agent.findByIdAndUpdate(req.params.agentId, { status }, { new: true }).select('-passwordHash');
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    return res.json({ agent: { id: agent._id, name: agent.name, status: agent.status } });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// ROLES / TEAMS CRUD
// ============================================================

// List roles
router.get('/roles', authenticateAgent, async (req, res) => {
  try {
    const roles = await Role.find({ active: true }).sort({ name: 1 });

    // Count agents per role
    const roleCounts = {};
    for (const role of roles) {
      const count = await Agent.countDocuments({ roles: role.name, active: { $ne: false } });
      roleCounts[role.name] = count;
    }

    // Get manager names
    const managerIds = [...new Set(roles.filter(r => r.managerId).map(r => r.managerId.toString()))];
    const managers = managerIds.length > 0 ? await Agent.find({ _id: { $in: managerIds } }).select('name') : [];
    const managerMap = {};
    managers.forEach(m => { managerMap[m._id.toString()] = m.name; });

    return res.json({
      roles: roles.map(r => ({
        id: r._id, name: r.name, description: r.description || '',
        icon: r.icon, managerId: r.managerId,
        managerName: r.managerId ? (managerMap[r.managerId.toString()] || '') : '',
        agentCount: roleCounts[r.name] || 0
      }))
    });
  } catch (err) {
    console.error('List roles error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create role (admin only)
router.post('/roles', authenticateAgent, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, icon, managerId } = req.body;
    if (!name || name.length < 2) return res.status(400).json({ error: 'Role name required (min 2 chars)' });

    const existing = await Role.findOne({ name });
    if (existing) return res.status(400).json({ error: 'Role name already exists' });

    const finalIcon = icon || await pickRoleIcon(name, description);

    const role = new Role({ name, description, icon: finalIcon, managerId: managerId || null });
    await role.save();

    return res.status(201).json({ role: { id: role._id, name: role.name, description: role.description, icon: role.icon, managerId: role.managerId } });
  } catch (err) {
    console.error('Create role error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update role
router.put('/roles/:id', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const callerRole = req.agent.systemRole || req.agent.role;
    if (callerRole === 'manager' && (!role.managerId || role.managerId.toString() !== req.agent.agentId)) {
      return res.status(403).json({ error: 'You can only edit roles you manage' });
    }

    const { name, description, icon, managerId } = req.body;
    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (icon) role.icon = icon;
    else if (name && name !== role.name) role.icon = await pickRoleIcon(name, description || role.description);
    if (callerRole === 'admin' && managerId !== undefined) role.managerId = managerId || null;

    await role.save();
    return res.json({ role: { id: role._id, name: role.name, description: role.description, icon: role.icon, managerId: role.managerId } });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete role (admin only)
router.delete('/roles/:id', authenticateAgent, requireRole('admin'), async (req, res) => {
  try {
    await Role.findByIdAndUpdate(req.params.id, { active: false });
    return res.json({ message: 'Role deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// INVITE LINKS
// ============================================================

// List invite links
router.get('/invite-links', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const callerRole = req.agent.systemRole || req.agent.role;
    const filter = { active: true };
    if (callerRole === 'manager') filter.createdBy = req.agent.agentId;

    const links = await InviteLink.find(filter).sort({ createdAt: -1 });

    return res.json({
      links: links.map(l => ({
        id: l._id, code: l.code, label: l.label || '',
        defaultRoles: l.defaultRoles || [], defaultManagerId: l.defaultManagerId,
        maxUses: l.maxUses, usedCount: l.usedCount,
        expiresAt: l.expiresAt, createdAt: l.createdAt
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invite link
router.post('/invite-links', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { label, defaultRoles, defaultManagerId, maxUses, expiresAt } = req.body;

    const callerRole = req.agent.systemRole || req.agent.role;
    // Managers can only create links for their teams
    if (callerRole === 'manager' && defaultRoles && defaultRoles.length > 0) {
      const managedRoles = await Role.find({ managerId: req.agent.agentId, active: true });
      const managedNames = managedRoles.map(r => r.name);
      const invalid = defaultRoles.filter(r => !managedNames.includes(r));
      if (invalid.length > 0) {
        return res.status(403).json({ error: `You don't manage: ${invalid.join(', ')}` });
      }
    }

    const code = crypto.randomBytes(16).toString('hex');
    const link = new InviteLink({
      code, label: label || '',
      createdBy: req.agent.agentId,
      defaultRoles: defaultRoles || [],
      defaultManagerId: defaultManagerId || null,
      maxUses: maxUses || 0,
      expiresAt: expiresAt || null
    });
    await link.save();

    return res.status(201).json({
      link: {
        id: link._id, code: link.code, label: link.label,
        defaultRoles: link.defaultRoles, maxUses: link.maxUses,
        url: `/test/signup.html?code=${link.code}`
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate invite link
router.delete('/invite-links/:id', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    await InviteLink.findByIdAndUpdate(req.params.id, { active: false });
    return res.json({ message: 'Invite link deactivated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// PUBLIC SIGNUP VIA INVITE LINK
// ============================================================

// Validate invite code (public)
router.get('/signup/:code', async (req, res) => {
  try {
    const link = await InviteLink.findOne({ code: req.params.code, active: true });
    if (!link) return res.status(404).json({ error: 'Invalid or expired invite link' });
    if (link.expiresAt && new Date() > link.expiresAt) return res.status(410).json({ error: 'Invite link has expired' });
    if (link.maxUses > 0 && link.usedCount >= link.maxUses) return res.status(410).json({ error: 'Invite link has reached max uses' });

    return res.json({ valid: true, roles: link.defaultRoles || [], label: link.label });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Signup via invite code (public)
router.post('/signup/:code', async (req, res) => {
  try {
    const link = await InviteLink.findOne({ code: req.params.code, active: true });
    if (!link) return res.status(404).json({ error: 'Invalid or expired invite link' });
    if (link.expiresAt && new Date() > link.expiresAt) return res.status(410).json({ error: 'Invite link has expired' });
    if (link.maxUses > 0 && link.usedCount >= link.maxUses) return res.status(410).json({ error: 'Invite link has reached max uses' });

    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await Agent.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const agent = new Agent({
      email: email.toLowerCase(), name, passwordHash,
      role: 'agent', systemRole: 'agent',
      roles: link.defaultRoles || [],
      managerId: link.defaultManagerId || null,
      status: 'offline'
    });
    await agent.save();

    link.usedCount += 1;
    await link.save();

    return res.status(201).json({ message: 'Account created successfully', agentId: agent._id });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
