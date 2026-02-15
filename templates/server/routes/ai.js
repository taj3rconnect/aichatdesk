const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { Chat, Message, WorkflowCategory } = require('../db/models');
const { searchKnowledgeBase } = require('../utils/vectorSearch');
const { detectLanguage } = require('../utils/languageDetector');
const { categorizeChat } = require('../utils/categoryClassifier');
const { authenticateAgent } = require('../middleware/auth');
const { findCachedResponse, cacheResponse } = require('../utils/responseCache');

// Initialize Anthropic client
let anthropic;
function getAnthropicClient() {
  if (!anthropic) {
    if (!process.env.CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY environment variable is required');
    }
    anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    });
  }
  return anthropic;
}

/**
 * POST /api/ai/query
 * Main AI query endpoint with RAG, language detection, and confidence scoring
 */
router.post('/query', async (req, res) => {
  const startTime = Date.now();

  try {
    const { chatId, message, userId, userEmail, userName, pageContext } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }

    // 0. Resolve category first (needed for cache key)
    let categoryName = '';
    const chatForCategory = await Chat.findById(chatId);
    if (chatForCategory && chatForCategory.metadata?.categoryId) {
      const cat = await WorkflowCategory.findById(chatForCategory.metadata.categoryId);
      if (cat) categoryName = cat.name || '';
    }

    // Check semantic response cache (include category in key for different greetings per category)
    const cacheKey = categoryName ? `[${categoryName}] ${message}` : message;
    const cachedResult = await findCachedResponse(cacheKey);
    if (cachedResult) {
      await Message.create({
        chatId,
        sender: 'ai',
        content: cachedResult.response,
        metadata: {
          confidence: cachedResult.confidence,
          sources: cachedResult.sources,
          cached: true,
          cacheSimlarity: cachedResult.similarity,
          responseTime: Date.now() - startTime
        }
      });

      return res.json({
        response: cachedResult.response,
        confidence: cachedResult.confidence,
        needsHuman: false,
        sources: (cachedResult.sources || []).map(s => ({ filename: s })),
        cached: true
      });
    }

    // 1. Detect language
    const language = detectLanguage(message);
    console.log(`[AI Query] Language detected: ${language}`);

    // 2. Fetch conversation history (last 20 messages for context)
    const conversationHistory = await Message.find({ chatId })
      .sort({ sentAt: 1 })
      .limit(20)
      .select('sender content');

    // 3. Search knowledge base for relevant context
    const ragResults = await searchKnowledgeBase(message, {
      topK: 8,
      minSimilarity: 0.2
    });

    console.log(`[AI Query] Found ${ragResults.length} relevant knowledge base chunks`);

    // 4. Build Claude prompt
    let systemPrompt = `You are a helpful customer support AI assistant. Answer questions ONLY based on the provided knowledge base context. If the knowledge base doesn't contain the answer, say "I don't have that information in our knowledge base. Let me connect you with a team member who can help." Do NOT make up or guess product names, features, or details not in the knowledge base. Respond in ${language} language.

Important rules:
- ONLY use facts from the knowledge base context provided below — NEVER invent product names, company names, or features
- If no knowledge base context is provided or it doesn't answer the question, clearly say you don't have that information
- NEVER include the user's personal information (their name, phone, email) in your responses
- Do NOT greet the user by name or reference their personal details
- When suggesting the user contact support, ALWAYS include the actual email: support@jobtalk.ai — NEVER say "contact support" without the email
- Do NOT give vague redirect responses like "they can help you" — instead answer the question directly using the knowledge base, and only suggest email as a last resort
- Only provide company contact details when the user specifically asks for contact info, pricing, or important inquiries — do NOT add contact info to every reply
- Focus only on answering the question with relevant product/service information from the knowledge base

Format rules:
- Keep answers SHORT — 2-3 sentences max unless the user asks for detail
- Use bullet points only when listing 3+ items
- Use **bold** sparingly for key terms
- No filler or repetition — get straight to the point`;

    // Add knowledge base context if available
    let contextText = '';
    if (ragResults.length > 0) {
      contextText = 'Knowledge base:\n\n';
      ragResults.forEach((result, idx) => {
        contextText += `[Source ${idx + 1}: ${result.filename}]\n${result.text}\n\n`;
      });
      systemPrompt += `\n\n${contextText}`;
    }

    // Add page context if provided
    if (pageContext) {
      systemPrompt += `\n\nThe user is currently on page: ${pageContext}`;
    }

    // Inject workflow category prompt if chat has one (reuse data from cache key resolution)
    let hasWorkflowCategory = false;
    if (chatForCategory && chatForCategory.metadata?.categoryId) {
      const category = await WorkflowCategory.findById(chatForCategory.metadata.categoryId);
      if (category && category.prompt) {
        systemPrompt = category.prompt + '\n\n' + systemPrompt;
        hasWorkflowCategory = true;
        console.log(`[AI Query] Using workflow category: ${category.name}`);
      }
    }

    // 5. Build conversation messages for Claude
    const messages = [];

    // Include last 6 user/AI message pairs for conversation memory
    // Filter out file-only messages so AI doesn't try to respond to them
    const recentHistory = conversationHistory
      .filter(msg => !msg.content.match(/^\[Sent \d+ file\(s\)\]$/))
      .slice(-12);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // 6. Call Claude API
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '1024'),
      messages: messages,
      system: systemPrompt
    });

    const responseText = response.content[0].text;

    // 7. Calculate confidence score
    let confidence = 0.5; // Default baseline

    // Workflow category responses are always high confidence (admin-defined prompts)
    if (hasWorkflowCategory) {
      confidence = 0.85;
    }

    if (ragResults.length > 0) {
      const maxSimilarity = Math.max(...ragResults.map(r => r.similarity));
      if (maxSimilarity > 0.7) {
        confidence = 0.9;
      } else if (maxSimilarity >= 0.4) {
        confidence = Math.max(confidence, 0.8);
      } else if (ragResults.length >= 3) {
        // Multiple low-similarity matches still provide useful context
        confidence = Math.max(confidence, 0.7);
      }
    }

    // Reduce confidence if AI expresses uncertainty
    const uncertaintyPatterns = [
      /i don't know/i,
      /not sure/i,
      /uncertain/i,
      /can't find/i,
      /no information/i
    ];

    for (const pattern of uncertaintyPatterns) {
      if (pattern.test(responseText)) {
        confidence = Math.max(0.3, confidence - 0.2);
        break;
      }
    }

    // 8. Determine if human escalation is needed
    const confidenceThreshold = parseFloat(process.env.CLAUDE_CONFIDENCE_THRESHOLD || '0.7');
    const needsHuman = confidence < confidenceThreshold;

    // 9. Save AI message to database
    const aiMessage = await Message.create({
      chatId,
      sender: 'ai',
      content: responseText,
      metadata: {
        confidence,
        sources: ragResults.map(r => r.filename),
        language,
        responseTime: Date.now() - startTime
      }
    });

    // 10. Update chat status if escalation needed
    if (needsHuman) {
      await Chat.findByIdAndUpdate(chatId, {
        status: 'waiting',
        mode: 'human'
      });
      console.log(`[AI Query] Low confidence (${confidence.toFixed(2)}), escalating to human`);
    }

    console.log(`[AI Query] Response generated in ${Date.now() - startTime}ms, confidence: ${confidence.toFixed(2)}`);

    // Cache the response for future similar questions (fire-and-forget)
    if (confidence >= 0.7) {
      cacheResponse(
        cacheKey, null, responseText, confidence,
        ragResults.map(r => r.filename)
      ).catch(err => console.error('[Cache] Store failed:', err.message));
    }

    res.json({
      response: responseText,
      confidence,
      needsHuman,
      sources: ragResults.map(r => ({ filename: r.filename, similarity: r.similarity })),
      language,
      cached: false
    });

  } catch (error) {
    console.error('[AI Query] Error:', error);

    if (error.message.includes('CLAUDE_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    if (error.status === 429) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

/**
 * POST /api/ai/summarize
 * Generate one-line summary for a chat conversation
 */
router.post('/summarize', async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }

    // Fetch all messages from the chat
    const messages = await Message.find({ chatId })
      .sort({ sentAt: 1 })
      .select('sender content');

    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages found for this chat' });
    }

    // Build conversation text
    const conversationText = messages
      .map(m => `${m.sender}: ${m.content}`)
      .join('\n');

    // Call Claude to summarize
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Summarize this support conversation in one concise sentence. Be specific about the user's issue or question.\n\n${conversationText}`
      }]
    });

    const summary = response.content[0].text;

    // Update chat with summary
    await Chat.findByIdAndUpdate(chatId, { summary });

    res.json({ summary });

  } catch (error) {
    console.error('[AI Summarize] Error:', error);

    if (error.message.includes('CLAUDE_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * POST /api/ai/categorize
 * Categorize a chat based on message content
 */
router.post('/categorize', async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }

    // Fetch messages
    const messages = await Message.find({ chatId })
      .select('sender content');

    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages found for this chat' });
    }

    // Categorize using keyword-based classifier
    const category = categorizeChat(messages);

    // Update chat with category
    await Chat.findByIdAndUpdate(chatId, { category });

    console.log(`[AI Categorize] Chat ${chatId} categorized as: ${category}`);

    res.json({ category });

  } catch (error) {
    console.error('[AI Categorize] Error:', error);
    res.status(500).json({ error: 'Failed to categorize chat' });
  }
});

/**
 * POST /api/ai/suggest-reply
 * AI copilot endpoint that suggests agent replies based on chat history
 */
router.post('/suggest-reply', authenticateAgent, async (req, res) => {
  try {
    const { chatId } = req.body;

    // Validate chatId provided
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }

    // Check if CLAUDE_API_KEY is configured
    let client;
    try {
      client = getAnthropicClient();
    } catch (err) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // Find chat and validate it exists
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(400).json({ error: 'Invalid chatId' });
    }

    // Validate chat is assigned to requesting agent
    if (!chat.assignedAgent || chat.assignedAgent.toString() !== req.agent.agentId) {
      return res.status(403).json({ error: 'Chat not assigned to you' });
    }

    // Fetch last 10 messages for chat history context
    const messages = await Message.find({ chatId })
      .sort({ sentAt: -1 })
      .limit(10)
      .select('sender senderName content isInternal sentAt');

    // Reverse to chronological order
    messages.reverse();

    // Filter out internal messages (agent notes) and format for AI
    const chatHistory = messages
      .filter(msg => !msg.isInternal)
      .map(msg => {
        let label = 'User';
        if (msg.sender === 'agent') label = 'Agent';
        if (msg.sender === 'ai') label = 'AI';
        return `${label}: ${msg.content}`;
      })
      .join('\n');

    // Construct prompt for Claude API
    const prompt = `You are an AI copilot assisting a customer support agent. Based on the chat history below, suggest a helpful reply the agent can send to the user. Keep it professional, concise, and empathetic.

Chat history:
${chatHistory}

Suggest a reply:`;

    // Call Anthropic API
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Extract suggested reply from response
      const suggestedReply = response.content[0].text;

      return res.status(200).json({ suggestedReply });
    } catch (apiErr) {
      console.error('Anthropic API error:', apiErr);
      return res.status(500).json({ error: 'AI service error' });
    }
  } catch (err) {
    console.error('Suggest reply error:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid chatId format' });
    }
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/analyze-sentiment
 * Analyze chat sentiment and assign priority based on message tone and content
 */
router.post('/analyze-sentiment', async (req, res) => {
  try {
    const { chatId, sessionId } = req.body;

    // Accept either chatId or sessionId
    if (!chatId && !sessionId) {
      return res.status(400).json({ error: 'chatId or sessionId is required' });
    }

    // Find chat by chatId or sessionId
    let chat;
    if (chatId) {
      chat = await Chat.findById(chatId);
    } else {
      chat = await Chat.findOne({ sessionId });
    }

    if (!chat) {
      return res.status(400).json({ error: 'Chat not found' });
    }

    // Fetch all messages from chat (focus on user messages)
    const messages = await Message.find({ chatId: chat._id })
      .sort({ sentAt: 1 })
      .select('sender content sentAt');

    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages found for this chat' });
    }

    // Build conversation text from user messages only
    const userMessages = messages.filter(m => m.sender === 'user');
    const conversationText = userMessages
      .map(m => `[${new Date(m.sentAt).toISOString()}] ${m.content}`)
      .join('\n');

    // Claude API call for sentiment analysis
    let client;
    try {
      client = getAnthropicClient();
    } catch (err) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const prompt = `Analyze the sentiment and urgency of this customer support conversation.
Consider: user tone (frustrated, angry, calm, happy), urgency keywords (urgent, ASAP, emergency, critical),
issue severity (payment failed, data lost, minor question), message frequency/length.

Conversation:
${conversationText}

Respond with JSON only:
{
  "sentiment": "positive" | "neutral" | "negative",
  "priority": "low" | "medium" | "high",
  "reasoning": "Brief explanation"
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Parse Claude response JSON
    const responseText = response.content[0].text;
    let analysis;
    try {
      // Extract JSON from response (may include code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('[Sentiment Analysis] Failed to parse Claude response:', responseText);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Update Chat document with sentiment and priority
    await Chat.findByIdAndUpdate(chat._id, {
      sentiment: analysis.sentiment,
      priority: analysis.priority,
      'metadata.sentimentReasoning': analysis.reasoning
    });

    console.log(`[Sentiment Analysis] Chat ${chat._id}: ${analysis.sentiment} sentiment, ${analysis.priority} priority`);

    // Broadcast to dashboard via WebSocket
    const { broadcastToDashboard } = require('../websocket');
    broadcastToDashboard('dashboard.chat.updated', {
      sessionId: chat.sessionId,
      chatId: chat._id,
      sentiment: analysis.sentiment,
      priority: analysis.priority
    });

    res.json({
      sentiment: analysis.sentiment,
      priority: analysis.priority,
      reasoning: analysis.reasoning
    });

  } catch (error) {
    console.error('[Sentiment Analysis] Error:', error);

    if (error.message.includes('CLAUDE_API_KEY')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    if (error.status === 429) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

module.exports = router;
