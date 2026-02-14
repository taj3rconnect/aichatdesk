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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsMiddleware);

// Security middleware (applied to all routes)
app.use(rateLimiter);
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

// Routes (placeholders for Phase 2+)
app.use('/api/chat', require('./routes/chat')); // Phase 3
app.use('/api/ai', require('./routes/ai')); // Phase 2
app.use('/api/agents', require('./routes/agents')); // Phase 4
app.use('/api/knowledge', require('./routes/knowledge')); // Phase 2
app.use('/api/upload', require('./routes/upload')); // Phase 3 - File uploads
app.use('/api/messages', require('./routes/messages')); // Phase 5 - Message creation with internal notes
app.use('/api/dashboard', require('./routes/dashboard')); // Phase 6 - Operator dashboard
app.use('/api/analytics', require('./routes/analytics')); // Phase 6 - Analytics
app.use('/api/canned-responses', require('./routes/canned-responses')); // Phase 6 - Canned responses

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

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`AIChatDesk server running on port ${PORT}`);
    console.log(`WebSocket ready at ws://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

module.exports = { app, server };
