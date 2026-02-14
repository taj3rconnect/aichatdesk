const express = require('express');
const { Message, Chat, Agent } = require('../db/models');
const { authenticateAgent } = require('../middleware/auth');
const { broadcast } = require('../websocket');
const { sendChatTranscript } = require('../utils/email');

const router = express.Router();

/**
 * POST /api/messages
 * Create a new message (supports internal agent notes)
 */
router.post('/', async (req, res) => {
  try {
    const { chatId, content, isInternal } = req.body;

    // Validate required fields
    if (!chatId || !content) {
      return res.status(400).json({ error: 'chatId and content are required' });
    }

    // If internal note, require authentication
    if (isInternal) {
      // Check if agent is authenticated
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required for internal notes' });
      }

      // Manually verify token (authenticateAgent middleware not used on route)
      const jwt = require('jsonwebtoken');
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.agent = decoded;
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    // Validate chat exists
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get sender name if authenticated agent
    let senderName = 'Agent';
    if (req.agent && req.agent.agentId) {
      const agent = await Agent.findById(req.agent.agentId);
      if (agent) {
        senderName = agent.name;
      }
    }

    // Create message document
    const message = new Message({
      chatId,
      sender: isInternal ? 'agent' : 'user',
      senderName: isInternal ? senderName : null,
      content,
      isInternal: isInternal || false
    });

    await message.save();

    // Broadcast WebSocket event only if not internal
    if (!isInternal) {
      broadcast({
        type: 'chat.message',
        message: {
          id: message._id,
          chatId: message.chatId,
          sender: message.sender,
          senderName: message.senderName,
          content: message.content,
          sentAt: message.sentAt
        }
      }, chat.sessionId);
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
router.post('/chat/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, ratingComment } = req.body;

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

    // Broadcast WebSocket event
    try {
      broadcast({
        type: 'dashboard.chat.closed',
        sessionId,
        chatId: chat._id
      }, sessionId);
    } catch (err) {
      // Log but don't fail
      console.error('WebSocket broadcast error:', err);
    }

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
