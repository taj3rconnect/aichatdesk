/**
 * @file github — Automatic GitHub issue creation from chat tickets
 * @description Creates GitHub issues via the REST API when customers submit bug reports,
 * feature requests, or support tickets through the chat widget. Maps ticket types to
 * GitHub labels and formats chat metadata into a structured issue body. Silently skips
 * when GITHUB_REPO or GITHUB_TOKEN environment variables are not configured.
 * @module utils/github
 */

const LABEL_MAP = {
  bug: ['bug'],
  feature: ['enhancement'],
  question: ['question'],
  support: ['help wanted']
};

const MOOD_EMOJI = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };

/**
 * Create a GitHub issue from a chat session.
 * Fire-and-forget — caller should .catch() errors.
 *
 * @param {Object} chat - Chat document (must have ticketType, userPriority, mood, userName, userEmail, metadata)
 * @param {string} firstMessage - The user's first message content
 */
async function createGitHubIssue(chat, firstMessage) {
  const repo = process.env.GITHUB_REPO;
  const ghToken = process.env.GITHUB_TOKEN;

  if (!repo || !ghToken) return; // silently skip if not configured

  // Build labels
  const labels = [...(LABEL_MAP[chat.ticketType] || [])];
  if (chat.userPriority) {
    labels.push(`priority:${chat.userPriority}`);
  }

  // Build issue title
  const typeLabel = chat.ticketType ? chat.ticketType.charAt(0).toUpperCase() + chat.ticketType.slice(1) : 'Chat';
  const preview = (firstMessage || '').substring(0, 80).replace(/\n/g, ' ');
  const title = `[${typeLabel}] ${preview || 'New support ticket'}`;

  // Build issue body
  const moodText = chat.mood ? `${'⭐'.repeat(chat.mood)} (${chat.mood}/5)` : 'Not set';
  const body = [
    `## Support Ticket`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Type** | ${chat.ticketType || 'chat'} |`,
    `| **Priority** | ${chat.userPriority || 'not set'} |`,
    `| **Mood** | ${moodText} |`,
    `| **User** | ${chat.userName || 'Anonymous'} |`,
    `| **Email** | ${chat.userEmail || '-'} |`,
    `| **Page** | ${chat.metadata?.currentPage || '-'} |`,
    `| **Session** | ${chat.sessionId} |`,
    '',
    `## User Message`,
    '',
    firstMessage || '_No message_',
    '',
    `---`,
    `_Created automatically by AIChatDesk_`
  ].join('\n');

  // GitHub API call
  const url = `https://api.github.com/repos/${repo}/issues`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${ghToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, body, labels })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GitHub API ${response.status}: ${err}`);
  }

  const issue = await response.json();
  console.log(`[GitHub] Created issue #${issue.number}: ${title}`);
  return issue;
}

module.exports = { createGitHubIssue };
