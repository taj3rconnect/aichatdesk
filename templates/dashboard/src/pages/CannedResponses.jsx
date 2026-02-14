import React, { useState, useEffect } from 'react';
import CannedResponseEditor from '../components/CannedResponseEditor';

const CATEGORIES = ['billing', 'technical', 'general', 'feature_request', 'bug_report'];

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#333',
    margin: 0
  },
  count: {
    fontSize: '14px',
    color: '#666',
    marginTop: '4px'
  },
  newButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    backgroundColor: '#4CAF50',
    color: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  newButtonHover: {
    backgroundColor: '#45a049'
  },
  controls: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px'
  },
  searchBox: {
    flex: 1,
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none'
  },
  select: {
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: '#fff',
    cursor: 'pointer'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'box-shadow 0.2s'
  },
  cardHover: {
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '12px',
    wordBreak: 'break-word'
  },
  cardContent: {
    fontSize: '14px',
    color: '#555',
    lineHeight: '1.6',
    marginBottom: '16px',
    wordBreak: 'break-word'
  },
  cardContentTruncated: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical'
  },
  readMore: {
    color: '#4CAF50',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    marginTop: '8px'
  },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px'
  },
  badge: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '12px',
    fontWeight: '500'
  },
  categoryBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2'
  },
  shortcutBadge: {
    backgroundColor: '#f3e5f5',
    color: '#7b1fa2'
  },
  usageBadge: {
    backgroundColor: '#fff3e0',
    color: '#f57c00'
  },
  cardFooter: {
    fontSize: '13px',
    color: '#999',
    marginBottom: '12px'
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  button: {
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  useButton: {
    backgroundColor: '#4CAF50',
    color: '#fff'
  },
  editButton: {
    backgroundColor: '#2196F3',
    color: '#fff'
  },
  deleteButton: {
    backgroundColor: '#f44336',
    color: '#fff'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  loading: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666'
  },
  error: {
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '6px',
    padding: '12px 16px',
    marginBottom: '20px',
    color: '#c33'
  }
};

function formatCategory(category) {
  if (!category) return null;
  return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function CannedResponses() {
  const [responses, setResponses] = useState([]);
  const [filteredResponses, setFilteredResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [hoveredButton, setHoveredButton] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  const isAdminOrSupervisor = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  const fetchData = async () => {
    try {
      setError(null);

      // For now, simulate auth - in production this would come from auth context
      // Fetch current user info
      const userResponse = await fetch('/api/agents/me');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setCurrentUser(userData);
      }

      // Fetch canned responses
      const responsesResponse = await fetch('/api/canned-responses');
      if (!responsesResponse.ok) {
        throw new Error('Failed to fetch canned responses');
      }

      const data = await responsesResponse.json();
      setResponses(data);
      setFilteredResponses(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = [...responses];

    // Apply category filter
    if (filter !== 'all') {
      filtered = filtered.filter(r => r.category === filter);
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(searchLower) ||
        r.content.toLowerCase().includes(searchLower)
      );
    }

    setFilteredResponses(filtered);
  }, [filter, search, responses]);

  const handleUse = async (response) => {
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(response.content);

      // Increment usage count
      await fetch(`/api/canned-responses/${response.id}/use`, {
        method: 'POST'
      });

      // Update local state
      setResponses(prev => prev.map(r =>
        r.id === response.id ? { ...r, usageCount: r.usageCount + 1 } : r
      ));

      // Show success (in production, use toast)
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Copy error:', err);
      alert('Failed to copy to clipboard');
    }
  };

  const handleEdit = (response) => {
    setEditing(response);
  };

  const handleDelete = async (response) => {
    if (!window.confirm(`Delete "${response.title}"?`)) {
      return;
    }

    try {
      const deleteResponse = await fetch(`/api/canned-responses/${response.id}`, {
        method: 'DELETE'
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete');
      }

      setResponses(prev => prev.filter(r => r.id !== response.id));
    } catch (err) {
      console.error('Delete error:', err);
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleSave = async (data) => {
    try {
      let response;

      if (editing && editing.id) {
        // Update existing
        response = await fetch(`/api/canned-responses/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        // Create new
        response = await fetch('/api/canned-responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save');
      }

      const saved = await response.json();

      if (editing && editing.id) {
        setResponses(prev => prev.map(r => r.id === saved.id ? saved : r));
      } else {
        setResponses(prev => [saved, ...prev]);
      }

      setEditing(null);
    } catch (err) {
      console.error('Save error:', err);
      throw err;
    }
  };

  const handleCancel = () => {
    setEditing(null);
  };

  const toggleExpand = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading canned responses...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Canned Responses</h1>
          <div style={styles.count}>
            {filteredResponses.length} {filteredResponses.length === 1 ? 'response' : 'responses'}
          </div>
        </div>
        {isAdminOrSupervisor && (
          <button
            style={{
              ...styles.newButton,
              ...(hoveredButton === 'new' ? styles.newButtonHover : {})
            }}
            onClick={() => setEditing({})}
            onMouseEnter={() => setHoveredButton('new')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            New Response
          </button>
        )}
      </div>

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={styles.controls}>
        <input
          type="text"
          placeholder="Search responses..."
          style={styles.searchBox}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={styles.select}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{formatCategory(cat)}</option>
          ))}
        </select>
      </div>

      {filteredResponses.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💬</div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
            {responses.length === 0 ? 'No canned responses yet' : 'No responses match your filters'}
          </div>
          {responses.length === 0 && isAdminOrSupervisor && (
            <div style={{ fontSize: '14px' }}>Create your first response to get started</div>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredResponses.map(response => {
            const isExpanded = expandedCards.has(response.id);
            const needsTruncation = response.content.length > 200;

            return (
              <div
                key={response.id}
                style={{
                  ...styles.card,
                  ...(hoveredCard === response.id ? styles.cardHover : {})
                }}
                onMouseEnter={() => setHoveredCard(response.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div style={styles.cardTitle}>{response.title}</div>

                <div
                  style={{
                    ...styles.cardContent,
                    ...(!isExpanded && needsTruncation ? styles.cardContentTruncated : {})
                  }}
                >
                  {response.content}
                </div>

                {needsTruncation && (
                  <div
                    style={styles.readMore}
                    onClick={() => toggleExpand(response.id)}
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                  </div>
                )}

                <div style={styles.cardMeta}>
                  {response.category && (
                    <span style={{ ...styles.badge, ...styles.categoryBadge }}>
                      {formatCategory(response.category)}
                    </span>
                  )}
                  {response.shortcut && (
                    <span style={{ ...styles.badge, ...styles.shortcutBadge }}>
                      {response.shortcut}
                    </span>
                  )}
                  <span style={{ ...styles.badge, ...styles.usageBadge }}>
                    Used {response.usageCount} {response.usageCount === 1 ? 'time' : 'times'}
                  </span>
                </div>

                <div style={styles.cardFooter}>
                  Created by {response.createdBy}
                </div>

                <div style={styles.cardActions}>
                  <button
                    style={{ ...styles.button, ...styles.useButton }}
                    onClick={() => handleUse(response)}
                  >
                    Use
                  </button>
                  {isAdminOrSupervisor && (
                    <>
                      <button
                        style={{ ...styles.button, ...styles.editButton }}
                        onClick={() => handleEdit(response)}
                      >
                        Edit
                      </button>
                      <button
                        style={{ ...styles.button, ...styles.deleteButton }}
                        onClick={() => handleDelete(response)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <CannedResponseEditor
          response={editing.id ? editing : null}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

export default CannedResponses;
