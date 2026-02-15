const express = require('express');
const router = express.Router();
const { Chat } = require('../db/models');
const { isConfigured, getAvailableSlots, createBooking } = require('../utils/microsoftGraph');

// GET /api/calendar/slots?date=YYYY-MM-DD
router.get('/slots', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Calendar not configured' });
  }

  try {
    const fromDate = req.query.date || null;
    const days = await getAvailableSlots(fromDate, 3);
    res.json({ days });
  } catch (error) {
    console.error('[Calendar] Slots error:', error.message);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

// GET /api/calendar/status - Check if calendar is configured
router.get('/status', (req, res) => {
  res.json({ configured: isConfigured() });
});

// POST /api/calendar/book
router.post('/book', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Calendar not configured' });
  }

  try {
    const { start, end, customerName, customerEmail, meetingType, sessionId, notes } = req.body;

    if (!start || !end || !customerName || !customerEmail || !meetingType) {
      return res.status(400).json({ error: 'start, end, customerName, customerEmail, and meetingType are required' });
    }

    const result = await createBooking({ start, end, customerName, customerEmail, meetingType, notes });

    // Store booking in chat metadata if sessionId provided
    if (sessionId) {
      const chat = await Chat.findOne({ sessionId });
      if (chat) {
        if (!chat.metadata) chat.metadata = {};
        chat.metadata.booking = {
          meetingType,
          start: result.start,
          end: result.end,
          meetingLink: result.meetingLink,
          eventId: result.eventId,
          bookedAt: new Date().toISOString()
        };
        chat.markModified('metadata');
        await chat.save();
      }
    }

    console.log(`[Calendar] Booked ${meetingType} for ${customerName} at ${start}`);
    res.json({
      success: true,
      meetingLink: result.meetingLink,
      eventId: result.eventId,
      start: result.start,
      end: result.end
    });
  } catch (error) {
    console.error('[Calendar] Booking error:', error.message);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

module.exports = router;
