import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import KnowledgeBase from './pages/KnowledgeBase';
import EmbedCodeGenerator from './pages/EmbedCodeGenerator';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/analytics', label: 'Analytics', icon: '📈' },
  { path: '/knowledge', label: 'Knowledge Base', icon: '📚' },
  { path: '/embed', label: 'Embed Code', icon: '🔗' },
  { path: '/settings', label: 'Settings', icon: '⚙️' }
];

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  sidebar: {
    width: '250px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
  },
  logo: {
    padding: '24px 20px',
    fontSize: '20px',
    fontWeight: 'bold',
    borderBottom: '1px solid #333',
    color: '#fff'
  },
  nav: {
    flex: 1,
    padding: '20px 0'
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    color: '#bbb',
    textDecoration: 'none',
    transition: 'all 0.2s',
    cursor: 'pointer'
  },
  navItemActive: {
    backgroundColor: '#333',
    color: '#fff',
    borderLeft: '3px solid #4CAF50'
  },
  navItemHover: {
    backgroundColor: '#2a2a2a'
  },
  icon: {
    marginRight: '12px',
    fontSize: '18px'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    backgroundColor: '#fff',
    padding: '16px 24px',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#333',
    margin: 0
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto'
  }
};

function NavItem({ item }) {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const [isHovered, setIsHovered] = React.useState(false);

  const itemStyle = {
    ...styles.navItem,
    ...(isActive ? styles.navItemActive : {}),
    ...(isHovered && !isActive ? styles.navItemHover : {})
  };

  return (
    <Link
      to={item.path}
      style={itemStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={styles.icon}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

function Sidebar() {
  return (
    <div style={styles.sidebar}>
      <div style={styles.logo}>
        AIChatDesk
      </div>
      <nav style={styles.nav}>
        {navItems.map(item => (
          <NavItem key={item.path} item={item} />
        ))}
      </nav>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
      <h2>{title}</h2>
      <p>This feature will be implemented in a future phase.</p>
    </div>
  );
}

function App() {
  const basename = process.env.REACT_APP_BASENAME || '/';

  return (
    <BrowserRouter basename={basename}>
      <div style={styles.container}>
        <Sidebar />
        <div style={styles.main}>
          <header style={styles.header}>
            <h1 style={styles.headerTitle}>Operator Dashboard</h1>
          </header>
          <main style={styles.content}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/embed" element={<EmbedCodeGenerator />} />
              <Route path="/settings" element={<Placeholder title="Settings" />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
