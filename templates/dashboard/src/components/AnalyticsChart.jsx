import React from 'react';

const AnalyticsChart = ({ data, type = 'bar' }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: '#f9fafb'
      }}>
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));

  const getBarColor = (label, index) => {
    // Priority colors
    if (label === 'high') return '#ef4444'; // red
    if (label === 'medium') return '#f59e0b'; // yellow
    if (label === 'low') return '#10b981'; // green

    // Category colors (alternating)
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    return colors[index % colors.length];
  };

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '20px',
      backgroundColor: '#fff'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              minWidth: '120px',
              fontSize: '14px',
              color: '#374151',
              fontWeight: '500',
              textTransform: 'capitalize'
            }}>
              {item.label || item.category || item.priority || 'Unknown'}
            </div>
            <div style={{
              flex: 1,
              height: '32px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div
                style={{
                  height: '100%',
                  width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                  backgroundColor: getBarColor(item.label || item.category || item.priority, index),
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '8px'
                }}
                title={`${item.value} items`}
              >
                {item.value > 0 && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                  }}>
                    {item.value}
                  </span>
                )}
              </div>
            </div>
            <div style={{
              minWidth: '50px',
              textAlign: 'right',
              fontSize: '14px',
              color: '#6b7280',
              fontWeight: '600'
            }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalyticsChart;
