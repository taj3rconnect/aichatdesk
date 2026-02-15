/**
 * @file index.js — Express + WebSocket server entry point for AIChatDesk
 * @description Initializes the HTTP server with middleware chain, mounts API routes,
 *   sets up WebSocket support, and runs database migrations on startup.
 *   Middleware order: body parsing -> CORS -> rate limiting -> bot detection.
 *   Routes are mounted under /api/* for all REST endpoints.
 * @requires express
 * @requires ws (via ./websocket)
 * @requires mongoose (via ./db/connection)
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./db/connection');
const corsMiddleware = require('./middleware/cors');
const rateLimiter = require('./middleware/rateLimiter');
const botDetection = require('./middleware/botDetection');
const { initWebSocket } = require('./websocket');

const app = express();
const server = http.createServer(app);

// Body parsing middleware — must come before route handlers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware — validates origins from AICHATDESK_CORS_ORIGIN env var
app.use(corsMiddleware);

// Rate limiting — per-IP request throttling (15-min window, 1000 req default)
app.use(rateLimiter);

// Bot detection — flags/blocks suspicious user agents and rapid-fire requests
app.use(botDetection);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aichatdesk', timestamp: Date.now() });
});

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Serve test pages (development only)
const testPath = process.env.TEST_PAGES_PATH;
if (testPath && fs.existsSync(testPath)) {
  app.use('/test', express.static(testPath));
}

// Serve dashboard static files (embedded mode - if built)
const dashboardPath = path.join(__dirname, '../dashboard/build');
if (fs.existsSync(dashboardPath)) {
  app.use('/aichatdesk/dashboard', express.static(dashboardPath));
  // Handle client-side routing (React Router)
  app.get('/aichatdesk/dashboard/*', (req, res) => {
    res.sendFile(path.join(dashboardPath, 'index.html'));
  });
  console.log('Dashboard embedded mode enabled at /aichatdesk/dashboard');
}

// --- API Route Mounts ---
app.use('/api/chat', require('./routes/chat'));                     // Chat session lifecycle (create, close, list)
app.use('/api/ai', require('./routes/ai'));                         // AI inference, sentiment analysis, KB-powered responses
app.use('/api/agents', require('./routes/agents'));                 // Agent CRUD, auth (login/register), status management
app.use('/api/knowledge', require('./routes/knowledge'));           // Knowledge base document upload and management
app.use('/api/upload', require('./routes/upload'));                 // File attachment uploads for chat messages
app.use('/api/messages', require('./routes/messages'));             // Message creation, retrieval, internal agent notes
app.use('/api/dashboard', require('./routes/dashboard'));           // Operator dashboard data (active chats, metrics)
app.use('/api/analytics', require('./routes/analytics'));           // Analytics and reporting endpoints
app.use('/api/canned-responses', require('./routes/canned-responses')); // Pre-written response templates for agents
app.use('/api/categories', require('./routes/categories'));         // Workflow category management
app.use('/api/calendar', require('./routes/calendar'));             // Office 365 calendar scheduling integration
app.use('/api/search', require('./routes/search'));                 // Unified search across chats, messages, KB
app.use('/api/settings', require('./routes/settings'));             // Admin settings (key-value configuration)

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize WebSocket server
initWebSocket(server);

// Initialize Teams bot (only if configured)
const { initTeamsBot } = require('./utils/teamsBot');
initTeamsBot(app);

// Start server
const PORT = process.env.AICHATDESK_PORT || 8001;

/**
 * One-time migration: populates the systemRole field on agents that only have
 * the legacy 'role' field. Maps supervisor -> manager, keeps admin/agent as-is.
 * @returns {Promise<void>}
 */
async function migrateAgents() {
  try {
    const { Agent } = require('./db/models');
    const agents = await Agent.find({ systemRole: { $exists: false } });
    if (agents.length === 0) return;
    const roleMap = { admin: 'admin', supervisor: 'manager', agent: 'agent' };
    for (const a of agents) {
      a.systemRole = roleMap[a.role] || 'agent';
      if (!a.roles) a.roles = [];
      await a.save();
    }
    console.log(`[Migration] Updated ${agents.length} agents with systemRole`);
  } catch (err) {
    console.error('[Migration] Agent migration error:', err.message);
  }
}

connectDB().then(async () => {
  await migrateAgents();
  server.listen(PORT, () => {
    console.log(`AIChatDesk server running on port ${PORT}`);
    console.log(`WebSocket ready at ws://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

module.exports = { app, server };
