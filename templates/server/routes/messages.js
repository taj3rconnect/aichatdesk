const express = require('express');
const { Message, Chat, Agent } = require('../db/models');
const { authenticateAgent } = require('../middleware/auth');
const { broadcast } = require('../websocket');

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

module.exports = router;
