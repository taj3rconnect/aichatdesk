import React, { useState, useEffect } from 'react';

/**
 * UserInfoPanel Component
 *
 * Displays comprehensive user context for selected chat:
 * - User identity (name, email)
 * - Device info (browser, OS, device type)
 * - Location (country, city, region, timezone)
 * - Context (current page, IP address)
 */
function UserInfoPanel({ sessionId }) {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setUserInfo(null);
      return;
    }

    fetchUserInfo();
  }, [sessionId]);

  const fetchUserInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/dashboard/chats/${sessionId}/info`);

      if (!response.ok) {
        throw new Error('Failed to load user info');
      }

      const data = await response.json();
      setUserInfo(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching user info:', err);
    } finally {
      setLoading(false);
    }
  };

  // Empty state
  if (!sessionId) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>👤</span>
          <p style={styles.emptyText}>Select a chat to view user info</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>User Information</h3>
        </div>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>User Information</h3>
        </div>
        <div style={styles.error}>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.retryButton} onClick={fetchUserInfo}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Main content
  if (!userInfo) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>User Information</h3>
      </div>

      <div style={styles.content}>
        {/* User Identity Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.icon}>👤</span>
            <h4 style={styles.sectionTitle}>Identity</h4>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Name:</span>
            <span style={styles.value}>{userInfo.userName}</span>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Email:</span>
            <span style={styles.value}>{userInfo.userEmail}</span>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Session Started:</span>
            <span style={styles.value}>
              {new Date(userInfo.sessionStarted).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Device Info Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.icon}>💻</span>
            <h4 style={styles.sectionTitle}>Device</h4>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Browser:</span>
            <span style={styles.value}>
              {userInfo.browser.name} {userInfo.browser.version}
            </span>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>OS:</span>
            <span style={styles.value}>
              {userInfo.os.name} {userInfo.os.version}
            </span>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Type:</span>
            <span style={styles.value}>{userInfo.device.type}</span>
          </div>
        </div>

        {/* Location Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.icon}>🌍</span>
            <h4 style={styles.sectionTitle}>Location</h4>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Country:</span>
            <span style={styles.value}>{userInfo.location.country}</span>
          </div>
          {userInfo.location.region && (
            <div style={styles.field}>
              <span style={styles.label}>Region:</span>
              <span style={styles.value}>{userInfo.location.region}</span>
            </div>
          )}
          <div style={styles.field}>
            <span style={styles.label}>City:</span>
            <span style={styles.value}>{userInfo.location.city}</span>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Timezone:</span>
            <span style={styles.value}>{userInfo.location.timezone}</span>
          </div>
        </div>

        {/* Context Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.icon}>🔗</span>
            <h4 style={styles.sectionTitle}>Context</h4>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Current Page:</span>
            {userInfo.currentPage && userInfo.currentPage !== 'Unknown' ? (
              <a
                href={userInfo.currentPage}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                {userInfo.currentPage}
              </a>
            ) : (
              <span style={styles.value}>Unknown</span>
            )}
          </div>
          <div style={styles.field}>
            <span style={styles.label}>IP Address:</span>
            <span style={styles.valueMonospace}>{userInfo.ipAddress}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline styles for component isolation
const styles = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    overflow: 'hidden',
    marginBottom: '16px'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f9f9f9'
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  content: {
    padding: '16px'
  },
  section: {
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: '1px solid #f0f0f0'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px'
  },
  icon: {
    fontSize: '18px',
    marginRight: '8px'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '600',
    color: '#555'
  },
  field: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
    fontSize: '13px'
  },
  label: {
    color: '#777',
    fontWeight: '500',
    marginRight: '12px',
    flexShrink: 0
  },
  value: {
    color: '#333',
    textAlign: 'right',
    wordBreak: 'break-word'
  },
  valueMonospace: {
    color: '#333',
    textAlign: 'right',
    fontFamily: 'monospace',
    fontSize: '12px'
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
    textAlign: 'right',
    wordBreak: 'break-all',
    fontSize: '12px'
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '12px',
    opacity: 0.3
  },
  emptyText: {
    color: '#999',
    fontSize: '14px',
    margin: 0
  },
  loading: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#666'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #f0f0f0',
    borderTop: '3px solid #007bff',
    borderRadius: '50%',
    margin: '0 auto 12px',
    animation: 'spin 1s linear infinite'
  },
  error: {
    padding: '20px',
    textAlign: 'center'
  },
  errorText: {
    color: '#d9534f',
    marginBottom: '12px'
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  }
};

// Add keyframe animation for spinner
const styleSheet = document.styleSheets[0];
if (styleSheet) {
  styleSheet.insertRule(`
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `, styleSheet.cssRules.length);
}

export default UserInfoPanel;
