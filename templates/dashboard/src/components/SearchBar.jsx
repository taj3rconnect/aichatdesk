import React, { useState, useEffect, useRef } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

const styles = {
  container: {
    position: 'relative',
    marginBottom: '16px'
  },
  searchInput: {
    width: '100%',
    padding: '12px 40px 12px 40px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    backgroundColor: '#fff',
    transition: 'border-color 0.2s'
  },
  searchInputFocused: {
    borderColor: '#1565c0',
    outline: 'none'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#999',
    pointerEvents: 'none'
  },
  clearButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#999',
    cursor: 'pointer',
    padding: '4px',
    lineHeight: '1'
  },
  loadingSpinner: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '16px',
    height: '16px',
    border: '2px solid #f3f3f3',
    borderTop: '2px solid #1565c0',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  resultsDropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '6px',
    maxHeight: '400px',
    overflowY: 'auto',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000
  },
  resultItem: {
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background-color 0.2s'
  },
  resultItemHover: {
    backgroundColor: '#f9f9f9'
  },
  resultItemLast: {
    borderBottom: 'none'
  },
  userName: {
    fontWeight: '500',
    color: '#333',
    marginBottom: '4px'
  },
  userEmail: {
    fontSize: '12px',
    color: '#999',
    marginBottom: '4px'
  },
  matchSnippet: {
    fontSize: '13px',
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  highlight: {
    backgroundColor: '#fff3cd',
    fontWeight: '500',
    padding: '0 2px'
  },
  emptyState: {
    padding: '24px 16px',
    textAlign: 'center',
    color: '#999',
    fontSize: '14px'
  },
  matchType: {
    fontSize: '11px',
    color: '#1565c0',
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: '4px'
  }
};

function SearchBar({ onResultSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const debounceTimerRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced search effect
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query too short
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Set up new debounced search
    setSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/dashboard/chats/search?q=${encodeURIComponent(searchQuery)}`);

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const results = await response.json();
        setSearchResults(results);
        setShowResults(true);
        setSearching(false);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
        setSearching(false);
      }
    }, 300);

    // Cleanup timer on unmount or query change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleResultClick = (chat) => {
    setShowResults(false);
    setSearchQuery('');
    setSearchResults([]);
    if (onResultSelect) {
      onResultSelect(chat);
    }
  };

  const highlightMatch = (text, query) => {
    if (!text || !query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={index} style={styles.highlight}>{part}</mark>
        : part
    );
  };

  const handleKeyDown = (e) => {
    if (!showResults || searchResults.length === 0) return;

    if (e.key === 'Escape') {
      setShowResults(false);
      setHoveredIndex(null);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoveredIndex(prev =>
        prev === null ? 0 : Math.min(prev + 1, searchResults.length - 1)
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoveredIndex(prev =>
        prev === null ? searchResults.length - 1 : Math.max(prev - 1, 0)
      );
    } else if (e.key === 'Enter' && hoveredIndex !== null) {
      e.preventDefault();
      handleResultClick(searchResults[hoveredIndex]);
    }
  };

  return (
    <div style={styles.container}>
      {/* Search Icon */}
      <span style={styles.searchIcon}>🔍</span>

      {/* Search Input */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search chats, messages, users..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        onKeyDown={handleKeyDown}
        style={{
          ...styles.searchInput,
          ...(isFocused ? styles.searchInputFocused : {})
        }}
      />

      {/* Loading Spinner or Clear Button */}
      {searching ? (
        <div style={styles.loadingSpinner} />
      ) : searchQuery.length > 0 ? (
        <button
          style={styles.clearButton}
          onClick={handleClear}
          title="Clear search"
        >
          ✕
        </button>
      ) : null}

      {/* Results Dropdown */}
      {showResults && searchQuery.trim().length >= 2 && (
        <div style={styles.resultsDropdown}>
          {searchResults.length === 0 ? (
            <div style={styles.emptyState}>
              No results found for "{searchQuery}"
            </div>
          ) : (
            searchResults.map((chat, index) => (
              <div
                key={chat._id}
                style={{
                  ...styles.resultItem,
                  ...(hoveredIndex === index ? styles.resultItemHover : {}),
                  ...(index === searchResults.length - 1 ? styles.resultItemLast : {})
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleResultClick(chat)}
              >
                <div style={styles.matchType}>
                  {chat.matchType === 'message' ? '💬 Message' :
                   chat.matchType === 'userName' ? '👤 User Name' :
                   chat.matchType === 'userEmail' ? '📧 Email' :
                   chat.matchType === 'summary' ? '📝 Summary' : 'Match'}
                </div>
                <div style={styles.userName}>
                  {highlightMatch(chat.userName || 'Anonymous', searchQuery)}
                </div>
                <div style={styles.userEmail}>
                  {highlightMatch(chat.userEmail || 'No email', searchQuery)}
                </div>
                {chat.matchSnippet && (
                  <div style={styles.matchSnippet}>
                    {highlightMatch(chat.matchSnippet, searchQuery)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: translateY(-50%) rotate(0deg); }
          100% { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default SearchBar;
