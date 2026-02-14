# AIChatDesk Templates

This directory contains templates that are copied to target projects when `/aichatdesk:add` is invoked.

## Purpose

Templates provide pre-built components and server code that are customized and deployed to the user's project during plugin execution.

## Directory Structure

### widget/
React chat widget component templates (created in Phase 3 - Chat Widget):
- `ChatWidget.jsx` - Main chat widget component
- `ChatWidget.css` - Widget styles
- `hooks/useChat.js` - WebSocket chat hook
- `components/MessageList.jsx` - Message display component
- `components/MessageInput.jsx` - Input field with attachment support
- `components/TypingIndicator.jsx` - Typing animation
- `components/HumanTakeoverBanner.jsx` - Banner shown when human agent joins

### server/
Express + WebSocket standalone server templates (created in Phase 2 - AI Engine and Phase 3):
- `index.js` - Express app entry point with WebSocket setup
- `routes/tickets.js` - Ticket CRUD endpoints
- `routes/knowledge.js` - Knowledge base upload and vector embedding
- `routes/auth.js` - Operator authentication endpoints
- `websocket.js` - WebSocket handler for real-time chat
- `ai/rag.js` - RAG search and Claude AI response generation
- `ai/embeddings.js` - Vector embedding creation for knowledge docs
- `models/Ticket.js` - MongoDB Ticket schema
- `models/Message.js` - MongoDB Message schema
- `models/KnowledgeDoc.js` - MongoDB KnowledgeDoc schema with vector field
- `utils/email.js` - SendGrid email notification sender
- `utils/validator.js` - Input validation and sanitization

### env/
Environment variable template (created in Phase 2):
- `.env.example` - Template with all required config keys and comments

## Template Population Schedule

| Phase | Plan | Templates Added |
|-------|------|----------------|
| 2 - AI Engine | Multiple | server/ai/, server/models/KnowledgeDoc.js, env/.env.example |
| 3 - Chat Widget | Multiple | widget/, server/websocket.js, server/routes/tickets.js |
| 6 - Dashboard | Multiple | server/routes/auth.js, server/models/Operator.js |

## Notes

- Templates use placeholder values (e.g., `YOUR_API_KEY_HERE`) that the plugin replaces during installation
- The plugin customizes templates based on detected project structure (e.g., adjusts import paths for React)
- Server templates are framework-agnostic and work with any frontend
