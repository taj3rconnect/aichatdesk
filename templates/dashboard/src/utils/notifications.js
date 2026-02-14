/**
 * Browser notifications and sound alerts for the agent dashboard
 *
 * Provides:
 * - Browser push notifications (Notification API)
 * - Priority-based sound alerts (Web Audio API)
 * - Permission management
 */

/**
 * Generate beep sound using Web Audio API
 * @param {number} frequency - Base frequency in Hz
 * @param {number} duration - Duration of each beep in seconds
 * @param {number} count - Number of beeps to play
 */
function generateBeep(frequency = 800, duration = 0.15, count = 1) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let delay = 0;

    for (let i = 0; i < count; i++) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Ascending pitch for multiple beeps
      oscillator.frequency.value = frequency + (i * 100);
      oscillator.type = 'sine';

      // Fade out to avoid clicking
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + duration);

      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + duration);

      delay += duration + 0.1; // Gap between beeps
    }
  } catch (error) {
    console.warn('Failed to generate beep sound:', error);
  }
}

/**
 * Request browser notification permission
 * @returns {Promise<string>} Permission state: 'granted', 'denied', or 'default'
 */
export async function requestNotificationPermission() {
  // Check if Notification API is supported
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return 'unsupported';
  }

  // Return current state if already decided
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  // Request permission
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'default';
  }
}

/**
 * Show browser push notification for new chat
 * Only shows for high-priority chats (per NOTF-03 requirement)
 * @param {Object} chat - Chat object with _id, userName, userEmail, priority, category, subject
 */
export function showChatNotification(chat) {
  // Only show notification for high-priority chats
  if (chat.priority !== 'high') {
    return;
  }

  // Check if notifications are supported and permission granted
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  // Don't show notification if dashboard is already in foreground
  // (user can already see the new chat)
  if (!document.hidden) {
    return;
  }

  try {
    const category = chat.category || 'general support';
    const title = '🚨 Urgent: New Support Chat';
    const body = `${chat.userName} needs help with ${category}`;

    const notification = new Notification(title, {
      body: body,
      icon: '/aichatdesk-icon.png',
      tag: `chat-${chat._id}`, // Prevents duplicate notifications
      requireInteraction: true, // Stays until dismissed
      data: {
        chatId: chat._id,
        type: 'new-chat'
      }
    });

    // Handle notification click - focus window and navigate to chat
    notification.onclick = function(event) {
      event.preventDefault();
      window.focus();

      // Navigate to chat (for future detail view)
      // For now, just focus the window
      // Future: window.location.href = `/chats/${chat._id}`;

      notification.close();
    };

  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

/**
 * Play notification sound based on priority
 * Plays for ALL new chats (per NOTF-04 requirement)
 * @param {string} priority - Priority level: 'low', 'medium', or 'high'
 */
export function playNotificationSound(priority = 'medium') {
  try {
    // Map priority to beep pattern
    switch (priority) {
      case 'high':
        // 3 ascending beeps
        generateBeep(800, 0.15, 3);
        break;
      case 'medium':
        // 2 beeps
        generateBeep(650, 0.15, 2);
        break;
      case 'low':
        // 1 soft beep
        generateBeep(500, 0.2, 1);
        break;
      default:
        // Default to medium priority
        generateBeep(650, 0.15, 2);
    }
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
}
