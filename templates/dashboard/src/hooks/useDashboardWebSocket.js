import { useState, useEffect, useCallback, useRef } from 'react';
import { showChatNotification, playNotificationSound, requestNotificationPermission } from '../utils/notifications';

/**
 * Custom hook for dashboard WebSocket connection
 * Manages real-time updates for chat monitoring
 */
function useDashboardWebSocket(url) {
  const [connected, setConnected] = useState(false);
  const [chats, setChats] = useState([]);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const eventHandlersRef = useRef({});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Dashboard WebSocket connected');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Identify as dashboard client
        ws.send(JSON.stringify({
          type: 'dashboard.connect',
          clientType: 'dashboard',
          timestamp: new Date().toISOString()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle different event types
          switch (data.type) {
            case 'dashboard.chat.created':
              handleChatCreated(data);
              break;
            case 'dashboard.chat.updated':
              handleChatUpdated(data);
              break;
            case 'dashboard.chat.closed':
              handleChatClosed(data);
              break;
            case 'dashboard.message.new':
              handleNewMessage(data);
              break;
            default:
              // Call custom event handlers if registered
              const handler = eventHandlersRef.current[data.type];
              if (handler) handler(data);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('Dashboard WebSocket disconnected');
        setConnected(false);
        wsRef.current = null;

        // Exponential backoff reconnection (max 30s delay)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting in ${delay}ms...`);
          connect();
        }, delay);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to connect to server');
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  const on = useCallback((eventType, handler) => {
    eventHandlersRef.current[eventType] = handler;
  }, []);

  // Event handlers for chat updates
  const handleChatCreated = (data) => {
    setChats(prev => [data.chat, ...prev]);

    // Trigger notifications for new chats
    playNotificationSound(data.chat.priority || 'medium');
    if (data.chat.priority === 'high') {
      showChatNotification(data.chat);
    }
  };

  const handleChatUpdated = (data) => {
    setChats(prev => prev.map(chat =>
      chat.sessionId === data.chat.sessionId ? { ...chat, ...data.chat } : chat
    ));
  };

  const handleChatClosed = (data) => {
    setChats(prev => prev.filter(chat => chat.sessionId !== data.sessionId));
  };

  const handleNewMessage = (data) => {
    setChats(prev => prev.map(chat => {
      if (chat.sessionId === data.sessionId) {
        return {
          ...chat,
          lastMessage: data.message.content,
          lastMessageAt: data.message.sentAt
        };
      }
      return chat;
    }));
  };

  // Auto-connect on mount, disconnect on unmount
  useEffect(() => {
    // Request notification permission on mount
    requestNotificationPermission().then(permission => {
      console.log('Notification permission:', permission);
    });

    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    chats,
    error,
    sendMessage,
    on,
    setChats // Allow external updates (for initial REST data load)
  };
}

export default useDashboardWebSocket;
