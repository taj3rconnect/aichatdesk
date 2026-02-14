const { Server } = require('ws');

let wss;

function initWebSocket(server) {
  wss = new Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`WebSocket connection from ${clientIP}`);

    // Ping/pong for connection health
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        console.log('Received:', message.type);

        // Store sessionId on first message for session-specific broadcasting
        if (message.sessionId && !ws.sessionId) {
          ws.sessionId = message.sessionId;
        }

        // Store client type for targeted dashboard broadcasting
        if (message.clientType && !ws.clientType) {
          ws.clientType = message.clientType; // 'widget' or 'dashboard'
        }

        // Message routing (implemented in Phase 3)
        switch (message.type) {
          case 'dashboard.connect':
            // Dashboard client connected
            console.log('Dashboard client connected');
            ws.clientType = 'dashboard';
            break;
          case 'chat.message':
            // Handle chat message (Phase 3)
            break;
          case 'typing.start':
          case 'typing.stop':
            // Handle typing indicators (Phase 3)
            break;
          case 'agent.takeover':
            // Broadcast takeover event to all clients for this session
            if (message.sessionId && message.agentName) {
              broadcast({
                type: 'agent.takeover',
                sessionId: message.sessionId,
                agentName: message.agentName,
                timestamp: new Date().toISOString()
              }, message.sessionId);
            }
            break;
          case 'agent.return':
            // Broadcast return event to all clients for this session
            if (message.sessionId) {
              broadcast({
                type: 'agent.return',
                sessionId: message.sessionId,
                timestamp: new Date().toISOString()
              }, message.sessionId);
            }
            break;
          case 'agent.note':
            // Internal event - log but don't broadcast to users
            console.log('Agent note created:', message.chatId);
            break;
          default:
            ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
        }
      } catch (err) {
        console.error('WebSocket error:', err);
        ws.send(JSON.stringify({ type: 'error', error: err.message }));
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket closed for ${clientIP}`);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  // Connection health check (30s interval)
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('WebSocket server initialized');
}

/**
 * Broadcast data to clients
 * @param {Object} data - Data to broadcast
 * @param {String} sessionId - Optional: only send to clients with matching sessionId
 */
function broadcast(data, sessionId) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      // If sessionId specified, only send to matching clients
      if (sessionId) {
        if (client.sessionId === sessionId) {
          client.send(JSON.stringify(data));
        }
      } else {
        // Broadcast to all clients
        client.send(JSON.stringify(data));
      }
    }
  });
}

/**
 * Broadcast data to dashboard clients only
 * @param {String} eventType - Event type (e.g., 'dashboard.chat.created')
 * @param {Object} data - Event data
 */
function broadcastToDashboard(eventType, data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.clientType === 'dashboard') {
      client.send(JSON.stringify({
        type: eventType,
        ...data,
        timestamp: new Date().toISOString()
      }));
    }
  });
}

module.exports = { initWebSocket, broadcast, broadcastToDashboard };
