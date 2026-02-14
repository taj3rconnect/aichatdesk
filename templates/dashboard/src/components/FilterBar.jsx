import React from 'react';

const styles = {
  container: {
    backgroundColor: '#fff',
    padding: '16px',
    borderRadius: '6px',
    marginBottom: '16px',
    border: '1px solid #e0e0e0'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    margin: 0
  },
  activeFilterBadge: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  filtersRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '120px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#666'
  },
  select: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    color: '#333',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'border-color 0.2s'
  },
  dateInput: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    color: '#333',
    backgroundColor: '#fff'
  },
  clearButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '18px'
  },
  clearButtonHover: {
    backgroundColor: '#f5f5f5',
    borderColor: '#999'
  },
  dateRangeGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  }
};

function FilterBar({ filters, onFilterChange, agents }) {
  const [clearButtonHovered, setClearButtonHovered] = React.useState(false);

  const handleFilterChange = (field, value) => {
    onFilterChange({
      ...filters,
      [field]: value
    });
  };

  const handleDateRangeChange = (field, value) => {
    onFilterChange({
      ...filters,
      dateRange: {
        ...(filters.dateRange || {}),
        [field]: value
      }
    });
  };

  const clearFilters = () => {
    onFilterChange({
      status: 'all',
      priority: 'all',
      category: 'all',
      agent: 'all',
      dateRange: null
    });
  };

  const activeFilterCount = [
    filters.status !== 'all',
    filters.priority !== 'all',
    filters.category !== 'all',
    filters.agent !== 'all',
    filters.dateRange
  ].filter(Boolean).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Filters</h3>
        {activeFilterCount > 0 && (
          <span style={styles.activeFilterBadge}>
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
          </span>
        )}
      </div>

      <div style={styles.filtersRow}>
        {/* Status Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Status</label>
          <select
            style={styles.select}
            value={filters.status || 'all'}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="waiting">Waiting</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Priority</label>
          <select
            style={styles.select}
            value={filters.priority || 'all'}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Category Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Category</label>
          <select
            style={styles.select}
            value={filters.category || 'all'}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="all">All</option>
            <option value="billing">Billing</option>
            <option value="technical">Technical</option>
            <option value="general">General</option>
            <option value="feature_request">Feature Request</option>
            <option value="bug_report">Bug Report</option>
          </select>
        </div>

        {/* Agent Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Agent</label>
          <select
            style={styles.select}
            value={filters.agent || 'all'}
            onChange={(e) => handleFilterChange('agent', e.target.value)}
          >
            <option value="all">All</option>
            <option value="unassigned">Unassigned</option>
            {agents && agents.map(agent => (
              <option key={agent._id} value={agent._id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div style={styles.filterGroup}>
          <label style={styles.label}>Date Range</label>
          <div style={styles.dateRangeGroup}>
            <input
              type="date"
              style={styles.dateInput}
              value={filters.dateRange?.from || ''}
              onChange={(e) => handleDateRangeChange('from', e.target.value)}
              placeholder="From"
            />
            <span style={{ color: '#999' }}>to</span>
            <input
              type="date"
              style={styles.dateInput}
              value={filters.dateRange?.to || ''}
              onChange={(e) => handleDateRangeChange('to', e.target.value)}
              placeholder="To"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {activeFilterCount > 0 && (
          <button
            style={{
              ...styles.clearButton,
              ...(clearButtonHovered ? styles.clearButtonHover : {})
            }}
            onClick={clearFilters}
            onMouseEnter={() => setClearButtonHovered(true)}
            onMouseLeave={() => setClearButtonHovered(false)}
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}

export default FilterBar;
