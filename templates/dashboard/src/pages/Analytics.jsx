import React, { useState, useEffect } from 'react';
import MetricCard from '../components/MetricCard';
import AnalyticsChart from '../components/AnalyticsChart';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [commonQuestions, setCommonQuestions] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState('Last 30 days');

  const presets = {
    'Last 7 days': {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    },
    'Last 30 days': {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    },
    'Last 90 days': {
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('aichatdesk_token');
      const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:8001';

      // Fetch overview
      const overviewResponse = await fetch(
        `${serverUrl}/api/analytics/overview?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!overviewResponse.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const overviewData = await overviewResponse.json();
      setAnalytics(overviewData);

      // Fetch common questions
      const questionsResponse = await fetch(
        `${serverUrl}/api/analytics/common-questions?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        setCommonQuestions(questionsData);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const handlePresetClick = (presetName) => {
    setActivePreset(presetName);
    setDateRange(presets[presetName]);
  };

  const handleCustomDateChange = (field, value) => {
    setActivePreset('Custom');
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const formatRating = (rating) => {
    const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
    return `${rating} ${stars}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px' }}>Analytics</h1>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{
              height: '120px',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              animation: 'pulse 2s infinite'
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{ padding: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px' }}>Analytics</h1>
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          backgroundColor: '#f9fafb'
        }}>
          Failed to load analytics data
        </div>
      </div>
    );
  }

  const totalResolved = analytics.aiResolved + analytics.humanResolved;
  const aiPercentage = totalResolved > 0 ? Math.round((analytics.aiResolved / totalResolved) * 100) : 0;
  const humanPercentage = totalResolved > 0 ? Math.round((analytics.humanResolved / totalResolved) * 100) : 0;
  const satisfactionRate = analytics.totalRatings > 0
    ? Math.round((analytics.thumbsUp / analytics.totalRatings) * 100)
    : 0;

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px' }}>Analytics</h1>

      {/* Date Range Selector */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
            Date Range:
          </div>
          {Object.keys(presets).map(presetName => (
            <button
              key={presetName}
              onClick={() => handlePresetClick(presetName)}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: activePreset === presetName ? '#3b82f6' : '#fff',
                color: activePreset === presetName ? '#fff' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {presetName}
            </button>
          ))}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            />
            <span style={{ color: '#6b7280' }}>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Empty State */}
      {analytics.totalChats === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          backgroundColor: '#f9fafb',
          marginBottom: '20px'
        }}>
          No data for selected date range
        </div>
      )}

      {/* KPI Cards */}
      {analytics.totalChats > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            <MetricCard
              title="Total Chats"
              value={analytics.totalChats}
              icon="💬"
            />
            <MetricCard
              title="AI Resolved"
              value={`${analytics.aiResolved} (${aiPercentage}%)`}
              icon="🤖"
            />
            <MetricCard
              title="Human Resolved"
              value={`${analytics.humanResolved} (${humanPercentage}%)`}
              icon="👤"
            />
            <MetricCard
              title="Avg Response Time"
              value={`${analytics.avgResponseTimeMinutes} min`}
              icon="⏱️"
            />
            <MetricCard
              title="Avg Rating"
              value={formatRating(analytics.avgRating)}
              icon="⭐"
            />
            <MetricCard
              title="Satisfaction Rate"
              value={`${satisfactionRate}% (${analytics.thumbsUp}/${analytics.totalRatings})`}
              icon="👍"
            />
          </div>

          {/* Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#111827'
              }}>
                Chats by Category
              </h2>
              <AnalyticsChart data={analytics.byCategory} type="bar" />
            </div>
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#111827'
              }}>
                Chats by Priority
              </h2>
              <AnalyticsChart data={analytics.byPriority} type="bar" />
            </div>
          </div>

          {/* Common Questions */}
          {commonQuestions.length > 0 && (
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#111827'
              }}>
                Common Questions
              </h2>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#fff',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        Question
                      </th>
                      <th style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151',
                        borderBottom: '1px solid #e5e7eb',
                        width: '100px'
                      }}>
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {commonQuestions.map((q, index) => (
                      <tr
                        key={index}
                        style={{
                          borderBottom: index < commonQuestions.length - 1 ? '1px solid #e5e7eb' : 'none'
                        }}
                      >
                        <td style={{
                          padding: '12px 16px',
                          fontSize: '14px',
                          color: '#374151'
                        }}>
                          {q.question}
                        </td>
                        <td style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#6b7280'
                        }}>
                          {q.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics;
