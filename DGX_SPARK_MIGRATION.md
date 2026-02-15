# DGX Spark Migration Plan

Move all AI/LLM workloads from cloud APIs to in-house Nvidia DGX Spark. Eliminate all API costs except SendGrid.

---

## Current State → Target State

| Workload | Current (Cloud) | Target (DGX Spark) |
|---|---|---|
| Chat AI | Claude API (Anthropic) — $3/MTok input | Llama 3.1 70B or Qwen 2.5 72B via vLLM |
| Embeddings | OpenAI text-embedding-3-small — $0.02/MTok | nomic-embed-text or BGE-large-en-v1.5 via vLLM |
| Email | SendGrid | SendGrid (no change) |
| Calendar | Microsoft Graph | Microsoft Graph (no change) |

**Estimated monthly savings:** ~$50-200/mo depending on chat volume (scales to zero with self-hosted).

---

## Phase 1: DGX Spark Setup

### 1.1 Install Model Serving Stack

```bash
# Option A: vLLM (recommended — highest throughput, OpenAI-compatible API)
pip install vllm

# Option B: Ollama (simpler setup, good for getting started)
curl -fsSL https://ollama.com/install.sh | sh
```

### 1.2 Download Models

**Chat/Reasoning Model (pick one):**

| Model | Size | VRAM | Quality | Speed |
|---|---|---|---|---|
| Llama 3.1 70B (Recommended) | ~40GB | ~48GB | Excellent | Good |
| Qwen 2.5 72B | ~42GB | ~50GB | Excellent | Good |
| Mistral Large 123B | ~70GB | ~80GB | Best | Slower |
| Llama 3.1 8B (Fallback) | ~5GB | ~8GB | Good | Fast |

```bash
# With Ollama:
ollama pull llama3.1:70b
# or
ollama pull qwen2.5:72b

# With vLLM:
vllm serve meta-llama/Llama-3.1-70B-Instruct --port 8000
```

**Embedding Model:**

| Model | Dimensions | Size | Quality |
|---|---|---|---|
| nomic-embed-text (Recommended) | 768 | ~275MB | Excellent for RAG |
| BGE-large-en-v1.5 | 1024 | ~1.3GB | Very good |
| all-MiniLM-L6-v2 | 384 | ~80MB | Good, fastest |

```bash
# With Ollama:
ollama pull nomic-embed-text

# With vLLM:
vllm serve nomic-ai/nomic-embed-text-v1.5 --port 8001
```

### 1.3 Verify Endpoints

```bash
# Test chat model
curl http://DGX_SPARK_IP:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1:70b","messages":[{"role":"user","content":"Hello"}],"max_tokens":50}'

# Test embedding model
curl http://DGX_SPARK_IP:8000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","input":"test query"}'
```

---

## Phase 2: AIChatDesk Code Changes

### 2.1 Files to Modify

| File | Change | Effort |
|---|---|---|
| `templates/server/.env` | Replace API keys with DGX Spark URLs | Config only |
| `templates/server/routes/ai.js` | Switch from `@anthropic-ai/sdk` to `openai` SDK (OpenAI-compatible) | Medium |
| `templates/server/utils/embeddings.js` | Point to local embedding endpoint | Small |
| `templates/server/routes/categories.js` | `pickIcon()` uses Claude — switch to local LLM | Small |
| `templates/server/package.json` | Remove `@anthropic-ai/sdk`, keep `openai` | Config only |

### 2.2 New `.env` Configuration

```env
# ============================================================================
# AI CONFIGURATION — Self-hosted on DGX Spark
# ============================================================================

# LLM endpoint (vLLM or Ollama serving OpenAI-compatible API)
LLM_BASE_URL=http://DGX_SPARK_IP:8000/v1
LLM_MODEL=llama3.1:70b
LLM_MAX_TOKENS=1024

# Embedding endpoint
EMBEDDING_BASE_URL=http://DGX_SPARK_IP:8000/v1
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768

# Confidence threshold (may need tuning for new model)
LLM_CONFIDENCE_THRESHOLD=0.7

# REMOVE these:
# CLAUDE_API_KEY=...
# CLAUDE_MODEL=...
# OPENAI_API_KEY=...
# OPENAI_EMBEDDING_MODEL=...
```

### 2.3 Code Change: ai.js (Chat Responses)

**Before:**
```javascript
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const response = await client.messages.create({
  model: process.env.CLAUDE_MODEL,
  max_tokens: 1024,
  messages: messages,
  system: systemPrompt
});
const responseText = response.content[0].text;
```

**After:**
```javascript
const OpenAI = require('openai');
const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: 'not-needed'  // Local server, no API key required
});
const response = await client.chat.completions.create({
  model: process.env.LLM_MODEL,
  max_tokens: parseInt(process.env.LLM_MAX_TOKENS || '1024'),
  messages: [{ role: 'system', content: systemPrompt }, ...messages]
});
const responseText = response.choices[0].message.content;
```

### 2.4 Code Change: embeddings.js (Vector Embeddings)

**Before:**
```javascript
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.embeddings.create({
  model: process.env.OPENAI_EMBEDDING_MODEL,
  input: text
});
```

**After:**
```javascript
const OpenAI = require('openai');
const client = new OpenAI({
  baseURL: process.env.EMBEDDING_BASE_URL,
  apiKey: 'not-needed'
});
const response = await client.embeddings.create({
  model: process.env.EMBEDDING_MODEL,
  input: text
});
```

### 2.5 Affected Endpoints (all use the same LLM client)

| Endpoint | File | What it does with AI |
|---|---|---|
| `POST /api/ai/query` | routes/ai.js | Main chat responses (RAG) |
| `POST /api/ai/summarize` | routes/ai.js | One-line chat summaries |
| `POST /api/ai/categorize` | routes/ai.js | Chat categorization |
| `POST /api/ai/suggest-reply` | routes/ai.js | Agent copilot suggestions |
| `POST /api/ai/analyze-sentiment` | routes/ai.js | Sentiment + priority detection |
| `POST /api/categories` | routes/categories.js | Auto-pick emoji icon for category |
| `POST /api/knowledge/upload` | utils/embeddings.js | Generate embeddings for KB chunks |

---

## Phase 3: Re-index Knowledge Base

Changing embedding model means different vector dimensions (1536 → 768). All existing embeddings must be regenerated.

```bash
# 1. Connect to MongoDB
mongosh mongodb://localhost:27017/aichatdesk

# 2. Clear old embeddings
db.aichatdesk_embeddings.deleteMany({})

# 3. Re-embed via dashboard
# Go to Knowledge Base → each document → click "Re-embed"
# Or use the API:
curl -X POST http://localhost:8005/api/knowledge/DOCUMENT_ID/push \
  -H "Authorization: Bearer JWT_TOKEN"
```

---

## Phase 4: Tuning & Validation

### 4.1 Prompt Tuning
The system prompt in `ai.js` may need minor adjustments for the new model. Test with:
- Simple greetings ("Hello")
- Knowledge base questions
- Out-of-scope questions (should say "I don't have that information")
- Multi-language queries

### 4.2 Confidence Threshold Tuning
Different models express uncertainty differently. Monitor `confidence` scores in responses and adjust `LLM_CONFIDENCE_THRESHOLD` if the model escalates too often or too rarely.

### 4.3 Performance Benchmarks
Measure and compare:

| Metric | Claude API (current) | DGX Spark (target) |
|---|---|---|
| First response latency | ~1-2s | ~2-5s (depends on model) |
| Embedding generation | ~200ms | ~50ms (local, no network) |
| Throughput (concurrent) | Unlimited (API) | ~5-10 concurrent (single GPU) |

---

## Phase 5: Cleanup

- [ ] Remove `CLAUDE_API_KEY` from `.env`
- [ ] Remove `OPENAI_API_KEY` from `.env`
- [ ] Remove `@anthropic-ai/sdk` from `package.json`
- [ ] Update `INTEGRATION_GUIDE.md` with self-hosted setup instructions
- [ ] Update `.env.example` with new DGX Spark variables
- [ ] Revoke old API keys from Anthropic and OpenAI dashboards

---

## Network Requirements

```
AIChatDesk Server (port 8005)  ──HTTP──►  DGX Spark (port 8000)
                                           ├── LLM: /v1/chat/completions
                                           └── Embeddings: /v1/embeddings
```

- DGX Spark must be reachable from the AIChatDesk server
- No inbound access needed on DGX Spark from the internet
- Recommended: Same LAN or VPN for lowest latency

---

## Rollback Plan

If the self-hosted model quality is insufficient:
1. Re-add `CLAUDE_API_KEY` and `OPENAI_API_KEY` to `.env`
2. Revert the code changes (git revert)
3. Knowledge base embeddings would need re-indexing back to OpenAI dimensions

Keep the old API keys active (but rotate them) until DGX Spark is validated in production.
