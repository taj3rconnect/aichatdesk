/**
 * @file Messages Routes — Message creation, profanity detection, agent learning, and chat end
 * @description Handles message persistence with real-time WebSocket broadcasting,
 *   profanity flagging, automatic knowledge base learning from agent replies,
 *   and chat session closure with transcript emailing.
 *
 *   Key features:
 *     - Profanity detection: Checks user messages against a word list, flags chat
 *       metadata.profanity=true and broadcasts to dashboard for agent awareness
 *     - Agent learning (learnFromAgentReply): When an agent sends a non-internal message,
 *       the Q&A pair (last user question + agent answer) is embedded and stored in the
 *       knowledge base. Duplicate detection (cosine similarity >= 0.85) merges new info
 *       into existing entries instead of creating duplicates
 *     - Internal notes: Agent-only messages (isInternal=true) require auth and are not
 *       broadcast to the widget user
 *     - Chat end: Closes session, saves optional rating, sends transcript email,
 *       broadcasts closure to both widget and dashboard
 *
 * @requires ../websocket - Real-time message broadcasting
 * @requires ../utils/email - Chat transcript email delivery
 * @requires ../utils/embeddings - Vector embedding generation for knowledge base
 * @requires ../utils/vectorSearch - Cosine similarity for duplicate detection
 * @requires ../utils/teamsBot - Forward user messages to Teams threads
 */

const express = require('express');
const { Message, Chat, Agent, KnowledgeBase, Embedding } = require('../db/models');
const { authenticateAgent } = require('../middleware/auth');
const { broadcast, broadcastToDashboard } = require('../websocket');
const { sendChatTranscript } = require('../utils/email');
const { generateEmbedding } = require('../utils/embeddings');
const { cosineSimilarity } = require('../utils/vectorSearch');
const { sendTeamsReply } = require('../utils/teamsBot');

const router = express.Router();

/** Cosine similarity threshold for duplicate Q&A detection — above this, merge instead of creating new */
const DUPLICATE_THRESHOLD = 0.85;

/**
 * Learn from agent reply: save Q&A pair to knowledge base with embedding.
 * Checks for duplicates first — if a similar Q&A exists, merges any new info.
 * Runs async (fire-and-forget) so it doesn't slow down the response.
 */
async function learnFromAgentReply(chatId, agentAnswer) {
  try {
    // Find the last user message before this agent reply
    const lastUserMsg = await Message.findOne({
      chatId,
      sender: 'user',
      isInternal: { $ne: true }
    }).sort({ sentAt: -1 });

    if (!lastUserMsg) return;

    const question = lastUserMsg.content;
    // Strip user's personal info from the question only (keep agent answer intact for contact details etc.)
    const cleanQuestion = question
      .replace(/\b(my name is|i'm|i am)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*/gi, '[user]')
      .replace(/\b(my (email|phone|number|cell) is)\s+\S+/gi, '[user contact]');
    const qaText = `Q: ${cleanQuestion}\nA: ${agentAnswer}`;

    // Generate embedding for the new Q&A
    const newEmbeddingVector = await generateEmbedding(qaText);

    // Search ALL existing embeddings for duplicates (not just agent-reply)
    const existingEmbeddings = await Embedding.find({}).lean();

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const existing of existingEmbeddings) {
      if (!existing.embedding || existing.embedding.length === 0) continue;
      const similarity = cosineSimilarity(newEmbeddingVector, existing.embedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = existing;
      }
    }

    // Duplicate found — merge new info into existing entry
    if (bestMatch && bestSimilarity >= DUPLICATE_THRESHOLD) {
      const existingKB = await KnowledgeBase.findById(bestMatch.knowledgeBaseId);
      if (!existingKB) {
        // KB doc gone, clean up orphan embedding and create fresh
        await Embedding.findByIdAndDelete(bestMatch._id);
      } else {
        // Merge: append the new answer if it adds info the old one doesn't have
        const existingContent = existingKB.content || '';
        const mergedContent = `${existingContent}\n\n---\nQ: ${question}\nA: ${agentAnswer}`;

        existingKB.content = mergedContent;
        existingKB.chunks[0].text = mergedContent;
        await existingKB.save();

        // Re-generate embedding for the merged content
        const mergedVector = await generateEmbedding(mergedContent);
        await Embedding.findByIdAndUpdate(bestMatch._id, {
          text: mergedContent,
          embedding: mergedVector
        });

        console.log(`[Learn] Merged agent Q&A into existing KB (similarity: ${bestSimilarity.toFixed(3)}): "${question.substring(0, 50)}..."`);
        return;
      }
    }

    // No duplicate — create new KB entry
    const kbEntry = await KnowledgeBase.create({
      filename: `agent-reply-${Date.now()}`,
      originalName: 'Agent Reply (auto-learned)',
      fileType: 'qa-pair',
      content: qaText,
      chunks: [{ text: qaText }],
      active: true
    });

    const embedding = await Embedding.create({
      knowledgeBaseId: kbEntry._id,
      chunkIndex: 0,
      text: qaText,
      embedding: newEmbeddingVector,
      metadata: { source: 'agent-reply', chatId: chatId.toString() }
    });

    kbEntry.chunks[0].embeddingId = embedding._id;
    await kbEntry.save();

    console.log(`[Learn] Saved new agent Q&A to knowledge base: "${question.substring(0, 50)}..."`);
  } catch (err) {
    console.error('[Learn] Failed to save agent reply to KB:', err.message);
  }
}

/**
 * POST /api/messages
 * Create a new message (supports agent messages and internal notes)
 */
router.post('/', async (req, res) => {
  try {
    const { chatId, content, isInternal, sender } = req.body;

    // Validate required fields
    if (!chatId || !content) {
      return res.status(400).json({ error: 'chatId and content are required' });
    }

    // Profanity check on user messages — flag chat if detected
    const PROFANITY_LIST = [
      'fuck', 'shit', 'ass', 'bitch', 'damn', 'hell', 'crap', 'dick', 'cock',
      'pussy', 'bastard', 'whore', 'slut', 'piss', 'cunt', 'twat', 'wanker',
      'bollocks', 'arse', 'motherfucker', 'bullshit', 'asshole', 'dumbass',
      'jackass', 'goddamn', 'stfu', 'wtf', 'lmfao', 'fk', 'fck', 'sht'
    ];
    const contentLower = content.toLowerCase().replace(/[^a-z\s]/g, '');
    const words = contentLower.split(/\s+/);
    const hasProfanity = words.some(w => PROFANITY_LIST.includes(w));
    if (hasProfanity && (!sender || sender === 'user')) {
      try {
        const flagChat = await Chat.findById(chatId);
        if (flagChat && !flagChat.metadata?.profanity) {
          if (!flagChat.metadata) flagChat.metadata = {};
          flagChat.metadata.profanity = true;
          flagChat.markModified('metadata');
          await flagChat.save();
          console.log(`[Profanity] Flagged chat ${chatId}`);
          broadcastToDashboard('chat.flagged', { chatId, sessionId: flagChat.sessionId, reason: 'profanity' });
        }
      } catch (e) { console.error('[Profanity] Flag error:', e.message); }
    }

    // Determine sender type from request
    let resolvedSender = sender || 'user';
    let senderName = null;

    // If agent or internal note, try to authenticate
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.agent = decoded;
      } catch (err) {
        if (isInternal) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
      }
    } else if (isInternal) {
      return res.status(401).json({ error: 'Authentication required for internal notes' });
    }

    // Validate chat exists
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get sender name if authenticated agent
    if (req.agent && req.agent.agentId) {
      const agent = await Agent.findById(req.agent.agentId);
      if (agent) {
        senderName = agent.name;
        if (sender === 'agent' || isInternal) {
          resolvedSender = 'agent';
        }
      }
    }

    // Parse attachments — ensure always an array of objects
    let attachments = req.body.attachments || [];
    if (typeof attachments === 'string') {
      try { attachments = JSON.parse(attachments); } catch { attachments = []; }
    }
    if (!Array.isArray(attachments)) attachments = [];
    // Ensure each item is a plain object (not a string)
    attachments = attachments.map(a => {
      if (typeof a === 'string') {
        try { return JSON.parse(a); } catch { return null; }
      }
      return a;
    }).filter(Boolean);

    // Create message document
    const message = new Message({
      chatId,
      sender: resolvedSender,
      senderName,
      content,
      attachments,
      isInternal: isInternal || false
    });

    await message.save();

    // Broadcast WebSocket event only if not internal
    if (!isInternal) {
      const msgPayload = {
        id: message._id,
        chatId: message.chatId,
        sender: message.sender,
        senderName: message.senderName,
        content: message.content,
        attachments: message.attachments || [],
        sentAt: message.sentAt
      };
      // Send to session clients (widget)
      broadcast({
        type: 'chat.message',
        sessionId: chat.sessionId,
        message: msgPayload
      }, chat.sessionId);
      // Also notify all dashboard clients so they refresh in real-time
      broadcastToDashboard('chat.message', {
        sessionId: chat.sessionId,
        message: msgPayload
      });
    }

    // If user sent a message, forward to Teams thread (fire-and-forget)
    if (resolvedSender === 'user' && !isInternal) {
      sendTeamsReply(chat.sessionId, content, chat.userName || 'Customer').catch(() => {});
    }

    // If agent sent a non-internal message, learn from it (async, fire-and-forget)
    if (resolvedSender === 'agent' && !isInternal) {
      learnFromAgentReply(chatId, content).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: {
        id: message._id,
        chatId: message.chatId,
        sender: message.sender,
        senderName: message.senderName,
        content: message.content,
        isInternal: message.isInternal,
        sentAt: message.sentAt
      }
    });
  } catch (err) {
    console.error('Create message error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chat/:sessionId/end
 * End chat session and send transcript email
 */
router.post('/chat/:sessionId/end', express.text({ type: '*/*' }), async (req, res) => {
  try {
    const { sessionId } = req.params;
    // Handle sendBeacon (text/plain body) and normal JSON
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const { rating, ratingComment } = body || {};

    // Find chat by session ID
    const chat = await Chat.findOne({ sessionId });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if already closed
    if (chat.status === 'closed') {
      return res.status(400).json({ error: 'Chat already closed' });
    }

    // Update chat status
    chat.status = 'closed';
    chat.endedAt = new Date();

    // Update rating if provided
    if (rating !== undefined) {
      chat.rating = rating;
    }
    if (ratingComment) {
      chat.ratingComment = ratingComment;
    }

    await chat.save();

    // Send transcript email (fire-and-forget)
    try {
      sendChatTranscript(chat._id).catch(err =>
        console.error('Transcript email error:', err)
      );
    } catch (err) {
      // Silently fail - don't block response
      console.error('Failed to trigger transcript email:', err);
    }

    // Broadcast WebSocket event to session and dashboard
    try {
      broadcast({
        type: 'dashboard.chat.closed',
        sessionId,
        chatId: chat._id
      }, sessionId);
      broadcastToDashboard('chat.closed', { sessionId, chatId: chat._id });
    } catch (err) {
      console.error('WebSocket broadcast error:', err);
    }
    console.log(`[Chat] Ended: ${sessionId}`);

    return res.status(200).json({
      success: true,
      message: 'Chat ended',
      transcript: chat.userEmail ? `Email sent to ${chat.userEmail}` : 'No email configured'
    });
  } catch (err) {
    console.error('End chat error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
