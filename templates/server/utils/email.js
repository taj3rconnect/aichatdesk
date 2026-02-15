/**
 * @file email — SendGrid email notifications for chat events
 * @description Sends HTML email notifications via SendGrid: new chat alerts to support staff
 * and post-chat transcript delivery to customers. Includes styled HTML templates with
 * chat metadata, conversation history, ratings, and attachment links. Fails silently
 * when SendGrid is not configured.
 * @module utils/email
 */

const sgMail = require('@sendgrid/mail');
const { Chat, Message } = require('../db/models');

// Lazy initialize SendGrid client
let sgInitialized = false;

/**
 * Lazy-initialize the SendGrid client with the API key from environment.
 * @returns {boolean} True if SendGrid is ready to send, false otherwise
 */
function initializeSendGrid() {
  if (sgInitialized) return true;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('SENDGRID_API_KEY not configured - email notifications disabled');
    return false;
  }

  try {
    sgMail.setApiKey(apiKey);
    sgInitialized = true;
    return true;
  } catch (err) {
    console.error('SendGrid initialization error:', err);
    return false;
  }
}

/**
 * Send email notification when new chat starts
 * @param {Object} chat - Chat document from MongoDB
 */
async function sendNewChatNotification(chat) {
  try {
    if (!initializeSendGrid()) {
      return; // Silently skip if SendGrid not configured
    }

    const toEmail = process.env.SENDGRID_TO_EMAIL;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const fromName = process.env.SENDGRID_FROM_NAME || 'AIChatDesk';

    if (!toEmail || !fromEmail) {
      console.warn('SENDGRID_TO_EMAIL or SENDGRID_FROM_EMAIL not configured');
      return;
    }

    // Build dashboard link
    const port = process.env.AICHATDESK_PORT || 8002;
    const dashboardUrl = `http://localhost:${port}/aichatdesk/dashboard/chats/${chat._id}`;

    // Extract current page from metadata
    const currentPage = chat.metadata?.currentPage || 'Not provided';

    // Priority badge HTML
    const priorityBadge = chat.priority === 'high'
      ? '<span style="display: inline-block; background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 8px;">HIGH PRIORITY</span>'
      : '';

    // HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">New Support Chat</h1>
                    ${priorityBadge}
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 30px;">
                    <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
                      A new chat has been started. Details below:
                    </p>

                    <table width="100%" cellpadding="8" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px;">
                      <tr>
                        <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280; width: 140px;">User Name</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${chat.userName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">User Email</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${chat.userEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">Category</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${chat.category || 'general'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">Current Page</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827; word-break: break-all;">${currentPage}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; background-color: #f9fafb; font-weight: 600; color: #6b7280;">Started At</td>
                        <td style="padding: 12px; color: #111827;">${new Date(chat.startedAt).toLocaleString()}</td>
                      </tr>
                    </table>

                    <div style="margin-top: 30px; text-align: center;">
                      <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">View Chat in Dashboard</a>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; font-size: 14px;">
                    Powered by <strong>AIChatDesk</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const msg = {
      to: toEmail,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: `New Support Chat: ${chat.userName} - ${chat.category || 'general'}`,
      html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`New chat notification sent to ${toEmail}`);
  } catch (err) {
    // Non-blocking: log error but don't throw
    console.error('Failed to send new chat notification:', err.message);
    if (err.response) {
      console.error('SendGrid error details:', err.response.body);
    }
  }
}

/**
 * Send chat transcript to user when chat ends
 * @param {String} chatId - Chat MongoDB ObjectId
 */
async function sendChatTranscript(chatId) {
  try {
    if (!initializeSendGrid()) {
      return; // Silently skip if SendGrid not configured
    }

    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const fromName = process.env.SENDGRID_FROM_NAME || 'AIChatDesk';

    if (!fromEmail) {
      console.warn('SENDGRID_FROM_EMAIL not configured');
      return;
    }

    // Fetch chat and messages
    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.error(`Chat ${chatId} not found for transcript`);
      return;
    }

    if (!chat.userEmail) {
      console.warn(`Chat ${chatId} has no userEmail - cannot send transcript`);
      return;
    }

    // Fetch all non-internal messages
    const messages = await Message.find({
      chatId,
      isInternal: { $ne: true }
    }).sort({ sentAt: 1 });

    // Calculate chat duration
    let duration = 'N/A';
    if (chat.endedAt && chat.startedAt) {
      const durationMs = new Date(chat.endedAt) - new Date(chat.startedAt);
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      duration = `${minutes}m ${seconds}s`;
    }

    // Build conversation HTML
    const port = process.env.AICHATDESK_PORT || 8002;
    let conversationHtml = '';

    for (const msg of messages) {
      const isUser = msg.sender === 'user';
      const senderLabel = isUser ? chat.userName : (msg.senderName || (msg.sender === 'ai' ? 'AI Assistant' : 'Agent'));
      const alignStyle = isUser ? 'text-align: right;' : 'text-align: left;';
      const bgColor = isUser ? '#667eea' : '#e5e7eb';
      const textColor = isUser ? 'white' : '#111827';
      const timeColor = isUser ? 'rgba(255,255,255,0.8)' : '#6b7280';

      conversationHtml += `
        <div style="margin-bottom: 20px; ${alignStyle}">
          <div style="display: inline-block; max-width: 70%; text-align: left;">
            <div style="background-color: ${bgColor}; color: ${textColor}; padding: 12px 16px; border-radius: 12px; margin-bottom: 4px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${senderLabel}</div>
              <div style="font-size: 15px; line-height: 1.5; white-space: pre-wrap;">${msg.content}</div>
            </div>
            <div style="font-size: 12px; color: ${timeColor}; padding: 0 8px;">
              ${new Date(msg.sentAt).toLocaleString()}
            </div>
      `;

      // Add attachment links if present
      if (msg.attachments && msg.attachments.length > 0) {
        conversationHtml += `<div style="margin-top: 8px; padding: 0 8px;">`;
        for (const attachment of msg.attachments) {
          const attachmentUrl = `http://localhost:${port}/uploads/${attachment.filename}`;
          conversationHtml += `
            <div style="margin-bottom: 4px;">
              <a href="${attachmentUrl}" style="color: #667eea; text-decoration: none; font-size: 13px;">
                📎 ${attachment.filename}
              </a>
            </div>
          `;
        }
        conversationHtml += `</div>`;
      }

      conversationHtml += `
          </div>
        </div>
      `;
    }

    // Rating section
    let ratingHtml = '';
    if (chat.rating) {
      const ratingEmoji = chat.rating === 5 ? '👍' : '👎';
      ratingHtml = `
        <tr>
          <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
            <div style="font-weight: 600; color: #374151; margin-bottom: 8px;">Your Rating: ${ratingEmoji}</div>
            ${chat.ratingComment ? `<div style="color: #6b7280; font-size: 14px; font-style: italic;">"${chat.ratingComment}"</div>` : ''}
          </td>
        </tr>
      `;
    }

    // HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Your Chat Transcript</h1>
                  </td>
                </tr>

                <!-- Summary -->
                <tr>
                  <td style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
                      Thank you for contacting us! Here's a copy of your conversation.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Category:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${chat.category || 'general'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Duration:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${duration}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Resolution:</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${chat.mode === 'ai' ? 'AI' : 'Human Agent'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Conversation -->
                <tr>
                  <td style="padding: 30px;">
                    <h2 style="margin: 0 0 20px; color: #111827; font-size: 18px; font-weight: 600;">Conversation History</h2>
                    ${conversationHtml}
                  </td>
                </tr>

                <!-- Rating -->
                ${ratingHtml}

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; font-size: 14px;">
                    Powered by <strong>AIChatDesk</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const msg = {
      to: chat.userEmail,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: `Your Chat Transcript - ${chat.category || 'general'}`,
      html: htmlContent
    };

    await sgMail.send(msg);
    console.log(`Chat transcript sent to ${chat.userEmail}`);
  } catch (err) {
    // Non-blocking: log error but don't throw
    console.error('Failed to send chat transcript:', err.message);
    if (err.response) {
      console.error('SendGrid error details:', err.response.body);
    }
  }
}

module.exports = {
  sendNewChatNotification,
  sendChatTranscript
};
