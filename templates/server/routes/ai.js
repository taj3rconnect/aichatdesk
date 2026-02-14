const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { Chat, Message } = require('../db/models');
const { searchKnowledgeBase } = require('../utils/vectorSearch');
const { detectLanguage } = require('../utils/languageDetector');
const { categorizeChat } = require('../utils/categoryClassifier');

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
      topK: 3,
      minSimilarity: 0.5
    });

    console.log(`[AI Query] Found ${ragResults.length} relevant knowledge base chunks`);

    // 4. Build Claude prompt
    let systemPrompt = `You are a helpful customer support AI assistant. Answer questions based on the provided knowledge base context when available. If the knowledge base doesn't contain the answer, say so clearly and provide general help if possible. Respond in ${language} language.`;

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

    // 5. Build conversation messages for Claude
    const messages = [];

    // Include last 6 user/AI message pairs for conversation memory
    const recentHistory = conversationHistory.slice(-12);
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
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '1024'),
      messages: messages,
      system: systemPrompt
    });

    const responseText = response.content[0].text;

    // 7. Calculate confidence score
    let confidence = 0.5; // Default baseline

    if (ragResults.length > 0) {
      const maxSimilarity = Math.max(...ragResults.map(r => r.similarity));
      if (maxSimilarity > 0.7) {
        confidence = 0.9;
      } else if (maxSimilarity >= 0.5) {
        confidence = 0.7;
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

    res.json({
      response: responseText,
      confidence,
      needsHuman,
      sources: ragResults.map(r => ({ filename: r.filename, similarity: r.similarity })),
      language
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
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
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

module.exports = router;
