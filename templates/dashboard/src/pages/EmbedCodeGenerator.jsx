import React, { useState, useEffect } from 'react';

const EmbedCodeGenerator = () => {
  const [config, setConfig] = useState({
    serverUrl: 'http://localhost:8001',
    theme: {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      backgroundColor: '#ffffff',
      textColor: '#333333'
    },
    position: 'bottom-right',
    welcomeMessage: 'Hi! How can we help you today?',
    logo: '',
    buttonText: 'Chat with us'
  });

  const [embedCode, setEmbedCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateEmbedCode();
  }, [config]);

  const generateEmbedCode = () => {
    const code = `<script>
  (function() {
    const config = ${JSON.stringify(config, null, 4)};
    const script = document.createElement('script');
    script.src = config.serverUrl + '/widget/aichatdesk.js';
    script.async = true;
    script.onload = function() {
      window.AIChatDesk.init(config);
    };
    document.body.appendChild(script);
  })();
</script>`;
    setEmbedCode(code);
  };

  const handleConfigChange = (path, value) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      if (path.includes('.')) {
        const [parent, child] = path.split('.');
        newConfig[parent] = { ...newConfig[parent], [child]: value };
      } else {
        newConfig[path] = value;
      }
      return newConfig;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  };

  const handleReset = () => {
    setConfig({
      serverUrl: 'http://localhost:8001',
      theme: {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        backgroundColor: '#ffffff',
        textColor: '#333333'
      },
      position: 'bottom-right',
      welcomeMessage: 'Hi! How can we help you today?',
      logo: '',
      buttonText: 'Chat with us'
    });
  };

  const syntaxHighlight = (code) => {
    return code
      .replace(/(&lt;\/?script&gt;)/g, '<span style="color: #d73a49;">$1</span>')
      .replace(/(\bfunction\b|\bconst\b|\bvar\b|\breturn\b)/g, '<span style="color: #d73a49;">$1</span>')
      .replace(/(["'])([^"']*)\1/g, '<span style="color: #22863a;">$1$2$1</span>')
      .replace(/\b(\d+)\b/g, '<span style="color: #005cc5;">$1</span>');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
        Embed Code Generator
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>
        Customize your chat widget and copy the embed code to add to your website.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '24px'
      }}>
        {/* Configuration Panel */}
        <div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '16px',
            color: '#111827'
          }}>
            Configuration
          </h2>

          {/* Server URL */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '6px',
              color: '#374151'
            }}>
              Server URL
            </label>
            <input
              type="text"
              value={config.serverUrl}
              onChange={(e) => handleConfigChange('serverUrl', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontFamily: 'monospace'
              }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Use production URL for deployment
            </p>
          </div>

          {/* Theme Colors */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#111827'
            }}>
              Theme Colors
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '6px',
                  color: '#374151'
                }}>
                  Primary Color
                </label>
                <input
                  type="color"
                  value={config.theme.primaryColor}
                  onChange={(e) => handleConfigChange('theme.primaryColor', e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '6px',
                  color: '#374151'
                }}>
                  Secondary Color
                </label>
                <input
                  type="color"
                  value={config.theme.secondaryColor}
                  onChange={(e) => handleConfigChange('theme.secondaryColor', e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '6px',
                  color: '#374151'
                }}>
                  Background Color
                </label>
                <input
                  type="color"
                  value={config.theme.backgroundColor}
                  onChange={(e) => handleConfigChange('theme.backgroundColor', e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '6px',
                  color: '#374151'
                }}>
                  Text Color
                </label>
                <input
                  type="color"
                  value={config.theme.textColor}
                  onChange={(e) => handleConfigChange('theme.textColor', e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Position */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#374151'
            }}>
              Position
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                border: `2px solid ${config.position === 'bottom-right' ? '#3b82f6' : '#d1d5db'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: config.position === 'bottom-right' ? '#eff6ff' : '#fff'
              }}>
                <input
                  type="radio"
                  name="position"
                  value="bottom-right"
                  checked={config.position === 'bottom-right'}
                  onChange={(e) => handleConfigChange('position', e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                Bottom Right
              </label>
              <label style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                border: `2px solid ${config.position === 'bottom-left' ? '#3b82f6' : '#d1d5db'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: config.position === 'bottom-left' ? '#eff6ff' : '#fff'
              }}>
                <input
                  type="radio"
                  name="position"
                  value="bottom-left"
                  checked={config.position === 'bottom-left'}
                  onChange={(e) => handleConfigChange('position', e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                Bottom Left
              </label>
            </div>
          </div>

          {/* Welcome Message */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '6px',
              color: '#374151'
            }}>
              Welcome Message
            </label>
            <textarea
              value={config.welcomeMessage}
              onChange={(e) => handleConfigChange('welcomeMessage', e.target.value)}
              maxLength={200}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              {config.welcomeMessage.length}/200 characters
            </p>
          </div>

          {/* Button Text */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '6px',
              color: '#374151'
            }}>
              Button Text
            </label>
            <input
              type="text"
              value={config.buttonText}
              onChange={(e) => handleConfigChange('buttonText', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            />
          </div>

          {/* Logo URL */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '6px',
              color: '#374151'
            }}>
              Logo URL (optional)
            </label>
            <input
              type="text"
              value={config.logo}
              onChange={(e) => handleConfigChange('logo', e.target.value)}
              placeholder="https://example.com/logo.png"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            />
            {config.logo && (
              <div style={{ marginTop: '8px' }}>
                <img
                  src={config.logo}
                  alt="Logo preview"
                  style={{
                    maxWidth: '100px',
                    maxHeight: '100px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#fff',
              color: '#374151',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Reset to Defaults
          </button>
        </div>

        {/* Preview and Code Panel */}
        <div>
          {/* Live Preview */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#111827'
            }}>
              Live Preview
            </h2>
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '40px',
              backgroundColor: '#f9fafb',
              position: 'relative',
              minHeight: '200px'
            }}>
              {/* Mock widget button */}
              <div
                style={{
                  position: 'absolute',
                  [config.position.includes('right') ? 'right' : 'left']: '20px',
                  bottom: '20px',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: config.theme.primaryColor,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.3s'
                }}
                title={config.welcomeMessage}
              >
                💬
              </div>
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                Widget will appear at {config.position.replace('-', ' ')}
              </div>
            </div>
          </div>

          {/* Generated Code */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827'
              }}>
                Embed Code
              </h2>
              <button
                onClick={handleCopy}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: copied ? '#10b981' : '#3b82f6',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {copied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
            <pre style={{
              backgroundColor: '#1f2937',
              color: '#e5e7eb',
              padding: '16px',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '13px',
              lineHeight: '1.5',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              maxHeight: '400px'
            }}>
              {embedCode}
            </pre>
          </div>

          {/* Usage Instructions */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#1e40af'
            }}>
              How to Use
            </h3>
            <ul style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '14px',
              color: '#1e40af',
              lineHeight: '1.8'
            }}>
              <li>Paste this code before the closing <code>&lt;/body&gt;</code> tag in your HTML</li>
              <li>The widget will appear automatically on your website</li>
              <li>Customize colors and position above to match your brand</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedCodeGenerator;
