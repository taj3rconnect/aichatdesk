# Add AIChatDesk Widget (/aichatdesk:add)

You are adding an AI-powered customer support chat widget with RAG, human takeover, and operator dashboard to the current project. Follow these steps precisely.

## Step 1: Detect Project Type

Scan the current working directory to determine if this is a React project:

1. **Check for React in package.json:**
   - Read `package.json` in the current directory
   - Look for `"react"` in `dependencies` or `devDependencies` objects
   - If found → React detected

2. **Check for React app entry files (secondary indicators):**
   - Look for `src/App.jsx`, `src/App.tsx`, or `src/App.js`
   - If any exist → React detected

3. **If React NOT detected:**
   - Inform the user: "AIChatDesk v1 supports React projects only. Vue and vanilla HTML support coming in v2."
   - STOP execution

4. **If React detected:**
   - Tell the user: "React project detected. Proceeding with AIChatDesk setup."
   - Continue to Step 2

## Step 2: Scaffold Widget Component

The chat widget component will be created in a future phase. For now:

1. **Explain to the user:**
   - "The chat widget component will be copied from templates in Phase 3."
   - "It will be placed in `src/components/AIChatDesk/` in your project."
   - "The widget includes: collapsible chat UI, message history, typing indicators, file attachments, and human takeover UI."

2. **Document target location:**
   - Widget destination: `src/components/AIChatDesk/ChatWidget.jsx`
   - Integration: Import and add `<AIChatDesk />` component to your app's root layout

## Step 3: Scaffold Standalone Server

The standalone Express + WebSocket server handles AI processing, ticket management, and real-time chat. For now:

1. **Explain to the user:**
   - "The server will be created from templates in Phase 2 and 3."
   - "It runs on a separate port from your main app (default: 8001)."
   - "The server is CORS-enabled to allow requests from your frontend."

2. **Document server structure:**
   ```
   server/
   ├── index.js              # Express app entry point
   ├── routes/
   │   ├── tickets.js        # Ticket CRUD endpoints
   │   ├── knowledge.js      # Knowledge base upload and embedding
   │   └── auth.js           # Operator authentication
   ├── websocket.js          # WebSocket handler for real-time chat
   ├── ai/
   │   ├── rag.js            # RAG search and response generation
   │   └── embeddings.js     # Vector embedding creation
   ├── models/
   │   ├── Ticket.js         # MongoDB schema for tickets
   │   ├── Message.js        # MongoDB schema for messages
   │   └── KnowledgeDoc.js   # MongoDB schema for knowledge docs
   └── utils/
       ├── email.js          # SendGrid email notifications
       └── validator.js      # Input validation
   ```

3. **Server capabilities:**
   - Real-time WebSocket chat with AI and human agents
   - Vector-based RAG search using Claude API
   - Ticket creation, escalation, and assignment
   - Knowledge base document upload and embedding
   - Email notifications via SendGrid
   - Rate limiting and input validation

## Step 4: Configure Environment

The server requires several environment variables for API keys and configuration.

1. **Check if `.env` exists in the project root:**
   - If `.env` already exists: append AIChatDesk variables at the end
   - If `.env` does NOT exist: create `.env` file from template

2. **Required environment variables:**
   ```
   # AIChatDesk Configuration
   MONGODB_URI=mongodb://localhost:27017/your-db-name
   CLAUDE_API_KEY=sk-ant-...
   AICHATDESK_PORT=8001
   AICHATDESK_CORS_ORIGIN=http://localhost:3000
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
   SENDGRID_FROM_EMAIL=support@yourcompany.com
   SENDGRID_TO_EMAIL=alerts@yourcompany.com

   # Optional: Operator Dashboard Authentication
   DASHBOARD_JWT_SECRET=your-secret-key-here
   DASHBOARD_ADMIN_EMAIL=admin@yourcompany.com
   DASHBOARD_ADMIN_PASSWORD=changeme
   ```

3. **Tell the user:**
   - "Environment variables have been added to `.env`"
   - "IMPORTANT: Fill in your actual API keys before starting the server"
   - "Get Claude API key from: https://console.anthropic.com/"
   - "Get SendGrid API key from: https://app.sendgrid.com/settings/api_keys"
   - "Update MONGODB_URI with your MongoDB connection string"

## Step 5: Install Dependencies

The server requires several npm packages. Install them in the `server/` directory.

1. **Server dependencies:**
   ```bash
   cd server
   npm install express ws mongoose cors express-rate-limit dotenv @anthropic-ai/sdk @sendgrid/mail jsonwebtoken bcrypt multer uuid
   ```

2. **Dependency purposes:**
   - `express` - Web server framework
   - `ws` - WebSocket library for real-time chat
   - `mongoose` - MongoDB ODM for data models
   - `cors` - Cross-origin resource sharing
   - `express-rate-limit` - API rate limiting
   - `dotenv` - Environment variable loading
   - `@anthropic-ai/sdk` - Claude AI SDK for RAG responses
   - `@sendgrid/mail` - Email notifications
   - `jsonwebtoken` - JWT authentication for dashboard
   - `bcrypt` - Password hashing for operator accounts
   - `multer` - File upload handling
   - `uuid` - Unique ID generation

3. **Tell the user:**
   - "Dependencies will be installed when server structure is created in Phase 2."
   - "Run `npm install` in the `server/` directory after templates are copied."

## Step 6: Summary Output

After setup is complete, provide a summary to the user:

1. **Files created:**
   - `.env` (or updated existing .env)
   - Server structure documentation above

2. **Next steps:**
   - "Configure `.env` with your API keys (MongoDB, Claude, SendGrid)"
   - "Server templates will be created in Phase 2 (AI Engine)"
   - "Widget component will be created in Phase 3 (Chat Widget)"
   - "Operator dashboard will be created in Phase 6 (Dashboard)"

3. **Testing instructions (after Phase 3):**
   - Start the server: `node server/index.js`
   - Start your React app (e.g., `npm start`)
   - Open your app in a browser
   - Look for the chat widget button in the bottom-right corner
   - Click to open the chat and test AI responses

4. **What happens next:**
   - AI will answer questions using your knowledge base (upload docs via dashboard)
   - Users can escalate to human support if AI can't help
   - Operators can view tickets and take over conversations in the dashboard
   - Email notifications are sent for new tickets and escalations

## Notes

- AIChatDesk uses a `aichatdesk_` prefix for all MongoDB collections to avoid conflicts with your existing database
- The standalone server runs independently from your main app, so updates to AIChatDesk won't affect your app
- The widget communicates with the server via WebSocket for real-time chat
- All user data (tickets, messages, chat history) is stored in MongoDB
- Knowledge base documents are embedded as vectors for semantic search
