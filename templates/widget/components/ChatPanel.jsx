import React, { useState, useEffect, useRef } from 'react';
import Badge from './Badge';

/**
 * ChatPanel component - Main chat interface
 * Handles WebSocket events for agent takeover/return
 */
function ChatPanel({ sessionId, ws, userInfo, onClose }) {
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState('ai');
  const [agentName, setAgentName] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket event listeners
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'agent.takeover':
            // Agent took over the chat
            if (data.sessionId === sessionId) {
              setMode('human');
              setAgentName(data.agentName);
              // Add system message
              setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'system',
                content: `You are now chatting with ${data.agentName}`,
                timestamp: new Date()
              }]);
            }
            break;

          case 'agent.return':
            // Chat returned to AI
            if (data.sessionId === sessionId) {
              setMode('ai');
              setAgentName(null);
              // Add system message
              setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'system',
                content: 'Chat returned to AI assistant',
                timestamp: new Date()
              }]);
            }
            break;

          case 'chat.message':
            // Regular chat message
            setMessages(prev => [...prev, {
              id: data.message.id,
              type: 'message',
              sender: data.message.sender,
              senderName: data.message.senderName,
              content: data.message.content,
              timestamp: new Date(data.message.sentAt)
            }]);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws, sessionId]);

  const renderMessage = (msg) => {
    if (msg.type === 'system') {
      return (
        <div key={msg.id} style={{
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '13px',
          fontStyle: 'italic',
          color: '#6b7280',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          {msg.content}
        </div>
      );
    }

    // Regular message
    const isUser = msg.sender === 'user';
    return (
      <div key={msg.id} style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding: '4px 16px'
      }}>
        <div style={{
          maxWidth: '70%',
          padding: '8px 12px',
          borderRadius: '12px',
          backgroundColor: isUser ? '#3b82f6' : '#f3f4f6',
          color: isUser ? '#ffffff' : '#1f2937',
          fontSize: '14px',
          lineHeight: '1.5',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          {!isUser && msg.senderName && (
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              marginBottom: '4px',
              color: '#6b7280'
            }}>
              {msg.senderName}
            </div>
          )}
          <div>{msg.content}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937'
          }}>
            Customer Support
          </h3>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6b7280',
              fontSize: '20px'
            }}
          >
            ×
          </button>
        </div>
        {/* Badge showing AI vs Agent mode */}
        <Badge mode={mode} agentName={agentName} />
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 0'
      }}>
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Placeholder */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <input
          type="text"
          placeholder="Type a message..."
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none'
          }}
        />
      </div>
    </div>
  );
}

export default ChatPanel;
