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

**Required `.env` variables:**

| Variable | Description |
|---|---|
| `AICHATDESK_PORT` | Server port (default: `8005`) |
| `MONGODB_URI` | MongoDB connection string (e.g. `mongodb://localhost:27017/aichatdesk`) |
| `CLAUDE_API_KEY` | Anthropic API key for AI responses |
| `OPENAI_API_KEY` | OpenAI key for vector embeddings (RAG search) |
| `JWT_SECRET` | Random 32+ char string for agent auth |
| `ADMIN_EMAIL` | Default admin login email |
| `ADMIN_PASSWORD` | Default admin login password |

**Optional:**

| Variable | Description |
|---|---|
| `AICHATDESK_CORS_ORIGIN` | Comma-separated allowed origins (e.g. `https://yoursite.com,http://localhost:3000`) |
| `SENDGRID_API_KEY` | For email notifications on new chats |
| `SENDGRID_FROM_EMAIL` | Verified sender email |
| `SENDGRID_TO_EMAIL` | Where to receive notifications |
| `MICROSOFT_GRAPH_CLIENT_ID` | Azure AD app ID (for Book Demo / calendar) |
| `MICROSOFT_GRAPH_CLIENT_SECRET` | Azure AD client secret |
| `MICROSOFT_GRAPH_TENANT_ID` | Azure AD tenant ID |
| `OFFICE365_CALENDAR_EMAIL` | Office 365 mailbox for bookings |

### Start the server

```bash
node index.js
```

Server runs at `http://localhost:8005` (or your configured port).

---

## 2. Add the Chat Widget to Your Website

Paste this snippet into your HTML page, just before `</body>`:

```html
<!-- AIChatDesk Chat Widget -->
<div id="chat-bubble" onclick="toggleChat()">
  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white"/></svg>
</div>
<div id="chat-window">
  <!-- Widget UI loads here -->
</div>

<script>
  const AICHATDESK_API = 'https://your-server-url:8005';  // Change to your server URL
  const AICHATDESK_WS  = 'wss://your-server-url:8005/ws'; // WebSocket URL
</script>
<script src="https://your-server-url:8005/test/index.html"></script>
```

**Or use the self-contained widget file:**

1. Copy `templates/widget/index.html` into your project
2. Open it and update these two lines at the top of the `<script>` section:

```javascript
const API = 'https://your-server-url:8005';    // Your AIChatDesk server
const WS_URL = 'wss://your-server-url:8005/ws'; // WebSocket endpoint
```

3. Embed it in your site using an `<iframe>`:

```html
<iframe
  src="/path/to/widget.html"
  style="position:fixed; bottom:0; right:0; width:400px; height:600px; border:none; z-index:9999;"
></iframe>
```

---

## 3. CORS Configuration

Your web app's domain must be listed in `AICHATDESK_CORS_ORIGIN` in the `.env` file:

```env
AICHATDESK_CORS_ORIGIN=https://yoursite.com,https://www.yoursite.com
```

Restart the server after changing this.

---

## 4. Set Up the Agent Dashboard

The dashboard lets agents monitor chats, take over from AI, and manage the knowledge base.

1. Copy `templates/test/dashboard.html` to your project
2. Update the API and WebSocket URLs inside the file:

```javascript
const API = 'https://your-server-url:8005';
ws = new WebSocket('wss://your-server-url:8005/ws');
```

3. Open in browser and log in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`

---

## 5. Configure the Knowledge Base

The AI answers questions using your knowledge base (RAG). Upload documents through the dashboard:

1. Log in to the dashboard
2. Go to **Knowledge Base** section
3. Upload `.txt`, `.pdf`, or `.doc` files
4. The server auto-generates vector embeddings for semantic search

---

## 6. Calendar / Book Demo Setup (Optional)

To enable the "Book Demo" feature with Office 365:

### Step 1: Register an Azure AD App

1. Go to [Azure Portal](https://portal.azure.com) > **App registrations** > **New registration**
2. Name: `AIChatDesk Calendar`
3. Supported account types: **Single tenant**
4. Click **Register**

### Step 2: Add API Permissions

1. Go to **API permissions** > **Add a permission** > **Microsoft Graph**
2. Select **Application permissions**
3. Add: `Calendars.ReadWrite`
4. Click **Grant admin consent**

### Step 3: Create a Client Secret

1. Go to **Certificates & secrets** > **New client secret**
2. Copy the **Value** (not the Secret ID)

### Step 4: Add to `.env`

```env
MICROSOFT_GRAPH_CLIENT_ID=your-app-id
MICROSOFT_GRAPH_CLIENT_SECRET=your-client-secret-value
MICROSOFT_GRAPH_TENANT_ID=your-tenant-id
OFFICE365_CALENDAR_EMAIL=calendar-user@yourcompany.com
```

### Step 5: Restart the server

The Book Demo button in the chat widget will now show available slots from the configured calendar.

---

## 7. Workflow Categories (Optional)

Categories let you route chats and customize AI greetings per topic.

1. Open the dashboard > **Settings**
2. Add categories (e.g. "Sales", "Support", "Billing")
3. Each category has a custom **prompt** that shapes the AI's greeting and behavior
4. Users see category buttons after starting a chat

---

## 8. Production Checklist

- [ ] Change `ADMIN_PASSWORD` from default
- [ ] Generate a strong `JWT_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Set `AICHATDESK_CORS_ORIGIN` to your exact domains (no wildcards)
- [ ] Use `wss://` (not `ws://`) for WebSocket in production
- [ ] Use `https://` for all API URLs
- [ ] Set up MongoDB authentication
- [ ] Configure SendGrid for email notifications
- [ ] Upload your knowledge base documents
- [ ] Test the chat widget from your live domain

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Create a new chat session |
| `POST` | `/api/ai/query` | Send message to AI |
| `GET` | `/api/categories` | List workflow categories |
| `GET` | `/api/calendar/status` | Check if calendar is configured |
| `GET` | `/api/calendar/slots?date=YYYY-MM-DD` | Get available time slots |
| `POST` | `/api/calendar/book` | Book a meeting |
| `POST` | `/api/agents/login` | Agent/admin login |
| `GET` | `/api/dashboard/stats` | Dashboard statistics |
| `POST` | `/api/knowledge/upload` | Upload knowledge base file |
| `GET` | `/health` | Server health check |

---

## Architecture

```
Your Website                    AIChatDesk Server (Node.js/Express)
+-----------------+             +---------------------------+
| Chat Widget     | -- HTTP --> | /api/chat, /api/ai/query  |
| (iframe/embed)  | -- WS ----> | WebSocket (real-time)     |
+-----------------+             +---------------------------+
                                         |
Agent Dashboard     -- HTTP/WS -->       |
                                         v
                                +---------------------------+
                                | MongoDB                   |
                                | - Chats, Messages         |
                                | - Knowledge Base          |
                                | - Agents, Settings        |
                                +---------------------------+
                                         |
                                         v
                                +---------------------------+
                                | External Services         |
                                | - Claude API (AI)         |
                                | - OpenAI (Embeddings)     |
                                | - Microsoft Graph (Cal)   |
                                | - SendGrid (Email)        |
                                +---------------------------+
```
