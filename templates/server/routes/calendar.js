/**
 * @file Calendar Routes — Office 365 calendar integration for demo booking
 * @description Provides meeting slot availability and booking via Microsoft Graph API.
 *   Requires Office 365 credentials to be configured (checked via isConfigured()).
 *   Returns 503 when calendar integration is not set up.
 *
 *   Flow: Widget user sees available slots -> selects time -> books meeting ->
 *   booking metadata saved to chat record for agent visibility.
 *
 * @requires ../utils/microsoftGraph - Microsoft Graph API wrapper (OAuth2 client credentials)
 */

const express = require('express');
const router = express.Router();
const { Chat } = require('../db/models');
const { isConfigured, getAvailableSlots, createBooking } = require('../utils/microsoftGraph');

/**
 * GET /api/calendar/slots
 * Fetch available meeting slots for the next N days (default 3).
 * @param {string} [req.query.date] - Start date in YYYY-MM-DD format (defaults to today)
 */
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

/**
 * GET /api/calendar/status
 * Check if Office 365 calendar integration is configured.
 */
router.get('/status', (req, res) => {
  res.json({ configured: isConfigured() });
});

/**
 * POST /api/calendar/book
 * Create a calendar booking via Microsoft Graph API.
 * Optionally links booking metadata to a chat session for agent visibility.
 * @param {string} req.body.start - Meeting start time (ISO 8601)
 * @param {string} req.body.end - Meeting end time (ISO 8601)
 * @param {string} req.body.customerName - Customer's name
 * @param {string} req.body.customerEmail - Customer's email for calendar invite
 * @param {string} req.body.meetingType - Type of meeting (e.g., 'demo', 'consultation')
 * @param {string} [req.body.sessionId] - Chat session ID to link booking metadata
 * @param {string} [req.body.notes] - Additional meeting notes
 * @param {string} [req.body.phone] - Customer phone number
 * @param {string} [req.body.company] - Customer company name
 */
router.post('/book', async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Calendar not configured' });
  }

  try {
    const { start, end, customerName, customerEmail, meetingType, sessionId, notes, phone, company } = req.body;

    if (!start || !end || !customerName || !customerEmail || !meetingType) {
      return res.status(400).json({ error: 'start, end, customerName, customerEmail, and meetingType are required' });
    }

    const result = await createBooking({ start, end, customerName, customerEmail, meetingType, notes, phone, company });

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
