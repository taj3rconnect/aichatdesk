/**
 * @file Analytics Routes — Dashboard analytics and reporting metrics
 * @description Provides aggregated analytics data for the operator dashboard including
 *   total chats, AI vs human resolution rates, average response times, satisfaction
 *   ratings, category breakdowns, priority distribution, and common questions.
 *   All endpoints require agent authentication and support configurable date ranges
 *   (defaults to last 30 days).
 *
 * @requires ../middleware/auth - Agent authentication
 */

const express = require('express');
const router = express.Router();
const { Chat, Message } = require('../db/models');
const { authenticateAgent } = require('../middleware/auth');

/** Parse startDate/endDate from query params with defaults (30 days ago to now) */
const getDateRange = (req) => {
  const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
  const startDate = req.query.startDate
    ? new Date(req.query.startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  return { startDate, endDate };
};

/**
 * GET /api/analytics/overview
 * Comprehensive analytics overview: total chats, AI/human resolution counts,
 * average agent response time (minutes), satisfaction ratings (avg, thumbs up/down),
 * chats by category, and chats by priority.
 * @param {string} [req.query.startDate] - Start of date range (ISO date, default: 30 days ago)
 * @param {string} [req.query.endDate] - End of date range (ISO date, default: now)
 */
router.get('/overview', authenticateAgent, async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    // Validate date range
    if (startDate > endDate) {
      return res.status(400).json({ error: 'startDate cannot be after endDate' });
    }

    // 1. Total chats in date range
    const totalChats = await Chat.countDocuments({
      startedAt: { $gte: startDate, $lte: endDate }
    });

    // 2. AI vs Human resolved
    const resolution = await Chat.aggregate([
      {
        $match: {
          startedAt: { $gte: startDate, $lte: endDate },
          status: 'closed'
        }
      },
      { $group: { _id: '$mode', count: { $sum: 1 } } }
    ]);

    const aiResolved = resolution.find(r => r._id === 'ai')?.count || 0;
    const humanResolved = resolution.find(r => r._id === 'human')?.count || 0;

    // 3. Average response time (time from chat start to first agent message)
    const humanChats = await Chat.find({
      mode: 'human',
      status: 'closed',
      startedAt: { $gte: startDate, $lte: endDate }
    }).select('_id startedAt');

    let totalResponseTime = 0;
    let responseCount = 0;

    for (const chat of humanChats) {
      const firstAgentMessage = await Message.findOne({
        chatId: chat._id,
        sender: 'agent'
      }).sort({ sentAt: 1 });

      if (firstAgentMessage) {
        const responseTime = (firstAgentMessage.sentAt - chat.startedAt) / 1000 / 60; // minutes
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    const avgResponseTimeMinutes = responseCount > 0
      ? Math.round((totalResponseTime / responseCount) * 10) / 10
      : 0;

    // 4. Satisfaction ratings
    const ratingsAgg = await Chat.aggregate([
      {
        $match: {
          rating: { $exists: true },
          startedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          thumbsUp: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          thumbsDown: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
        }
      }
    ]);

    const ratings = ratingsAgg[0] || { avgRating: 0, totalRatings: 0, thumbsUp: 0, thumbsDown: 0 };
    const avgRating = ratings.avgRating ? Math.round(ratings.avgRating * 10) / 10 : 0;

    // 5. Chats by category
    const byCategory = await Chat.aggregate([
      { $match: { startedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // 6. Chats by priority
    const byPriority = await Chat.aggregate([
      { $match: { startedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    res.json({
      totalChats,
      aiResolved,
      humanResolved,
      avgResponseTimeMinutes,
      avgRating,
      totalRatings: ratings.totalRatings,
      thumbsUp: ratings.thumbsUp,
      thumbsDown: ratings.thumbsDown,
      byCategory: byCategory.map(c => ({ category: c._id, count: c.count })),
      byPriority: byPriority.map(p => ({ priority: p._id, count: p.count })),
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/common-questions
 * Most frequently asked first-messages across chats, grouped by content (case-insensitive).
 * @param {string} [req.query.startDate] - Start of date range
 * @param {string} [req.query.endDate] - End of date range
 * @param {number} [req.query.limit=10] - Max results to return
 */
router.get('/common-questions', authenticateAgent, async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const limit = parseInt(req.query.limit) || 10;

    // Get all chats in date range
    const chats = await Chat.find({
      startedAt: { $gte: startDate, $lte: endDate }
    }).select('_id');

    const chatIds = chats.map(c => c._id);

    if (chatIds.length === 0) {
      return res.json([]);
    }

    // Get first user message from each chat and group by content
    const firstMessages = await Message.aggregate([
      {
        $match: {
          chatId: { $in: chatIds },
          sender: 'user'
        }
      },
      { $sort: { sentAt: 1 } },
      {
        $group: {
          _id: '$chatId',
          firstMessage: { $first: '$content' }
        }
      },
      {
        $group: {
          _id: { $toLower: '$firstMessage' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    const commonQuestions = firstMessages.map(m => ({
      question: m._id,
      count: m.count
    }));

    res.json(commonQuestions);
  } catch (error) {
    console.error('Common questions error:', error);
    res.status(500).json({ error: 'Failed to fetch common questions' });
  }
});

module.exports = router;
