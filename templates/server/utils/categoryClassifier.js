/**
 * @file categoryClassifier — Keyword-based chat category classification
 * @description Classifies chat sessions into categories (billing, technical, feature_request,
 * bug_report, general) by counting keyword matches in user messages. Uses priority-ordered
 * tie-breaking and requires a minimum of 2 keyword matches to assign a non-general category.
 * @module utils/categoryClassifier
 */

/**
 * Categorize chat based on message content
 * @param {Array} messages - Array of message objects [{sender, content}]
 * @returns {string} Category: "billing", "technical", "general", "feature_request", "bug_report"
 */
function categorizeChat(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return 'general';
  }

  // Extract all user message content
  const userMessages = messages
    .filter(m => m.sender === 'user' || m.sender === 'visitor')
    .map(m => m.content || '')
    .join(' ')
    .toLowerCase();

  if (!userMessages.trim()) {
    return 'general';
  }

  // Define keyword patterns for each category
  const categories = {
    billing: [
      'payment', 'invoice', 'charge', 'refund', 'subscription', 'billing',
      'card', 'plan', 'upgrade', 'downgrade', 'receipt', 'transaction',
      'price', 'cost', 'fee', 'paid', 'pay', 'credit', 'debit'
    ],
    technical: [
      'error', 'bug', 'broken', 'crash', 'not working', 'issue', 'problem',
      'fails', "doesn't work", 'failed', '500', '404', 'login failed',
      "can't access", 'loading', 'slow', 'timeout', 'connection'
    ],
    feature_request: [
      'feature', 'request', 'add', 'need', 'would like', 'suggestion',
      'enhance', 'improvement', 'could you add', 'wish', 'want',
      'can you', 'please add', 'new feature', 'missing'
    ],
    bug_report: [
      'bug', 'broken', 'error', 'crash', 'issue', 'not working',
      "doesn't work", 'failed', 'malfunction', 'incorrect', 'wrong',
      'glitch', 'defect', 'fault'
    ]
  };

  // Count matches for each category
  const scores = {};
  for (const [category, keywords] of Object.entries(categories)) {
    scores[category] = 0;
    for (const keyword of keywords) {
      if (userMessages.includes(keyword)) {
        scores[category]++;
      }
    }
  }

  // Find category with highest score
  let maxScore = 0;
  let assignedCategory = 'general';

  // Priority order for tie-breaking
  const priorityOrder = ['bug_report', 'technical', 'billing', 'feature_request'];

  for (const category of priorityOrder) {
    if (scores[category] > maxScore) {
      maxScore = scores[category];
      assignedCategory = category;
    }
  }

  // Require at least 2 keyword matches for non-general category
  if (maxScore < 2) {
    return 'general';
  }

  return assignedCategory;
}

module.exports = { categorizeChat };
