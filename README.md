# AIChatDesk

AI-powered customer support chat widget with RAG, live agent handoff, Office 365 calendar booking, and an operator dashboard.

## Features

- **AI Chat Widget** — Embeddable chat widget with real-time WebSocket messaging
- **RAG Engine** — Vector-based knowledge base search powered by Claude AI + OpenAI embeddings
- **Live Agent Handoff** — Seamless transition from AI to human agents with AI copilot suggestions
- **Book Demo / Calendar** — Office 365 calendar integration for scheduling calls, demos, and meetings
- **Operator Dashboard** — Multi-chat split view, analytics, canned responses, profanity detection
- **Workflow Categories** — Customizable chat categories with category-specific AI prompts
- **Email Notifications** — SendGrid integration for new chat alerts
- **Sentiment Analysis** — Auto-detect user mood and prioritize chats
- **Knowledge Base Management** — Upload PDF, TXT, DOC files with automatic vector indexing

## Tech Stack

- **Backend:** Node.js, Express, WebSocket (ws)
- **Database:** MongoDB (Mongoose)
- **AI:** Claude API (Anthropic), OpenAI Embeddings
- **Calendar:** Microsoft Graph API (Office 365)
- **Email:** SendGrid
- **Frontend:** Vanilla HTML/CSS/JS (widget), React (dashboard)

## Quick Start

### 1. Install dependencies

```bash
cd templates/server
npm install
```

### 2. Configure environment

```bash
cp .env.example templates/server/.env
# Edit templates/server/.env with your API keys
```

### 3. Start the server

```bash
npm start
# or: node templates/server/index.js
```

Server runs at `http://localhost:8005`

### 4. Open the test pages

- **Chat Widget:** http://localhost:8005/test/index.html
- **Agent Dashboard:** http://localhost:8005/test/dashboard.html

Default login: `admin@aichatdesk.com` / `changeme123`

## Project Structure

```
aichatdesk/
├── templates/
│   ├── server/           # Express + WebSocket backend
│   │   ├── index.js      # Server entry point
│   │   ├── routes/       # API routes (chat, ai, calendar, agents, etc.)
│   │   ├── db/           # MongoDB models and connection
│   │   ├── middleware/    # Auth, CORS, rate limiting, bot detection
│   │   ├── utils/        # Vector search, email, Microsoft Graph, caching
│   │   └── websocket.js  # Real-time WebSocket handler
│   ├── widget/           # Embeddable chat widget (standalone HTML)
│   ├── test/             # Test pages (widget + dashboard)
│   └── dashboard/        # React dashboard (optional build)
├── .env.example          # Environment template
├── INTEGRATION_GUIDE.md  # Full setup guide for new projects
├── package.json
├── LICENSE
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `POST` | `/api/chat` | Create a new chat session |
| `POST` | `/api/ai/query` | Send message to AI |
| `GET` | `/api/categories` | List workflow categories |
| `GET` | `/api/calendar/status` | Check calendar configuration |
| `GET` | `/api/calendar/slots` | Get available time slots |
| `POST` | `/api/calendar/book` | Book a meeting |
| `POST` | `/api/agents/login` | Agent/admin login |
| `GET` | `/api/dashboard/stats` | Dashboard statistics |
| `POST` | `/api/knowledge/upload` | Upload knowledge base file |

## Integration

See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for detailed instructions on adding AIChatDesk to any web application, including:

- Full `.env` configuration with examples
- Widget embedding (iframe or standalone)
- CORS setup
- Azure AD registration for Book Demo
- Production checklist

## License

[MIT](LICENSE)
