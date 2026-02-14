# AIChatDesk Operator Dashboard

Real-time chat monitoring and agent productivity tools for AIChatDesk.

## Features

- **Real-Time Chat Monitoring**: View all active and waiting chats with live WebSocket updates
- **Agent Assignment Tracking**: See which chats are AI-handled vs human-handled with agent details
- **Wait Time Visibility**: Monitor how long customers have been waiting for responses
- **Status & Priority Indicators**: Visual badges for chat status, category, and priority
- **Dual Deployment Modes**: Run standalone or embed into existing applications

---

## Deployment Modes

### Mode 1: Standalone (Development & Simple Deployments)

Run the dashboard on its own port (default: 3003) as a separate application.

**Use Cases:**
- Local development
- Separate deployments
- Microservices architecture
- When you want dashboard and backend on different servers

**Setup:**

1. Install dependencies:
```bash
cd templates/dashboard
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Configure environment variables:
```env
REACT_APP_API_URL=http://localhost:8001
REACT_APP_WS_URL=ws://localhost:8001
PORT=3003
REACT_APP_BASENAME=/
```

4. Start the dashboard:
```bash
npm start
```

5. Access at: `http://localhost:3003`

**CORS Requirements:**
- Standalone mode requires CORS enabled on backend server
- Already configured in AIChatDesk server (Phase 1)

---

### Mode 2: Embedded Route (Production & Integrated Deployments)

Serve the dashboard as static files from the backend server at `/aichatdesk/dashboard` route.

**Use Cases:**
- Production deployments
- Single-origin hosting
- Simplified infrastructure
- When you want everything on one server

**Setup:**

1. Build the dashboard to static files:
```bash
cd templates/dashboard
npm install
npm run build
```

2. The build output will be in `templates/dashboard/build/`

3. Backend server automatically serves dashboard if build exists:
```javascript
// Already configured in templates/server/index.js
const path = require('path');
const fs = require('fs');

const dashboardPath = path.join(__dirname, '../dashboard/build');
if (fs.existsSync(dashboardPath)) {
  app.use('/aichatdesk/dashboard', express.static(dashboardPath));
  app.get('/aichatdesk/dashboard/*', (req, res) => {
    res.sendFile(path.join(dashboardPath, 'index.html'));
  });
}
```

4. Configure build environment (optional - uses relative paths by default):
```env
REACT_APP_API_URL=/api
REACT_APP_WS_URL=ws://localhost:8001
REACT_APP_BASENAME=/aichatdesk/dashboard
```

5. Access at: `http://localhost:8001/aichatdesk/dashboard`

**CORS Requirements:**
- Embedded mode doesn't need CORS (same origin)

---

## Environment Variables

| Variable | Description | Standalone | Embedded |
|----------|-------------|------------|----------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:8001` | `/api` (relative) |
| `REACT_APP_WS_URL` | WebSocket URL | `ws://localhost:8001` | `ws://localhost:8001` |
| `PORT` | Dashboard port | `3003` | N/A (not used) |
| `REACT_APP_BASENAME` | Router base path | `/` | `/aichatdesk/dashboard` |

---

## Development Workflow

### Running Both Modes Simultaneously

**Terminal 1 - Backend Server:**
```bash
cd templates/server
npm install
npm start
# Runs on localhost:8001
```

**Terminal 2 - Standalone Dashboard (Dev):**
```bash
cd templates/dashboard
npm install
npm start
# Runs on localhost:3003
```

### Building for Embedded Mode

```bash
cd templates/dashboard
npm run build
# Restart backend server to serve static files
```

---

## WebSocket Configuration

The dashboard connects to the backend WebSocket server for real-time updates.

**Standalone Mode:**
- Connects to `REACT_APP_WS_URL` (default: `ws://localhost:8001`)
- Cross-origin WebSocket connection

**Embedded Mode:**
- Connects to same host as dashboard (same origin)
- Set `REACT_APP_WS_URL` to match your backend server

**Runtime Detection (Advanced):**

For production deployments where the backend URL is dynamic, detect WebSocket URL at runtime:

```javascript
// In src/hooks/useDashboardWebSocket.js
const wsUrl = process.env.REACT_APP_WS_URL ||
  `ws://${window.location.hostname}:8001`;
```

---

## Troubleshooting

### Dashboard won't connect to backend

**Standalone Mode:**
1. Check backend is running: `curl http://localhost:8001/health`
2. Verify CORS is enabled in `templates/server/middleware/cors.js`
3. Check `REACT_APP_API_URL` in `.env` matches backend port

**Embedded Mode:**
1. Verify build exists: `ls templates/dashboard/build/index.html`
2. Check server logs for static file serving errors
3. Ensure backend server restarted after build

### WebSocket disconnects frequently

1. Check network stability
2. Verify backend WebSocket server is running (see server logs)
3. Check firewall/proxy settings (WebSocket uses different protocol)
4. Exponential backoff will auto-reconnect (max 30s delay)

### Chat list not updating in real-time

1. Check WebSocket connection status in dashboard (green = connected)
2. Verify `broadcastToDashboard()` is called when chats are created/updated
3. Check browser console for WebSocket errors
4. Ensure client type is set to 'dashboard' on connection

---

## Production Deployment Checklist

### Standalone Mode

- [ ] Set `REACT_APP_API_URL` to production backend URL
- [ ] Set `REACT_APP_WS_URL` to production WebSocket URL
- [ ] Build: `npm run build`
- [ ] Serve build folder with nginx/Apache/hosting platform
- [ ] Configure SSL for HTTPS (use `wss://` for WebSocket)
- [ ] Enable CORS on backend for dashboard domain

### Embedded Mode

- [ ] Build dashboard: `npm run build`
- [ ] Deploy backend with dashboard build folder
- [ ] Set `REACT_APP_BASENAME=/aichatdesk/dashboard`
- [ ] Test route: `https://yourdomain.com/aichatdesk/dashboard`
- [ ] Configure SSL for HTTPS and WSS
- [ ] No CORS needed (same origin)

---

## Architecture

```
Standalone Mode:
┌─────────────────┐         ┌──────────────────┐
│ Dashboard :3003 │────────▶│ Backend :8001    │
│ (React SPA)     │   REST  │ (Express + WS)   │
│                 │◀────────│                  │
└─────────────────┘  WebSocket └──────────────────┘

Embedded Mode:
┌────────────────────────────────────┐
│ Backend :8001                      │
│ ┌────────────────────────────────┐ │
│ │ /aichatdesk/dashboard (Static) │ │
│ │ (React SPA)                    │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ /api/* (REST + WebSocket)      │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

---

## Tech Stack

- **React 18**: Modern hooks-based UI
- **React Router 6**: Client-side routing
- **date-fns**: Time formatting for wait times
- **WebSocket**: Real-time bidirectional communication
- **Inline CSS-in-JS**: Component isolation (no external CSS frameworks)

---

## Next Steps

After deploying the dashboard:

1. **Phase 6 Plan 2**: Implement chat detail view with message history
2. **Phase 6 Plan 3**: Add agent controls (take over, transfer, end chat)
3. **Phase 6 Plan 4**: Implement analytics and performance metrics
4. **Phase 6 Plan 5**: Add knowledge base management UI

---

## Support

For issues or questions:
1. Check server logs: `templates/server/` output
2. Check browser console for client-side errors
3. Verify WebSocket connection in Network tab (WS filter)
4. Review this README's troubleshooting section
