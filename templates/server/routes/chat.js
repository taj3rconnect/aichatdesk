const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Chat, Agent } = require('../db/models');
const { assignAgentToChat } = require('../utils/routing');
const { authenticateAgent } = require('../middleware/auth');
const { broadcast } = require('../websocket');

const router = express.Router();

/**
 * POST /api/chat
 * Create new chat session and attempt agent assignment
 */
router.post('/', async (req, res) => {
  try {
    const { userEmail, userName, subject, currentPage } = req.body;

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
      mode: 'ai', // Default to AI mode
      category: 'general', // Default category, can be updated by AI later
      metadata: {
        userAgent,
        ipAddress,
        currentPage: currentPage || ''
      }
    });

    await chat.save();

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
      mode: assignment ? 'human' : 'ai'
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

module.exports = router;
