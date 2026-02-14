/**
 * Microsoft Teams Bot Integration
 *
 * Two-way messaging: notifications to Teams channel + agent replies from Teams.
 * Only active when MICROSOFT_APP_ID and MICROSOFT_APP_PASSWORD are set.
 */

const { BotFrameworkAdapter, TurnContext, CardFactory, MessageFactory } = require('botbuilder');
const { Chat, Agent, Message, TeamsConversation } = require('../db/models');
const { broadcast } = require('../websocket');

let adapter = null;
let serviceUrl = null; // Populated on first incoming activity

const TICKET_ICONS = { bug: '\u{1F41B}', feature: '\u2728', question: '\u2753', support: '\u{1F3AB}', chat: '\u{1F4AC}' };
const MOOD_EMOJIS = { 1: '\u{1F621}', 2: '\u{1F615}', 3: '\u{1F610}', 4: '\u{1F642}', 5: '\u{1F929}' };

/**
 * Initialize the Teams bot and register the messaging endpoint.
 * Call once at server startup.
 */
function initTeamsBot(app) {
  const appId = process.env.MICROSOFT_APP_ID;
  const appPassword = process.env.MICROSOFT_APP_PASSWORD;

  if (!appId || !appPassword) {
    console.log('[Teams] MICROSOFT_APP_ID / MICROSOFT_APP_PASSWORD not set — Teams integration disabled');
    return;
  }

  adapter = new BotFrameworkAdapter({ appId, appPassword });

  adapter.onTurnError = async (context, error) => {
    console.error('[Teams] Bot error:', error.message);
    await context.sendActivity('Sorry, something went wrong processing your message.');
  };

  // Register the messaging endpoint
  app.post('/api/teams/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
      // Store serviceUrl for proactive messaging
      if (context.activity.serviceUrl) {
        serviceUrl = context.activity.serviceUrl;
      }

      if (context.activity.type === 'message') {
        await handleTeamsMessage(context);
      } else if (context.activity.type === 'invoke') {
        await handleTeamsInvoke(context);
      } else if (context.activity.type === 'conversationUpdate') {
        // Bot added to team — store the conversation reference
        if (context.activity.membersAdded) {
          for (const member of context.activity.membersAdded) {
            if (member.id === context.activity.recipient.id) {
              console.log('[Teams] Bot added to team/channel');
            }
          }
        }
      }
    });
  });

  console.log('[Teams] Bot initialized — endpoint: /api/teams/messages');
}

/**
 * Handle plain text messages from Teams (agent replies in threads).
 */
async function handleTeamsMessage(context) {
  const activity = context.activity;
  const text = (activity.text || '').trim();

  if (!text) return;

  // Remove @mention of the bot from the message text
  const cleanText = text.replace(/<at>[^<]*<\/at>\s*/g, '').trim();
  if (!cleanText) return;

  // Find the conversation reference for this thread
  const threadId = activity.conversation?.id;
  const teamsConv = await TeamsConversation.findOne({ threadId });

  if (!teamsConv) {
    await context.sendActivity('This thread is not linked to a customer chat. I can only respond in chat notification threads.');
    return;
  }

  // Find agent by email
  const teamsUserEmail = activity.from?.aadObjectId
    ? await getTeamsUserEmail(activity)
    : null;

  let agent = null;
  if (teamsUserEmail) {
    agent = await Agent.findOne({ email: { $regex: new RegExp(`^${escapeRegex(teamsUserEmail)}$`, 'i') } });
  }
  if (!agent && activity.from?.name) {
    // Fallback: try matching by name
    agent = await Agent.findOne({ name: activity.from.name });
  }

  if (!agent) {
    await context.sendActivity(`No matching agent account found for "${activity.from?.name || 'unknown'}". Please ensure your Teams email matches your AIChatDesk agent email.`);
    return;
  }

  // Find the chat
  const chat = await Chat.findOne({ sessionId: teamsConv.sessionId });
  if (!chat) {
    await context.sendActivity('This chat session no longer exists.');
    return;
  }

  // Auto-takeover if chat is still in AI mode
  if (chat.mode === 'ai' || !chat.assignedAgent) {
    chat.mode = 'human';
    chat.assignedAgent = agent._id;
    chat.status = 'active';
    await chat.save();

    broadcast({
      type: 'agent.takeover',
      sessionId: chat.sessionId,
      agentName: agent.name,
      timestamp: new Date().toISOString()
    }, chat.sessionId);
  }

  // Save agent message
  const message = await Message.create({
    chatId: chat._id,
    sender: 'agent',
    senderName: agent.name,
    content: cleanText
  });

  // Broadcast to customer widget via WebSocket
  broadcast({
    type: 'chat.message',
    message: {
      id: message._id,
      chatId: message.chatId,
      sender: 'agent',
      senderName: agent.name,
      content: cleanText,
      sentAt: message.sentAt
    }
  }, chat.sessionId);

  // Update Teams conversation with agent info
  teamsConv.teamsUserId = activity.from?.id;
  teamsConv.agentId = agent._id;
  await teamsConv.save();

  await context.sendActivity(`\u2705 Reply sent to ${chat.userName || 'customer'}`);
  console.log(`[Teams] ${agent.name} replied to chat ${chat.sessionId.substring(0, 8)}`);
}

/**
 * Handle Adaptive Card button actions (Take Over, Return to AI, Close).
 */
async function handleTeamsInvoke(context) {
  const activity = context.activity;
  const value = activity.value;

  if (!value || !value.action) {
    await context.sendActivity({ type: 'invokeResponse', value: { status: 200, body: {} } });
    return;
  }

  const sessionId = value.sessionId;
  if (!sessionId) {
    await context.sendActivity({ type: 'invokeResponse', value: { status: 200, body: { error: 'No sessionId' } } });
    return;
  }

  const chat = await Chat.findOne({ sessionId });
  if (!chat) {
    await context.sendActivity({ type: 'invokeResponse', value: { status: 200, body: { error: 'Chat not found' } } });
    return;
  }

  // Find agent
  const teamsUserEmail = activity.from?.aadObjectId ? await getTeamsUserEmail(activity) : null;
  let agent = null;
  if (teamsUserEmail) {
    agent = await Agent.findOne({ email: { $regex: new RegExp(`^${escapeRegex(teamsUserEmail)}$`, 'i') } });
  }
  if (!agent && activity.from?.name) {
    agent = await Agent.findOne({ name: activity.from.name });
  }

  switch (value.action) {
    case 'takeover': {
      if (!agent) {
        await context.sendActivity('No matching agent account found.');
        break;
      }
      chat.mode = 'human';
      chat.assignedAgent = agent._id;
      chat.status = 'active';
      await chat.save();

      broadcast({
        type: 'agent.takeover',
        sessionId,
        agentName: agent.name,
        timestamp: new Date().toISOString()
      }, sessionId);

      await context.sendActivity(`\u2705 ${agent.name} took over the chat. Reply in this thread to respond to the customer.`);
      console.log(`[Teams] ${agent.name} took over chat ${sessionId.substring(0, 8)}`);
      break;
    }
    case 'returnToAI': {
      chat.mode = 'ai';
      chat.assignedAgent = null;
      await chat.save();

      broadcast({
        type: 'agent.return',
        sessionId,
        timestamp: new Date().toISOString()
      }, sessionId);

      await context.sendActivity('\u{1F916} Chat returned to AI mode.');
      break;
    }
    case 'closeChat': {
      chat.status = 'closed';
      chat.endedAt = new Date();
      await chat.save();

      broadcast({
        type: 'dashboard.chat.closed',
        sessionId,
        chatId: chat._id
      }, sessionId);

      await context.sendActivity('\u{1F512} Chat closed.');
      break;
    }
  }

  // Send invoke response
  await context.sendActivity({ type: 'invokeResponse', value: { status: 200, body: {} } });
}

/**
 * Send a notification Adaptive Card to the Teams channel for a new chat.
 */
async function sendTeamsNotification(chat) {
  if (!adapter || !process.env.TEAMS_CHANNEL_ID) return;

  const channelId = process.env.TEAMS_CHANNEL_ID;
  const tktIcon = TICKET_ICONS[chat.ticketType] || TICKET_ICONS.chat;
  const moodEmoji = chat.mood ? (MOOD_EMOJIS[chat.mood] || '') : '';
  const priorityColor = { high: 'attention', medium: 'warning', low: 'good' };

  const card = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `${tktIcon} New Support Chat`,
        weight: 'bolder',
        size: 'medium'
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'User', value: chat.userName || 'Anonymous' },
          { title: 'Email', value: chat.userEmail || '-' },
          { title: 'Type', value: `${tktIcon} ${(chat.ticketType || 'chat').charAt(0).toUpperCase() + (chat.ticketType || 'chat').slice(1)}` },
          { title: 'Priority', value: (chat.userPriority || chat.priority || 'medium').toUpperCase() },
          { title: 'Mood', value: chat.mood ? `${moodEmoji} (${chat.mood}/5)` : 'Not set' },
          { title: 'Page', value: chat.metadata?.currentPage || '-' }
        ]
      }
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Take Over',
        data: { action: 'takeover', sessionId: chat.sessionId }
      },
      {
        type: 'Action.OpenUrl',
        title: 'View Dashboard',
        url: `http://localhost:8004/test/dashboard.html`
      }
    ]
  };

  try {
    // Build a conversation reference for proactive messaging
    const conversationReference = {
      channelId: 'msteams',
      serviceUrl: serviceUrl || 'https://smba.trafficmanager.net/teams/',
      conversation: { id: channelId }
    };

    await adapter.continueConversationAsync(
      process.env.MICROSOFT_APP_ID,
      conversationReference,
      async (context) => {
        const activity = MessageFactory.attachment(
          CardFactory.adaptiveCard(card)
        );

        const response = await context.sendActivity(activity);

        // Store the conversation reference for future messages in this thread
        const threadConvRef = TurnContext.getConversationReference(context.activity);
        // Update with the reply chain ID
        if (response && response.id) {
          threadConvRef.conversation = {
            ...threadConvRef.conversation,
            id: `${channelId};messageid=${response.id}`
          };
        }

        await TeamsConversation.findOneAndUpdate(
          { sessionId: chat.sessionId },
          {
            sessionId: chat.sessionId,
            conversationReference: threadConvRef,
            threadId: threadConvRef.conversation?.id || channelId
          },
          { upsert: true, new: true }
        );

        console.log(`[Teams] Notification sent for chat ${chat.sessionId.substring(0, 8)}`);
      }
    );
  } catch (err) {
    console.error('[Teams] Failed to send notification:', err.message);
  }
}

/**
 * Forward a customer message to the Teams thread for an active chat.
 */
async function sendTeamsReply(sessionId, content, senderName) {
  if (!adapter) return;

  const teamsConv = await TeamsConversation.findOne({ sessionId });
  if (!teamsConv || !teamsConv.conversationReference) return;

  try {
    await adapter.continueConversationAsync(
      process.env.MICROSOFT_APP_ID,
      teamsConv.conversationReference,
      async (context) => {
        const card = {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: `\u{1F4AC} ${senderName || 'Customer'}`,
              weight: 'bolder',
              size: 'small'
            },
            {
              type: 'TextBlock',
              text: content,
              wrap: true
            }
          ]
        };

        await context.sendActivity(
          MessageFactory.attachment(CardFactory.adaptiveCard(card))
        );
      }
    );
  } catch (err) {
    console.error(`[Teams] Failed to forward message to thread for ${sessionId.substring(0, 8)}:`, err.message);
  }
}

/**
 * Try to extract the Teams user's email from the activity.
 */
async function getTeamsUserEmail(activity) {
  // Teams provides email in some activity types
  if (activity.from?.email) return activity.from.email;
  // UPN (User Principal Name) often equals email
  if (activity.from?.userPrincipalName) return activity.from.userPrincipalName;
  return null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { initTeamsBot, sendTeamsNotification, sendTeamsReply };
