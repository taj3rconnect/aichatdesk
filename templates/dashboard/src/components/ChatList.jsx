import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import useDashboardWebSocket from '../hooks/useDashboardWebSocket';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8001';

const styles = {
  container: {
    width: '100%'
  },
  connectionStatus: {
    padding: '12px 16px',
    marginBottom: '16px',
    borderRadius: '6px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  connected: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    border: '1px solid #a5d6a7'
  },
  disconnected: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #ef9a9a'
  },
  indicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'currentColor'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#fff'
  },
  thead: {
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #e0e0e0'
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#666'
  },
  tr: {
    borderBottom: '1px solid #e0e0e0',
    transition: 'background-color 0.2s'
  },
  trHover: {
    backgroundColor: '#f9f9f9'
  },
  td: {
    padding: '16px',
    fontSize: '14px'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  statusActive: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32'
  },
  statusWaiting: {
    backgroundColor: '#fff3e0',
    color: '#ef6c00'
  },
  statusClosed: {
    backgroundColor: '#f5f5f5',
    color: '#666'
  },
  priorityLow: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0'
  },
  priorityMedium: {
    backgroundColor: '#fff3e0',
    color: '#ef6c00'
  },
  priorityHigh: {
    backgroundColor: '#ffebee',
    color: '#c62828'
  },
  categoryTag: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: '#f5f5f5',
    color: '#666',
    marginRight: '4px'
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  userName: {
    fontWeight: '500',
    color: '#333'
  },
  userEmail: {
    fontSize: '12px',
    color: '#999'
  },
  modeIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  agentAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#4CAF50',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '500'
  },
  lastMessage: {
    color: '#666',
    fontSize: '13px',
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999'
  },
  loadingState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666'
  },
  errorState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#c62828',
    backgroundColor: '#ffebee',
    borderRadius: '8px',
    margin: '20px 0'
  }
};

function ChatList() {
  const [loading, setLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState(null);
  const { connected, chats, error, setChats } = useDashboardWebSocket(WS_URL);

  // Load initial chat data on mount
  useEffect(() => {
    async function fetchChats() {
      try {
        const response = await fetch(`${API_URL}/api/dashboard/chats`);
        if (!response.ok) throw new Error('Failed to fetch chats');

        const data = await response.json();
        setChats(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching chats:', err);
        setLoading(false);
      }
    }

    fetchChats();
  }, [setChats]);

  const getStatusBadge = (status) => {
    const statusStyles = {
      active: styles.statusActive,
      waiting: styles.statusWaiting,
      closed: styles.statusClosed
    };

    return (
      <span style={{ ...styles.badge, ...statusStyles[status] }}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityStyles = {
      low: styles.priorityLow,
      medium: styles.priorityMedium,
      high: styles.priorityHigh
    };

    return (
      <span style={{ ...styles.badge, ...priorityStyles[priority] }}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const formatWaitTime = (waitTimeMinutes) => {
    if (waitTimeMinutes < 60) {
      return `${waitTimeMinutes} min`;
    }
    const hours = Math.floor(waitTimeMinutes / 60);
    const minutes = waitTimeMinutes % 60;
    return `${hours} hr ${minutes} min`;
  };

  const getModeDisplay = (chat) => {
    if (chat.mode === 'ai') {
      return (
        <div style={styles.modeIndicator}>
          <span>🤖 AI</span>
        </div>
      );
    }

    if (chat.assignedAgent) {
      const initials = chat.assignedAgent.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      return (
        <div style={styles.modeIndicator}>
          {chat.assignedAgent.avatar ? (
            <img
              src={chat.assignedAgent.avatar}
              alt={chat.assignedAgent.name}
              style={styles.agentAvatar}
            />
          ) : (
            <div style={styles.agentAvatar}>{initials}</div>
          )}
          <span>{chat.assignedAgent.name}</span>
        </div>
      );
    }

    return <span>Human</span>;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>
          <div>Loading chats...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Connection Status */}
      <div
        style={{
          ...styles.connectionStatus,
          ...(connected ? styles.connected : styles.disconnected)
        }}
      >
        <div style={styles.indicator} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {/* Error State */}
      {error && (
        <div style={styles.errorState}>
          <strong>Connection Error:</strong> {error}
        </div>
      )}

      {/* Chat List */}
      {chats.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#666' }}>No active chats</h3>
          <p style={{ margin: 0 }}>New chats will appear here in real-time</p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Mode</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Wait Time</th>
              <th style={styles.th}>Last Message</th>
            </tr>
          </thead>
          <tbody>
            {chats.map((chat) => (
              <tr
                key={chat._id}
                style={{
                  ...styles.tr,
                  ...(hoveredRow === chat._id ? styles.trHover : {})
                }}
                onMouseEnter={() => setHoveredRow(chat._id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td style={styles.td}>
                  <div style={styles.userInfo}>
                    <span style={styles.userName}>
                      {chat.userName || 'Anonymous'}
                    </span>
                    <span style={styles.userEmail}>
                      {chat.userEmail || 'No email'}
                    </span>
                  </div>
                </td>
                <td style={styles.td}>{getStatusBadge(chat.status)}</td>
                <td style={styles.td}>{getModeDisplay(chat)}</td>
                <td style={styles.td}>
                  {chat.category && (
                    <span style={styles.categoryTag}>
                      {chat.category.replace('_', ' ')}
                    </span>
                  )}
                </td>
                <td style={styles.td}>{getPriorityBadge(chat.priority)}</td>
                <td style={styles.td}>
                  {chat.status === 'waiting' ? (
                    <span style={{ color: '#ef6c00', fontWeight: '500' }}>
                      Waiting {formatWaitTime(chat.waitTime)}
                    </span>
                  ) : (
                    <span style={{ color: '#666' }}>
                      {formatDistanceToNow(new Date(chat.startedAt), {
                        addSuffix: true
                      })}
                    </span>
                  )}
                </td>
                <td style={styles.td}>
                  <div style={styles.lastMessage}>
                    {chat.lastMessage || 'No messages yet'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ChatList;
