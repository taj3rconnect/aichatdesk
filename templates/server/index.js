require('dotenv').config();
const express = require('express');
const http = require('http');
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

// Routes (placeholders for Phase 2+)
app.use('/api/chat', require('./routes/chat')); // Phase 3
app.use('/api/ai', require('./routes/ai')); // Phase 2
app.use('/api/agents', require('./routes/agents')); // Phase 4
app.use('/api/knowledge', require('./routes/knowledge')); // Phase 2
app.use('/api/upload', require('./routes/upload')); // Phase 3 - File uploads

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
