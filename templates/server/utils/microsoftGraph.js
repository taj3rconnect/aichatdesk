/**
 * @file microsoftGraph — Office 365 calendar integration via Microsoft Graph API
 * @description Acquires OAuth tokens using MSAL client credentials flow, initializes a Graph API
 * client, and provides calendar operations: checking availability across business days and
 * creating booking events with Teams meeting links. Slot duration and business hours are
 * configurable via module constants. Calendar email is resolved from DB settings with
 * env var fallback.
 * @module utils/microsoftGraph
 */

const msal = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');

/** @type {msal.ConfidentialClientApplication|null} Cached MSAL client instance */
let msalClient = null;
/** @type {import('@microsoft/microsoft-graph-client').Client|null} */
let graphClient = null;

/** @type {string} Calendar owner email — resolved from DB setting or OFFICE365_CALENDAR_EMAIL env var */
let CALENDAR_EMAIL = process.env.OFFICE365_CALENDAR_EMAIL || '';
/** @type {number} Duration of each bookable slot in minutes */
const SLOT_DURATION = 30;
/** @type {number} Business hours start (24h format) */
const BUSINESS_START = 9;
/** @type {number} Business hours end (24h format) */
const BUSINESS_END = 17;

/**
 * Load the calendar email from the DB Setting collection on first use.
 * Falls back to the OFFICE365_CALENDAR_EMAIL env var if no DB setting exists.
 * @returns {Promise<string>} The resolved calendar email address
 */
let _calEmailLoaded = false;
async function loadCalendarEmail() {
  if (_calEmailLoaded) return CALENDAR_EMAIL;
  try {
    const { Setting } = require('../db/models');
    const setting = await Setting.findOne({ key: 'calendarEmail' }).lean();
    if (setting && setting.value) CALENDAR_EMAIL = setting.value;
    _calEmailLoaded = true;
  } catch (e) { /* ignore — use env var */ }
  return CALENDAR_EMAIL;
}

/**
 * Check whether all required Microsoft Graph environment variables are set.
 * Required: MICROSOFT_GRAPH_CLIENT_ID, MICROSOFT_GRAPH_CLIENT_SECRET, MICROSOFT_GRAPH_TENANT_ID.
 * @returns {boolean} True if Graph API credentials are fully configured
 */
function isConfigured() {
  return !!(
    process.env.MICROSOFT_GRAPH_CLIENT_ID &&
    process.env.MICROSOFT_GRAPH_CLIENT_SECRET &&
    process.env.MICROSOFT_GRAPH_TENANT_ID
  );
}

/**
 * Reset the cached calendar email so the next call to loadCalendarEmail() re-reads from DB.
 * Useful after admin updates the calendarEmail setting.
 */
function resetCalendarEmailCache() { _calEmailLoaded = false; }

/**
 * Get or create the singleton MSAL ConfidentialClientApplication.
 * Uses client credentials flow with tenant-specific authority.
 * @returns {msal.ConfidentialClientApplication} The MSAL client instance
 */
function getMsalClient() {
  if (!msalClient) {
    msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: process.env.MICROSOFT_GRAPH_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_GRAPH_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_GRAPH_TENANT_ID}`
      }
    });
  }
  return msalClient;
}

/**
 * Acquire an OAuth token via MSAL and initialize a Microsoft Graph client.
 * Creates a new client on each call (token may have refreshed).
 * @returns {Promise<import('@microsoft/microsoft-graph-client').Client>} Authenticated Graph client
 * @throws {Error} If Microsoft Graph credentials are not configured
 */
async function getGraphClient() {
  if (!isConfigured()) throw new Error('Microsoft Graph not configured');

  const client = getMsalClient();
  const tokenResponse = await client.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });

  return Client.init({
    authProvider: (done) => {
      done(null, tokenResponse.accessToken);
    }
  });
}

/**
 * Get the next N business days (Mon-Fri) starting from a given date.
 * Skips weekends (Saturday=6, Sunday=0).
 * @param {Date|string} startDate - The date to start counting from
 * @param {number} count - Number of business days to collect
 * @returns {Date[]} Array of Date objects representing business days (time set to midnight)
 */
function getBusinessDays(startDate, count) {
  const days = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  while (days.length < count) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) { // Skip weekends
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * Get available time slots from Office 365 calendar
 * @param {string} fromDate - Start date (YYYY-MM-DD), defaults to today
 * @param {number} daysCount - Number of business days to check (default 3)
 * @returns {Promise<Array>} Available slots grouped by date
 */
async function getAvailableSlots(fromDate, daysCount = 3) {
  await loadCalendarEmail();
  if (!CALENDAR_EMAIL) throw new Error('Calendar email not configured');
  const graph = await getGraphClient();

  const start = fromDate ? new Date(fromDate) : new Date();
  const businessDays = getBusinessDays(start, daysCount);

  const rangeStart = businessDays[0];
  const rangeEnd = new Date(businessDays[businessDays.length - 1]);
  rangeEnd.setHours(23, 59, 59);

  // Get schedule (free/busy) from Graph API
  const scheduleResponse = await graph.api('/users/' + CALENDAR_EMAIL + '/calendar/getSchedule')
    .post({
      schedules: [CALENDAR_EMAIL],
      startTime: {
        dateTime: rangeStart.toISOString(),
        timeZone: 'UTC'
      },
      endTime: {
        dateTime: rangeEnd.toISOString(),
        timeZone: 'UTC'
      },
      availabilityViewInterval: SLOT_DURATION
    });

  // Parse busy times
  const busySlots = [];
  if (scheduleResponse.value && scheduleResponse.value[0]) {
    const items = scheduleResponse.value[0].scheduleItems || [];
    items.forEach(item => {
      if (item.status !== 'free') {
        busySlots.push({
          start: new Date(item.start.dateTime),
          end: new Date(item.end.dateTime)
        });
      }
    });
  }

  // Generate available slots per business day
  const result = [];
  for (const day of businessDays) {
    const daySlots = [];
    const dayStr = day.toISOString().split('T')[0];

    for (let hour = BUSINESS_START; hour < BUSINESS_END; hour++) {
      for (let min = 0; min < 60; min += SLOT_DURATION) {
        const slotStart = new Date(day);
        slotStart.setHours(hour, min, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_DURATION);

        // Skip if in the past
        if (slotStart < new Date()) continue;

        // Check if slot overlaps with any busy time
        const isBusy = busySlots.some(busy =>
          slotStart < busy.end && slotEnd > busy.start
        );

        if (!isBusy) {
          const displayDate = slotStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const displayTime = slotStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          daySlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            display: `${displayDate}, ${displayTime}`,
            time: displayTime
          });
        }
      }
    }

    if (daySlots.length > 0) {
      result.push({
        date: dayStr,
        label: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        slots: daySlots
      });
    }
  }

  return result;
}

/**
 * Create a calendar event on the configured Office 365 calendar with a Teams meeting link.
 * Adds the customer as a required attendee and includes booking metadata in the event body.
 * @param {Object} params - Booking parameters
 * @param {string} params.start - Event start time (ISO 8601 string, UTC)
 * @param {string} params.end - Event end time (ISO 8601 string, UTC)
 * @param {string} params.customerName - Customer's display name
 * @param {string} params.customerEmail - Customer's email (added as attendee)
 * @param {string} params.meetingType - Type of meeting: 'call', 'demo', or 'meeting'
 * @param {string} [params.notes] - Optional notes to include in the event body
 * @param {string} [params.phone] - Optional customer phone number
 * @param {string} [params.company] - Optional customer company name
 * @returns {Promise<{eventId: string, meetingLink: string|null, subject: string, start: string, end: string}>}
 * @throws {Error} If calendar email is not configured or Graph API call fails
 */
async function createBooking({ start, end, customerName, customerEmail, meetingType, notes, phone, company }) {
  await loadCalendarEmail();
  if (!CALENDAR_EMAIL) throw new Error('Calendar email not configured');
  const graph = await getGraphClient();

  const typeLabels = { call: 'Call', demo: 'Demo', meeting: 'Meeting' };
  const subject = `[AIChatDesk] ${typeLabels[meetingType] || 'Meeting'} with ${customerName}`;

  const event = {
    subject,
    body: {
      contentType: 'HTML',
      content: `<p><strong>Type:</strong> ${typeLabels[meetingType] || meetingType}</p>
        <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p><em>Booked via AIChatDesk</em></p>`
    },
    start: { dateTime: start, timeZone: 'UTC' },
    end: { dateTime: end, timeZone: 'UTC' },
    attendees: [
      {
        emailAddress: { address: customerEmail, name: customerName },
        type: 'required'
      }
    ],
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness'
  };

  const created = await graph.api('/users/' + CALENDAR_EMAIL + '/events').post(event);

  return {
    eventId: created.id,
    meetingLink: created.onlineMeeting?.joinUrl || created.webLink || null,
    subject: created.subject,
    start: created.start.dateTime,
    end: created.end.dateTime
  };
}

module.exports = { isConfigured, getAvailableSlots, createBooking, resetCalendarEmailCache };
