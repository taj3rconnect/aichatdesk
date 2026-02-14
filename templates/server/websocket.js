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

        // Message routing (implemented in Phase 3)
        switch (message.type) {
          case 'chat.message':
            // Handle chat message (Phase 3)
            break;
          case 'typing.start':
          case 'typing.stop':
            // Handle typing indicators (Phase 3)
            break;
          case 'agent.takeover':
            // Handle human takeover (Phase 5)
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

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

module.exports = { initWebSocket, broadcast };
