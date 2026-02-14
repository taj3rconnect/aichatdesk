import React from 'react';

const MetricCard = ({ title, value, icon, trend }) => {
  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.startsWith('+')) return '#10b981'; // green
    if (trend.startsWith('-')) return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px'
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            color: '#6b7280',
            fontWeight: '500',
            marginBottom: '4px'
          }}>
            {title}
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#111827'
          }}>
            {value}
          </div>
        </div>
      </div>
      {trend && (
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: getTrendColor()
        }}>
          {trend}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
