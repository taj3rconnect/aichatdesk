const msal = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');

let msalClient = null;
let graphClient = null;

const CALENDAR_EMAIL = process.env.OFFICE365_CALENDAR_EMAIL || '';
const SLOT_DURATION = 30; // minutes
const BUSINESS_START = 9; // 9 AM
const BUSINESS_END = 17; // 5 PM

function isConfigured() {
  return !!(
    process.env.MICROSOFT_GRAPH_CLIENT_ID &&
    process.env.MICROSOFT_GRAPH_CLIENT_SECRET &&
    process.env.MICROSOFT_GRAPH_TENANT_ID &&
    CALENDAR_EMAIL
  );
}

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
 * Get next N business days starting from a date
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
 * Create a calendar booking
 */
async function createBooking({ start, end, customerName, customerEmail, meetingType, notes }) {
  const graph = await getGraphClient();

  const typeLabels = { call: 'Call', demo: 'Demo', meeting: 'Meeting' };
  const subject = `[AIChatDesk] ${typeLabels[meetingType] || 'Meeting'} with ${customerName}`;

  const event = {
    subject,
    body: {
      contentType: 'HTML',
      content: `<p><strong>Type:</strong> ${typeLabels[meetingType] || meetingType}</p>
        <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
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

module.exports = { isConfigured, getAvailableSlots, createBooking };
