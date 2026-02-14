import React from 'react';

/**
 * Badge component showing AI vs Agent mode
 * Displays "Powered by AI" or "Talking to [Agent Name]"
 */
function Badge({ mode, agentName }) {
  const isAI = mode === 'ai';
  const backgroundColor = isAI ? '#3b82f6' : '#10b981';
  const text = isAI ? 'Powered by AI' : (agentName ? `Talking to ${agentName}` : 'Customer Support');

  // Icon SVGs
  const robotIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );

  const userIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </svg>
  );

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      backgroundColor,
      color: '#ffffff',
      fontSize: '12px',
      fontWeight: '500',
      padding: '4px 8px',
      borderRadius: '12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
      transition: 'background-color 0.3s ease'
    }}>
      {isAI ? robotIcon : userIcon}
      <span>{text}</span>
    </div>
  );
}

export default Badge;
