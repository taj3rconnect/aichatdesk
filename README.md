# AIChatDesk Plugin

AI-powered customer support chat widget with RAG (Retrieval-Augmented Generation), human takeover, and operator dashboard.

## What is AIChatDesk?

AIChatDesk provides instant, accurate AI-powered support answers from your own knowledge base, with seamless escalation to a human agent when the AI can't help. It includes:

- **AI Chat Widget** - React component that embeds in your app
- **Standalone Server** - Express + WebSocket server for AI processing, ticket management, and real-time chat
- **Operator Dashboard** - View and respond to tickets, take over AI conversations
- **RAG Engine** - Vector-based knowledge base search powered by Claude AI
- **Human Takeover** - Smooth transition from AI to live agent

## Requirements

- **React project** (Vue and vanilla HTML support coming in v2)
- **MongoDB** connection string (for ticket storage and vector embeddings)
- **Claude API key** (for AI responses)
- **SendGrid API key** (for email notifications)

## Quick Start

1. Navigate to your React project directory
2. Run `/aichatdesk:add` in Claude Code
3. Configure `.env` with your API keys
4. Start the standalone server: `node server/index.js`
5. Embed the widget component in your React app

## What `/aichatdesk:add` Does

The plugin:
- Detects React projects via `package.json` scanning
- Scaffolds the chat widget component
- Creates standalone Express + WebSocket server
- Sets up MongoDB models and vector search
- Configures environment variables
- Installs required dependencies

## Documentation

Full documentation available at: [Coming Soon]

## Support

For issues or feature requests, please contact support or file a GitHub issue.
