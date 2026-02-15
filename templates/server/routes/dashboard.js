/**
 * Dashboard API Routes
 *
 * Provides REST endpoints for operator dashboard data.
 * Works in both standalone (localhost:3003) and embedded (/aichatdesk/dashboard) modes.
 */

const express = require('express');
const router = express.Router();
const UAParser = require('ua-parser-js');
const { Chat, Message } = require('../db/models');
const { getLocationFromIP } = require('../utils/geoip');

/**
 * GET /api/dashboard/chats
 * Retrieve all active/waiting chats with populated agent info
 */
router.get('/chats', async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const chats = await Chat.find({
      $or: [
        { status: { $in: ['active', 'waiting'] } },
        { status: 'closed', endedAt: { $gte: oneDayAgo } }
      ]
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

/**
 * GET /api/dashboard/chats/:sessionId/info
 * Retrieve comprehensive user info for selected chat
 */
router.get('/chats/:sessionId/info', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find chat by sessionId
    const chat = await Chat.findOne({ sessionId })
      .populate('assignedAgent', 'name avatar')
      .lean();

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Extract metadata
    const userAgent = chat.metadata?.userAgent || '';
    const ipAddress = chat.metadata?.ipAddress || '';
    const currentPage = chat.metadata?.currentPage || '';

    // Parse userAgent for browser/OS/device info
    const parser = new UAParser(userAgent);
    const browserInfo = parser.getBrowser();
    const osInfo = parser.getOS();
    const deviceInfo = parser.getDevice();

    // Lookup location from IP address
    const location = await getLocationFromIP(ipAddress);

    // Build response
    const userInfo = {
      userName: chat.userName || 'Unknown',
      userEmail: chat.userEmail || 'Unknown',
      browser: {
        name: browserInfo.name || 'Unknown',
        version: browserInfo.version || ''
      },
      os: {
        name: osInfo.name || 'Unknown',
        version: osInfo.version || ''
      },
      device: {
        type: deviceInfo.type || 'desktop'
      },
      location: location || {
        country: 'Unknown',
        region: '',
        city: 'Unknown',
        timezone: 'UTC'
      },
      currentPage: currentPage || 'Unknown',
      ipAddress: ipAddress || 'Unknown',
      sessionStarted: chat.startedAt || chat.createdAt
    };

    res.json(userInfo);
  } catch (err) {
    console.error('Error fetching user info:', err);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

/**
 * GET /api/dashboard/chats/:sessionId/attachments
 * Retrieve all attachments from chat messages
 */
router.get('/chats/:sessionId/attachments', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find chat by sessionId
    const chat = await Chat.findOne({ sessionId }).lean();

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Find all messages with attachments
    const messages = await Message.find({
      chatId: chat._id,
      attachments: { $exists: true, $ne: [] }
    })
      .select('attachments sender sentAt')
      .sort({ sentAt: -1 }) // Newest first
      .lean();

    // Flatten attachments with metadata
    const attachments = [];
    messages.forEach(message => {
      if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach(attachment => {
          attachments.push({
            messageId: message._id,
            filename: attachment.filename,
            url: attachment.url,
            type: attachment.type,
            size: attachment.size,
            sender: message.sender,
            uploadedAt: message.sentAt
          });
        });
      }
    });

    res.json(attachments);
  } catch (err) {
    console.error('Error fetching attachments:', err);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

/**
 * GET /api/dashboard/chats/search?q={query}
 * Full-text search across chat messages, user names, emails, and summaries
 */
router.get('/chats/search', async (req, res) => {
  try {
    const { q: query } = req.query;

    // Validate query
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const searchQuery = query.trim();
    const regex = new RegExp(searchQuery, 'i'); // Case-insensitive regex

    // Find message chatIds matching query content
    const messageMatches = await Message.find({
      content: { $regex: regex }
    }).distinct('chatId');

    // Find chats matching query directly or via messages
    const chats = await Chat.find({
      $or: [
        { _id: { $in: messageMatches } },
        { userName: { $regex: regex } },
        { userEmail: { $regex: regex } },
        { summary: { $regex: regex } }
      ]
    })
      .populate('assignedAgent', 'name avatar')
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();

    // Find matching messages for each chat to provide snippet
    const enrichedChats = await Promise.all(chats.map(async (chat) => {
      // Find first matching message for this chat
      const matchingMessage = await Message.findOne({
        chatId: chat._id,
        content: { $regex: regex }
      })
        .select('content sender')
        .sort({ sentAt: 1 })
        .lean();

      return {
        ...chat,
        matchSnippet: matchingMessage ? matchingMessage.content : null,
        matchType: matchingMessage ? 'message' :
                   (regex.test(chat.userName) ? 'userName' :
                   (regex.test(chat.userEmail) ? 'userEmail' :
                   (regex.test(chat.summary) ? 'summary' : 'unknown')))
      };
    }));

    res.json(enrichedChats);
  } catch (err) {
    console.error('Error searching chats:', err);
    res.status(500).json({ error: 'Failed to search chats' });
  }
});

module.exports = router;
