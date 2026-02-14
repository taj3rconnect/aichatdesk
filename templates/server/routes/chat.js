const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Chat } = require('../db/models');
const { assignAgentToChat } = require('../utils/routing');

const router = express.Router();

/**
 * POST /api/chat
 * Create new chat session and attempt agent assignment
 */
router.post('/', async (req, res) => {
  try {
    const { userEmail, userName, subject } = req.body;

    // Validate required fields
    if (!userEmail || !userName) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Generate session ID
    const sessionId = uuidv4();

    // Create chat document
    const chat = new Chat({
      sessionId,
      userEmail,
      userName,
      status: 'active',
      mode: 'ai', // Default to AI mode
      category: 'general' // Default category, can be updated by AI later
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

module.exports = router;
