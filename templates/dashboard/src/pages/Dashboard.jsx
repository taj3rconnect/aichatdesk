import React from 'react';

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#333',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  }
};

function Dashboard() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Active Chats</h2>
        <p style={styles.subtitle}>Monitor all ongoing chats in real-time</p>
      </div>
      <div style={styles.section}>
        {/* ChatList component will be added in Task 2 */}
        <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
          Chat list will appear here
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
