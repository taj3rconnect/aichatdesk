import React, { useState, useEffect } from 'react';
import ChatList from '../components/ChatList';
import FilterBar from '../components/FilterBar';
import SearchBar from '../components/SearchBar';
import UserInfoPanel from '../components/UserInfoPanel';
import AttachmentsViewer from '../components/AttachmentsViewer';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

const styles = {
  container: {
    maxWidth: '1600px',
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
  layout: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start'
  },
  mainContent: {
    flex: '1 1 70%',
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  sidebar: {
    flex: '1 1 30%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  }
};

function Dashboard() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [filters, setFilters] = useState({
    status: 'active',
    priority: 'all',
    category: 'all',
    agent: 'all',
    dateRange: null
  });
  const [agents, setAgents] = useState([]);

  // Fetch agents list for filter dropdown
  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch(`${API_URL}/api/agents/online`);
        if (!response.ok) throw new Error('Failed to fetch agents');

        const data = await response.json();
        setAgents(data);
      } catch (err) {
        console.error('Error fetching agents:', err);
      }
    }

    fetchAgents();
  }, []);

  const handleSearchResultSelect = (chat) => {
    setSelectedChat(chat);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Active Chats</h2>
        <p style={styles.subtitle}>Monitor all ongoing chats in real-time</p>
      </div>

      <SearchBar onResultSelect={handleSearchResultSelect} />
      <FilterBar filters={filters} onFilterChange={setFilters} agents={agents} />

      <div style={styles.layout}>
        {/* Main chat list */}
        <div style={styles.mainContent}>
          <ChatList filters={filters} onChatSelect={setSelectedChat} />
        </div>

        {/* Sidebar with user info and attachments */}
        {selectedChat && (
          <div style={styles.sidebar}>
            <UserInfoPanel sessionId={selectedChat.sessionId} />
            <AttachmentsViewer sessionId={selectedChat.sessionId} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
