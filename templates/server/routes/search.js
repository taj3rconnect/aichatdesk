/**
 * @file Search Routes — Unified cross-entity search for the operator dashboard
 * @description Provides a single search endpoint that queries across chats, messages,
 *   agents, and teams in parallel for fast results. Uses case-insensitive regex matching
 *   with special character escaping. Results are grouped by type with sensible limits
 *   (10 chats, 15 messages, 10 agents, 5 teams). Message results include parent chat
 *   context (sessionId, userName) for navigation.
 *
 * @requires ../middleware/auth - Agent authentication
 */

const express = require('express');
const router = express.Router();
const { Chat, Message, Agent, Role } = require('../db/models');
const { authenticateAgent } = require('../middleware/auth');

/**
 * GET /api/search?q=...
 * Fast unified search across chats, messages, agents, and teams
 * Returns results grouped by type, limited for speed
 */
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ chats: [], messages: [], agents: [], teams: [] });
    }

    // Escape regex special chars for safe regex search
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    // Run all searches in parallel for speed
    const [chats, messages, agents, teams] = await Promise.all([
      // Search chats by userName, userEmail, summary
      Chat.find({
        $or: [
          { userName: regex },
          { userEmail: regex },
          { summary: regex }
        ]
      })
        .select('sessionId userName userEmail status mode priority summary startedAt')
        .sort({ startedAt: -1 })
        .limit(10)
        .lean(),

      // Search messages by content
      Message.find({ content: regex })
        .select('chatId sender senderName content sentAt')
        .sort({ sentAt: -1 })
        .limit(15)
        .lean()
        .then(async msgs => {
          // Populate chat info for each message
          const chatIds = [...new Set(msgs.map(m => m.chatId.toString()))];
          const chatMap = {};
          if (chatIds.length > 0) {
            const chatDocs = await Chat.find({ _id: { $in: chatIds } })
              .select('sessionId userName')
              .lean();
            chatDocs.forEach(c => { chatMap[c._id.toString()] = c; });
          }
          return msgs.map(m => ({
            ...m,
            chatSessionId: chatMap[m.chatId.toString()]?.sessionId,
            chatUserName: chatMap[m.chatId.toString()]?.userName
          }));
        }),

      // Search agents by name, email, roles (team names)
      Agent.find({
        active: true,
        $or: [
          { name: regex },
          { email: regex },
          { roles: regex }
        ]
      })
        .select('name email systemRole roles status')
        .limit(10)
        .lean(),

      // Search teams/roles by name, description
      Role.find({
        active: true,
        $or: [
          { name: regex },
          { description: regex }
        ]
      })
        .select('name icon description')
        .limit(5)
        .lean()
    ]);

    res.json({ chats, messages, agents, teams });
  } catch (error) {
    console.error('[Search] Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
