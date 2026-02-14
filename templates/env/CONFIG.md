# AIChatDesk Configuration Guide

This guide explains how to configure AIChatDesk using environment variables. Start by copying `.env.example` to `.env` and filling in your values.

```bash
cp .env.example .env
```

## Required API Keys

### 1. Claude API Key (CLAUDE_API_KEY)

- **Provider:** Anthropic
- **Get from:** https://console.anthropic.com/settings/keys
- **Cost:** Pay-per-token pricing (see [Anthropic pricing](https://www.anthropic.com/pricing))
- **Why:** Powers AI responses, conversation handling, and RAG-based question answering
- **Models available:**
  - `claude-3-5-sonnet-20241022` (recommended) - Best balance of speed, quality, and cost
  - `claude-3-opus-20240229` - Highest quality, slower and more expensive
  - `claude-3-haiku-20240307` - Fastest and cheapest, lower quality

**Setup:**
1. Sign up at https://console.anthropic.com
2. Navigate to Settings → API Keys
3. Create a new API key
4. Copy the key (starts with `sk-ant-api03-`)
5. Add to `.env` as `CLAUDE_API_KEY=sk-ant-api03-...`

### 2. OpenAI API Key (OPENAI_API_KEY)

- **Provider:** OpenAI
- **Get from:** https://platform.openai.com/api-keys
- **Cost:** ~$0.00002 per 1K tokens for embeddings (extremely cheap)
- **Why:** Generates vector embeddings for knowledge base semantic search
- **Models available:**
  - `text-embedding-3-small` (recommended) - 1536 dimensions, best cost/performance
  - `text-embedding-3-large` - 3072 dimensions, higher quality, higher cost

**Setup:**
1. Sign up at https://platform.openai.com
2. Navigate to API Keys
3. Create a new secret key
4. Copy the key (starts with `sk-`)
5. Add to `.env` as `OPENAI_API_KEY=sk-...`

**Note:** OpenAI embeddings are used even though Claude handles responses. This is because OpenAI's embedding models are industry-standard and highly cost-effective for RAG systems.

### 3. SendGrid API Key (SENDGRID_API_KEY)

- **Provider:** SendGrid (Twilio)
- **Get from:** https://app.sendgrid.com/settings/api_keys
- **Free tier:** 100 emails/day (sufficient for most use cases)
- **Why:** Sends email notifications when new chats arrive and chat transcripts when conversations end
- **Cost:** Free tier covers most small-to-medium sites. Paid plans start at $19.95/month for 50K emails.

**Setup:**
1. Sign up at https://signup.sendgrid.com
2. Complete sender verification (required for free tier)
3. Navigate to Settings → API Keys
4. Create a new API key with "Mail Send" permissions
5. Copy the key (starts with `SG.`)
6. Add to `.env` as `SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx`
7. Verify your sender email address in SendGrid (required for free tier)

**Sender Verification:**
SendGrid requires you to verify the "From" email address. Go to Settings → Sender Authentication → Verify Single Sender and follow the instructions.

## MongoDB Setup

AIChatDesk uses the host application's existing MongoDB instance. All collections are automatically prefixed with `aichatdesk_` to avoid conflicts with your application's data.

**Required collections (auto-created on first use):**
- `aichatdesk_chats` - Chat sessions
- `aichatdesk_messages` - Individual messages
- `aichatdesk_agents` - Agent accounts and profiles
- `aichatdesk_knowledge_base` - Uploaded FAQ documents
- `aichatdesk_embeddings` - Vector embeddings for semantic search
- `aichatdesk_canned_responses` - Predefined quick replies for agents
- `aichatdesk_settings` - System configuration

**Connection string format:**

**Local MongoDB:**
```
MONGODB_URI=mongodb://localhost:27017/myapp
```

**MongoDB Atlas (cloud):**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/myapp
```

**Important:** Replace `myapp` with your actual database name. AIChatDesk will use this database and create collections with the `aichatdesk_` prefix.

## Security Recommendations

### JWT_SECRET

Generate a secure random string (32+ characters) for JWT token signing:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
a3f8d9e2c1b4567890abcdef1234567890abcdef1234567890abcdef12345678
```

Copy this value and set it as `JWT_SECRET` in your `.env` file.

**IMPORTANT:** Never use the default placeholder value in production. A weak JWT secret can allow attackers to forge authentication tokens.

### ADMIN_PASSWORD

The default admin credentials are:
- Email: `admin@myapp.com`
- Password: `changeme123`

**CRITICAL: Change these immediately after first login!**

Use a strong password with:
- Minimum 12 characters
- Mixed case letters (A-Z, a-z)
- Numbers (0-9)
- Special characters (!@#$%^&*)

**To change after first login:**
1. Log in with default credentials
2. Navigate to Settings → Account
3. Update email and password
4. Update `.env` file if you want to track the new admin email

### CORS Origins

The `AICHATDESK_CORS_ORIGIN` setting controls which domains can access your chat server.

**Development:**
```
AICHATDESK_CORS_ORIGIN=http://localhost:3000
```

**Production:**
```
AICHATDESK_CORS_ORIGIN=https://myapp.com,https://www.myapp.com
```

**WARNING: Never use wildcard (*) in production!** This would allow any website to use your chat server, potentially exposing your API keys and user data.

## Rate Limiting

Default configuration: 100 requests per IP per 15 minutes.

Adjust `RATE_LIMIT_MAX_REQUESTS` based on your expected traffic:

| Site Size | Recommended Limit |
|-----------|-------------------|
| Small site (< 1K visitors/day) | 50-100 |
| Medium traffic (1K-10K visitors/day) | 200-300 |
| High traffic (> 10K visitors/day) | 500+ |

**Too low:** Legitimate users may be blocked during active conversations.
**Too high:** Less protection against abuse and DDoS attempts.

**Rate limit window** (`RATE_LIMIT_WINDOW_MS`):
- Default: 900000ms = 15 minutes
- Alternative: 3600000ms = 1 hour (more lenient)
- Alternative: 300000ms = 5 minutes (stricter)

## Optional Features

### Browser Push Notifications

Enable browser push notifications for agents to receive alerts for new high-priority chats even when the dashboard is in the background.

**Generate VAPID keys:**

```bash
npm install -g web-push
web-push generate-vapid-keys
```

**Example output:**
```
Public Key: BEl62iUYgUivxIkv69yViEuiBIa-Ib27SJbQTMn_eeQ...
Private Key: bdSiGxVCq4nPSh8WJpnT2_UhLzYgJ8bS7XpPJK1F...
```

Add these to your `.env` file:
```
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib27SJbQTMn_eeQ...
VAPID_PRIVATE_KEY=bdSiGxVCq4nPSh8WJpnT2_UhLzYgJ8bS7XpPJK1F...
```

**Leave empty to disable push notifications.**

### Webhooks

Set `WEBHOOK_URL` to receive POST requests when chat events occur:

**Events sent:**
- `chat.started` - New chat initiated
- `chat.ended` - Chat conversation closed
- `message.received` - New message from user
- `message.sent` - Agent/AI sent message
- `agent.takeover` - Human agent took over from AI
- `agent.transfer` - Chat transferred between agents
- `satisfaction.rated` - User submitted satisfaction rating

**Example webhook payload:**
```json
{
  "event": "chat.started",
  "timestamp": "2026-02-14T05:46:02Z",
  "chat_id": "65f8a3b2c1d4e5f6a7b8c9d0",
  "user": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "metadata": {
    "page": "/pricing",
    "browser": "Chrome",
    "os": "Windows"
  }
}
```

**Leave empty to disable webhooks.**

## File Upload Configuration

### MAX_FILE_SIZE

Default: 10MB (10485760 bytes)

**Common values:**
- 5MB: `5242880`
- 10MB: `10485760` (default)
- 20MB: `20971520`
- 50MB: `52428800`

**Note:** Larger file sizes increase server storage and bandwidth requirements. Consider your use case:
- Small support files (logs, screenshots): 5-10MB sufficient
- Large documents (PDFs, presentations): 20-50MB
- Video attachments: Not recommended for chat (use external hosting)

### ALLOWED_FILE_EXTENSIONS

Default: `png,jpg,jpeg,gif,pdf,txt,log,zip,doc,docx`

**Add extensions as needed:**
```
ALLOWED_FILE_EXTENSIONS=png,jpg,jpeg,gif,pdf,txt,log,zip,doc,docx,csv,json,xml
```

**Security note:** Never allow executable file types (`.exe`, `.bat`, `.sh`, `.dll`) to prevent malware uploads.

## Troubleshooting

### MongoDB Connection Failed

**Error:** `MongoNetworkError: failed to connect to server`

**Solutions:**
1. Verify MongoDB is running: `mongod --version` or `systemctl status mongod`
2. Check connection string format (local: `mongodb://localhost:27017/dbname`, Atlas: `mongodb+srv://...`)
3. For Atlas: Ensure your IP is whitelisted in Network Access
4. Check firewall settings allow connection to port 27017

### Claude API 401 Unauthorized

**Error:** `401 Unauthorized` or `Invalid API key`

**Solutions:**
1. Verify API key starts with `sk-ant-api03-`
2. Check for extra spaces or newlines in `.env` file
3. Confirm API key is active in Anthropic console
4. Verify billing is set up (Anthropic requires payment method)

### SendGrid 403 Forbidden

**Error:** `403 Forbidden` when sending emails

**Solutions:**
1. Verify sender email is verified in SendGrid (Settings → Sender Authentication)
2. Check API key has "Mail Send" permissions
3. Confirm you haven't exceeded free tier limit (100 emails/day)
4. Check SendGrid account status (suspended accounts cannot send)

### OpenAI Embeddings Timeout

**Error:** `Request timeout` or `Connection error`

**Solutions:**
1. Check internet connectivity
2. Verify API key is valid
3. Try reducing batch size in embedding generation
4. Check OpenAI status page: https://status.openai.com

### Rate Limit Errors

**Error:** `Too many requests` or `Rate limit exceeded`

**Solutions:**
1. Increase `RATE_LIMIT_MAX_REQUESTS` in `.env`
2. Increase `RATE_LIMIT_WINDOW_MS` for longer window
3. Check if legitimate traffic or bot attack
4. Consider implementing IP whitelisting for known agents

### CORS Errors in Browser

**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solutions:**
1. Add your frontend domain to `AICHATDESK_CORS_ORIGIN`
2. Use comma-separated values for multiple domains
3. Ensure no trailing slash in domain (use `https://myapp.com`, not `https://myapp.com/`)
4. For local development, ensure port matches (e.g., `http://localhost:3000`)

## Environment-Specific Configuration

### Development

```bash
NODE_ENV=development
AICHATDESK_PORT=8001
AICHATDESK_CORS_ORIGIN=http://localhost:3000,http://localhost:3001
MONGODB_URI=mongodb://localhost:27017/aichat_dev
JWT_EXPIRES_IN=7d
```

### Production

```bash
NODE_ENV=production
AICHATDESK_PORT=8001
AICHATDESK_CORS_ORIGIN=https://myapp.com,https://www.myapp.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/aichat_prod
JWT_EXPIRES_IN=1h
RATE_LIMIT_MAX_REQUESTS=200
```

**Production checklist:**
- [ ] Strong JWT_SECRET (32+ random characters)
- [ ] Changed default admin password
- [ ] CORS limited to actual domain(s)
- [ ] Verified sender email in SendGrid
- [ ] MongoDB connection string uses credentials
- [ ] Shorter JWT expiration for security
- [ ] Appropriate rate limits set

---

**Need help?** Check the main README.md or file an issue in the repository.
