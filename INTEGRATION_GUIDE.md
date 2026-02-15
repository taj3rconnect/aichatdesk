# AIChatDesk Integration Guide

How to add AIChatDesk to any web application.

---

## Prerequisites

- **Node.js** v18+
- **MongoDB** running locally or via Atlas
- **Anthropic API key** (Claude) — [Get one here](https://console.anthropic.com/settings/keys)
- **OpenAI API key** (for embeddings/RAG) — [Get one here](https://platform.openai.com/api-keys)

---

## 1. Set Up the AIChatDesk Server

### Install dependencies

```bash
cd templates/server
npm install
```

### Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

### Complete `.env` Example

Below is a full working `.env` file with example values. Replace the API keys with your own.

```env
# =============================================================================
# 1. SERVER CONFIGURATION
# =============================================================================

# Server port
AICHATDESK_PORT=8005

# CORS origins — add your website's domain here
# For local development:
AICHATDESK_CORS_ORIGIN=http://localhost:3005,http://localhost:8005
# For production:
# AICHATDESK_CORS_ORIGIN=https://yoursite.com,https://www.yoursite.com

NODE_ENV=development

# =============================================================================
# 2. DATABASE
# =============================================================================

# Local MongoDB:
MONGODB_URI=mongodb://localhost:27017/aichatdesk
# MongoDB Atlas example:
# MONGODB_URI=mongodb+srv://username:password@cluster0.abc123.mongodb.net/aichatdesk

# =============================================================================
# 3. AI CONFIGURATION (Claude)
# =============================================================================

# Anthropic API key — get from https://console.anthropic.com/settings/keys
CLAUDE_API_KEY=sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX-XXXXXXXXXXXX

# AI model (recommended: claude-sonnet-4-5-20250929)
CLAUDE_MODEL=claude-sonnet-4-5-20250929

# Confidence threshold — below this the AI escalates to a human agent (0.0-1.0)
CLAUDE_CONFIDENCE_THRESHOLD=0.7

# Max tokens for AI responses
CLAUDE_MAX_TOKENS=1024

# =============================================================================
# 4. VECTOR EMBEDDINGS (for RAG / Knowledge Base search)
# =============================================================================

# OpenAI API key — get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Embedding model (don't change unless you know what you're doing)
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# =============================================================================
# 5. EMAIL NOTIFICATIONS (SendGrid - Optional)
# =============================================================================

# SendGrid API key — get from https://app.sendgrid.com/settings/api_keys
SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# From email (must be verified in SendGrid)
SENDGRID_FROM_EMAIL=noreply@yourcompany.com
SENDGRID_FROM_NAME=AIChatDesk Support

# Where new chat notifications are sent
SENDGRID_TO_EMAIL=support@yourcompany.com

# =============================================================================
# 6. FILE UPLOADS
# =============================================================================

# Max file size: 10MB
MAX_FILE_SIZE=10485760

# Allowed extensions
ALLOWED_FILE_EXTENSIONS=png,jpg,jpeg,gif,pdf,txt,log,zip,doc,docx

# =============================================================================
# 7. RATE LIMITING
# =============================================================================

# 100 requests per 15 minutes per IP
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# =============================================================================
# 8. AGENT DASHBOARD AUTH
# =============================================================================

# JWT secret — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-random-64-character-hex-string-here-generate-one-above

# JWT token expiration
JWT_EXPIRES_IN=7d

# Default admin login — CHANGE THESE after first login!
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=change-this-password

# =============================================================================
# 9. MICROSOFT GRAPH / OFFICE 365 CALENDAR (Optional - for Book Demo)
# =============================================================================

# Azure AD App Registration — get from https://portal.azure.com > App registrations
MICROSOFT_GRAPH_CLIENT_ID=c35df48f-xxxx-xxxx-xxxx-38f536167e7b
MICROSOFT_GRAPH_CLIENT_SECRET=mTr8Q~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
MICROSOFT_GRAPH_TENANT_ID=a6300e5c-xxxx-xxxx-xxxx-646fbc2aa587

# Office 365 mailbox whose calendar is used for bookings
OFFICE365_CALENDAR_EMAIL=sales@yourcompany.com

# =============================================================================
# 10. TEST PAGES (Development only)
# =============================================================================

# Path to test HTML pages (widget test page + dashboard)
TEST_PAGES_PATH=/path/to/your/project/templates/test
```

### Start the server

```bash
node index.js
```

You should see:

```
WebSocket server initialized
MongoDB connected: aichatdesk
AIChatDesk server running on port 8005
WebSocket ready at ws://localhost:8005
```

Verify it's running:

```bash
curl http://localhost:8005/health
# → {"status":"ok","service":"aichatdesk","timestamp":...}
```

---

## 2. Add the Chat Widget to Your Website

### Option A: Self-contained widget file (Recommended)

1. Copy `templates/widget/index.html` into your project (e.g. `/public/chat-widget.html`)
2. Open it and update the API URLs near the top of the `<script>` section:

```javascript
// For local development:
const API = 'http://localhost:8005';
const WS_URL = 'ws://localhost:8005/ws';

// For production:
// const API = 'https://chat.yoursite.com';
// const WS_URL = 'wss://chat.yoursite.com/ws';
```

3. Embed in your website using an `<iframe>`:

```html
<iframe
  src="/chat-widget.html"
  style="position:fixed; bottom:0; right:0; width:400px; height:600px; border:none; z-index:9999;"
></iframe>
```

### Option B: Serve from AIChatDesk server directly

If you set `TEST_PAGES_PATH` in `.env`, the widget test page is available at:

```
http://localhost:8005/test/index.html
```

You can iframe this directly:

```html
<iframe
  src="http://localhost:8005/test/index.html"
  style="position:fixed; bottom:0; right:0; width:400px; height:600px; border:none; z-index:9999;"
></iframe>
```

---

## 3. CORS Configuration

Your web app's domain **must** be in `AICHATDESK_CORS_ORIGIN`. Examples:

```env
# Local development
AICHATDESK_CORS_ORIGIN=http://localhost:3000,http://localhost:8005

# Production — your actual domains
AICHATDESK_CORS_ORIGIN=https://yoursite.com,https://www.yoursite.com,https://app.yoursite.com
```

Restart the server after changing this.

---

## 4. Set Up the Agent Dashboard

The dashboard lets agents monitor chats, take over from AI, and manage the knowledge base.

1. Copy `templates/test/dashboard.html` to your project
2. Update the API and WebSocket URLs inside the file:

```javascript
// For local development:
const API = 'http://localhost:8005';
ws = new WebSocket('ws://localhost:8005/ws');

// For production:
// const API = 'https://chat.yoursite.com';
// ws = new WebSocket('wss://chat.yoursite.com/ws');
```

3. Open in browser and log in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`

**Dashboard URL (if served from AIChatDesk):**

```
http://localhost:8005/test/dashboard.html
```

---

## 5. Configure the Knowledge Base

The AI answers questions using your knowledge base (RAG). Upload documents through the dashboard:

1. Log in to the dashboard
2. Go to **Knowledge Base** section
3. Upload `.txt`, `.pdf`, or `.doc` files
4. The server auto-generates vector embeddings for semantic search

**Test it with curl:**

```bash
# Check knowledge base status
curl http://localhost:8005/api/knowledge

# Upload a file
curl -X POST http://localhost:8005/api/knowledge/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/your/document.pdf"
```

---

## 6. Calendar / Book Demo Setup (Optional)

To enable the "Book Demo" feature with Office 365:

### Step 1: Register an Azure AD App

1. Go to [Azure Portal](https://portal.azure.com) > **App registrations** > **New registration**
2. Name: `AIChatDesk Calendar`
3. Supported account types: **Single tenant**
4. Click **Register**
5. Copy the **Application (client) ID** → this is your `MICROSOFT_GRAPH_CLIENT_ID`
6. Copy the **Directory (tenant) ID** → this is your `MICROSOFT_GRAPH_TENANT_ID`

### Step 2: Add API Permissions

1. Go to **API permissions** > **Add a permission** > **Microsoft Graph**
2. Select **Application permissions**
3. Add: `Calendars.ReadWrite`
4. Click **Grant admin consent**

### Step 3: Create a Client Secret

1. Go to **Certificates & secrets** > **New client secret**
2. Set expiry (e.g. 12 months)
3. Copy the **Value** (not the Secret ID) → this is your `MICROSOFT_GRAPH_CLIENT_SECRET`

### Step 4: Add to `.env`

```env
MICROSOFT_GRAPH_CLIENT_ID=c35df48f-xxxx-xxxx-xxxx-38f536167e7b
MICROSOFT_GRAPH_CLIENT_SECRET=mTr8Q~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
MICROSOFT_GRAPH_TENANT_ID=a6300e5c-xxxx-xxxx-xxxx-646fbc2aa587
OFFICE365_CALENDAR_EMAIL=sales@yourcompany.com
```

### Step 5: Restart the server and verify

```bash
curl http://localhost:8005/api/calendar/status
# → {"configured":true}

curl http://localhost:8005/api/calendar/slots
# → {"days":[{"date":"2026-02-16","label":"Mon, Feb 16","slots":[...]}]}
```

The Book Demo button in the chat widget will now show available slots from the configured calendar.

---

## 7. Workflow Categories (Optional)

Categories let you route chats and customize AI greetings per topic.

1. Open the dashboard > **Settings**
2. Add categories (e.g. "Sales", "Support", "Billing")
3. Each category has a custom **prompt** that shapes the AI's greeting and behavior
4. Users see category buttons after starting a chat

**Without categories:** The AI sends an automatic greeting when the chat starts.
**With categories:** The user picks a category first, then gets a category-specific AI greeting.

---

## 8. Quick Verification

After setup, verify everything works:

```bash
# 1. Server health
curl http://localhost:8005/health
# → {"status":"ok","service":"aichatdesk",...}

# 2. Calendar configured (if using Book Demo)
curl http://localhost:8005/api/calendar/status
# → {"configured":true}

# 3. Create a test chat
curl -X POST http://localhost:8005/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userName":"Test User","userEmail":"test@example.com"}'
# → {"sessionId":"...","chatId":"...","mode":"ai"}

# 4. Send a test message (use chatId from above)
curl -X POST http://localhost:8005/api/ai/query \
  -H "Content-Type: application/json" \
  -d '{"chatId":"CHAT_ID_HERE","message":"Hello"}'
# → {"response":"...","confidence":0.85,...}
```

---

## 9. Production Checklist

- [ ] Change `ADMIN_PASSWORD` from default
- [ ] Generate a strong `JWT_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] Set `NODE_ENV=production`
- [ ] Set `AICHATDESK_CORS_ORIGIN` to your exact domains (no wildcards)
- [ ] Use `wss://` (not `ws://`) for WebSocket in production
- [ ] Use `https://` for all API URLs
- [ ] Set up MongoDB authentication
- [ ] Configure SendGrid for email notifications
- [ ] Upload your knowledge base documents
- [ ] Test the chat widget from your live domain
- [ ] Set up a process manager (PM2) to keep the server running: `pm2 start index.js --name aichatdesk`

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `POST` | `/api/chat` | Create a new chat session |
| `POST` | `/api/ai/query` | Send message to AI |
| `GET` | `/api/categories` | List workflow categories |
| `GET` | `/api/calendar/status` | Check if calendar is configured |
| `GET` | `/api/calendar/slots?date=YYYY-MM-DD` | Get available time slots |
| `POST` | `/api/calendar/book` | Book a meeting |
| `POST` | `/api/agents/login` | Agent/admin login |
| `GET` | `/api/dashboard/stats` | Dashboard statistics |
| `POST` | `/api/knowledge/upload` | Upload knowledge base file |
| `GET` | `/api/settings` | Get admin settings |
| `PUT` | `/api/settings` | Update admin settings |

---

## Architecture

```
Your Website                    AIChatDesk Server (Node.js + Express)
+-----------------+             +--------------------------------------+
| Chat Widget     | -- HTTP --> | Port 8005                            |
| (iframe/embed)  | -- WS ----> | /api/chat      — Chat sessions       |
+-----------------+             | /api/ai/query  — AI responses (RAG)  |
                                | /api/calendar  — Book Demo slots     |
Agent Dashboard                 | /api/knowledge — KB management       |
+-----------------+             | /api/agents    — Agent auth          |
| dashboard.html  | -- HTTP --> | /api/dashboard — Stats & analytics   |
| (browser)       | -- WS ----> | /ws            — Real-time updates   |
+-----------------+             +--------------------------------------+
                                         |
                                         v
                                +--------------------------------------+
                                | MongoDB (aichatdesk database)        |
                                | - aichatdesk_chats                   |
                                | - aichatdesk_messages                |
                                | - aichatdesk_agents                  |
                                | - aichatdesk_knowledge_bases         |
                                | - aichatdesk_embeddings              |
                                | - aichatdesk_settings                |
                                | - aichatdesk_workflow_categories     |
                                | - aichatdesk_canned_responses        |
                                | - aichatdesk_response_caches         |
                                +--------------------------------------+
                                         |
                                         v
                                +--------------------------------------+
                                | External Services                    |
                                | - Claude API (AI chat responses)     |
                                | - OpenAI API (vector embeddings)     |
                                | - Microsoft Graph (calendar/booking) |
                                | - SendGrid (email notifications)     |
                                +--------------------------------------+
```
