import React from 'react';
import ChatList from '../components/ChatList';

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
        <ChatList />
      </div>
    </div>
  );
}

export default Dashboard;
