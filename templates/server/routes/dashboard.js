/**
 * Dashboard API Routes
 *
 * Provides REST endpoints for operator dashboard data.
 * Works in both standalone (localhost:3003) and embedded (/aichatdesk/dashboard) modes.
 */

const express = require('express');
const router = express.Router();
const { Chat } = require('../db/models');

/**
 * GET /api/dashboard/chats
 * Retrieve all active/waiting chats with populated agent info
 */
router.get('/chats', async (req, res) => {
  try {
    const chats = await Chat.find({
      status: { $in: ['active', 'waiting'] }
    })
      .populate('assignedAgent', 'name avatar status')
      .sort({ startedAt: -1 })
      .lean();

    // Calculate wait time for each chat
    const now = Date.now();
    const enrichedChats = chats.map(chat => {
      const waitTimeMs = now - new Date(chat.startedAt).getTime();
      const waitTimeMinutes = Math.floor(waitTimeMs / 60000);

      return {
        ...chat,
        waitTime: waitTimeMinutes
      };
    });

    res.json(enrichedChats);
  } catch (err) {
    console.error('Error fetching dashboard chats:', err);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

module.exports = router;
