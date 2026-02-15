const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Chat, Agent, Message } = require('../db/models');
const { assignAgentToChat } = require('../utils/routing');
const { authenticateAgent } = require('../middleware/auth');
const { broadcast } = require('../websocket');
const { sendNewChatNotification } = require('../utils/email');
const { createGitHubIssue } = require('../utils/github');
const { sendTeamsNotification } = require('../utils/teamsBot');

const router = express.Router();

/**
 * POST /api/chat
 * Create new chat session and attempt agent assignment
 */
router.post('/', async (req, res) => {
  try {
    const { userEmail, userName, subject, currentPage, ticketType, userPriority, mood, environment, categoryId } = req.body;

    // Validate required fields
    if (!userEmail || !userName) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Generate session ID
    const sessionId = uuidv4();

    // Capture metadata for user context
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     '';

    // Create chat document
    const chat = new Chat({
      sessionId,
      userEmail,
      userName,
      status: 'active',
      mode: 'ai',
      category: 'general',
      ticketType: ticketType || 'chat',
      userPriority: userPriority || undefined,
      mood: mood ? parseInt(mood) : undefined,
      metadata: {
        userAgent,
        ipAddress,
        currentPage: currentPage || '',
        environment: environment || null,
        categoryId: categoryId || null
      }
    });

    await chat.save();

    // Send new chat notification email (fire-and-forget)
    try {
      sendNewChatNotification(chat).catch(err =>
        console.error('Email notification error:', err)
      );
    } catch (err) {
      // Silently fail - don't block chat creation
      console.error('Failed to trigger email notification:', err);
    }

    // Send Teams notification (fire-and-forget)
    sendTeamsNotification(chat).catch(err =>
      console.error('Teams notification error:', err.message)
    );

    // Create GitHub issue for non-chat ticket types (fire-and-forget)
    if (ticketType && ticketType !== 'chat') {
      createGitHubIssue(chat, subject || '').catch(err =>
        console.error('GitHub issue creation error:', err.message)
      );
    }

    // Attempt to assign agent based on category
    let assignment = null;
    try {
      assignment = await assignAgentToChat(chat._id, chat.category);
    } catch (err) {
      // Routing errors are non-fatal - log and continue in AI mode
      console.error('Agent assignment error (non-fatal):', err);
    }

    // Build response
    const response = {
      sessionId: chat.sessionId,
      chatId: chat._id,
      mode: 'ai'
    };

    // Include assigned agent info if available
    if (assignment) {
      response.assignedAgent = {
        id: assignment.agentId,
        name: assignment.agentName
      };
    }

    return res.status(201).json(response);
  } catch (err) {
    console.error('Create chat error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chat/:sessionId/escalate
 * Escalate chat from AI to human agent
 */
router.post('/:sessionId/escalate', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find chat by session ID
    const chat = await Chat.findOne({ sessionId });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if already in human mode
    if (chat.mode === 'human' && chat.assignedAgent) {
      return res.status(200).json({
        message: 'Chat already assigned to agent',
        agent: {
          id: chat.assignedAgent
        }
      });
    }

    // Update status to waiting (queue for agent)
    chat.status = 'waiting';
    chat.mode = 'human';
    await chat.save();

    // Attempt to assign agent
    let assignment = null;
    try {
      const category = chat.category || 'general';
      assignment = await assignAgentToChat(chat._id, category);
    } catch (err) {
      // Routing errors are non-fatal
      console.error('Agent assignment error during escalation (non-fatal):', err);
    }

    // Build response
    if (assignment) {
      return res.status(200).json({
        message: 'Chat assigned to agent',
        agent: {
          id: assignment.agentId,
          name: assignment.agentName
        }
      });
    } else {
      return res.status(200).json({
        message: 'Chat in queue - no agents available',
        status: 'waiting'
      });
    }
  } catch (err) {
    console.error('Escalate chat error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/:sessionId
 * Get chat session details
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const chat = await Chat.findOne({ sessionId })
      .populate('assignedAgent', 'name avatar status')
      .select('-__v');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    return res.status(200).json({
      chat: {
        id: chat._id,
        sessionId: chat.sessionId,
        status: chat.status,
        mode: chat.mode,
        category: chat.category,
        assignedAgent: chat.assignedAgent ? {
          id: chat.assignedAgent._id,
          name: chat.assignedAgent.name,
          avatar: chat.assignedAgent.avatar,
          status: chat.assignedAgent.status
        } : null
      }
    });
  } catch (err) {
    console.error('Get chat error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chat/:sessionId/takeover
 * Agent manually takes over AI chat
 */
router.post('/:sessionId/takeover', authenticateAgent, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find chat by session ID
    const chat = await Chat.findOne({ sessionId });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if already in human mode with assigned agent (idempotent)
    if (chat.mode === 'human' && chat.assignedAgent) {
      const agent = await Agent.findById(chat.assignedAgent);
      return res.status(200).json({
        success: true,
        message: 'Already assigned',
        agent: {
          id: agent._id,
          name: agent.name
        }
      });
    }

    // Update chat to human mode
    chat.mode = 'human';
    chat.assignedAgent = req.agent.agentId;
    chat.status = 'active';
    await chat.save();

    // Fetch agent name for response
    const agent = await Agent.findById(req.agent.agentId);

    // Broadcast WebSocket event to notify user
    broadcast({
      type: 'agent.takeover',
      sessionId,
      agentName: agent.name,
      timestamp: new Date().toISOString()
    }, sessionId);

    return res.status(200).json({
      success: true,
      agent: {
        id: agent._id,
        name: agent.name
      },
      message: 'Takeover successful'
    });
  } catch (err) {
    console.error('Takeover error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/chat/:sessionId/return-to-ai
 * Agent returns chat to AI mode
 */
router.post('/:sessionId/return-to-ai', authenticateAgent, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find chat by session ID
    const chat = await Chat.findOne({ sessionId });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Validate requesting agent is the assignedAgent
    if (chat.assignedAgent && chat.assignedAgent.toString() !== req.agent.agentId) {
      return res.status(403).json({ error: 'Only assigned agent can return chat to AI' });
    }

    // Update chat to AI mode
    chat.mode = 'ai';
    chat.assignedAgent = null;
    await chat.save();

    // Broadcast WebSocket event to notify user
    broadcast({
      type: 'agent.return',
      sessionId,
      timestamp: new Date().toISOString()
    }, sessionId);

    return res.status(200).json({
      success: true,
      message: 'Chat returned to AI'
    });
  } catch (err) {
    console.error('Return to AI error:', err);
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      return res.status(500).json({ error: 'Database error' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/chat/:sessionId/messages
 * Get all messages for a chat session
 */
router.get('/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const chat = await Chat.findOne({ sessionId });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const { Message } = require('../db/models');
    const messages = await Message.find({ chatId: chat._id })
      .sort({ sentAt: 1 })
      .select('sender senderName content isInternal sentAt attachments');

    return res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/chat/:sessionId
 * Delete a chat and all its messages (admin only)
 */
router.delete('/:sessionId', authenticateAgent, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify agent is admin
    const agent = await Agent.findById(req.agent.agentId);
    if (!agent || agent.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const chat = await Chat.findOne({ sessionId });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Delete all messages for this chat
    const msgResult = await Message.deleteMany({ chatId: chat._id });

    // Delete the chat
    await Chat.findByIdAndDelete(chat._id);

    console.log(`[Admin] Deleted chat ${sessionId} (${msgResult.deletedCount} messages)`);

    return res.json({
      success: true,
      deletedMessages: msgResult.deletedCount
    });
  } catch (err) {
    console.error('Delete chat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/chat/:sessionId/category
 * Set workflow category on a chat
 */
router.patch('/:sessionId/category', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { categoryId } = req.body;

    const chat = await Chat.findOne({ sessionId });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (!chat.metadata) chat.metadata = {};
    chat.metadata.categoryId = categoryId;
    chat.markModified('metadata');
    await chat.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('Set category error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/chat/:sessionId/notes
 * Save agent notes for a chat
 */
router.put('/:sessionId/notes', authenticateAgent, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;

    const chat = await Chat.findOne({ sessionId });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    chat.agentNotes = notes || '';
    await chat.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('Save notes error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
