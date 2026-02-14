import React, { useState, useEffect } from 'react';

const CATEGORIES = [
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'general', label: 'General' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' }
];

const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 100;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 1000;

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#333',
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#666',
    cursor: 'pointer',
    padding: '0',
    lineHeight: '1'
  },
  body: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    marginBottom: '6px'
  },
  required: {
    color: '#f44336'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  inputError: {
    borderColor: '#f44336'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
    fontFamily: 'inherit',
    minHeight: '120px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
    backgroundColor: '#fff',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  charCounter: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px'
  },
  charCounterError: {
    color: '#f44336'
  },
  error: {
    fontSize: '13px',
    color: '#f44336',
    marginTop: '4px'
  },
  hint: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid #e0e0e0'
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
    color: '#333'
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    color: '#fff'
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed'
  },
  saving: {
    backgroundColor: '#9e9e9e',
    cursor: 'wait'
  }
};

function CannedResponseEditor({ response, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    shortcut: ''
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (response) {
      setFormData({
        title: response.title || '',
        content: response.content || '',
        category: response.category || '',
        shortcut: response.shortcut || ''
      });
    }
  }, [response]);

  const validate = () => {
    const newErrors = {};

    // Title validation
    if (!formData.title) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < MIN_TITLE_LENGTH) {
      newErrors.title = `Title must be at least ${MIN_TITLE_LENGTH} characters`;
    } else if (formData.title.length > MAX_TITLE_LENGTH) {
      newErrors.title = `Title must not exceed ${MAX_TITLE_LENGTH} characters`;
    }

    // Content validation
    if (!formData.content) {
      newErrors.content = 'Content is required';
    } else if (formData.content.length < MIN_CONTENT_LENGTH) {
      newErrors.content = `Content must be at least ${MIN_CONTENT_LENGTH} characters`;
    } else if (formData.content.length > MAX_CONTENT_LENGTH) {
      newErrors.content = `Content must not exceed ${MAX_CONTENT_LENGTH} characters`;
    }

    // Shortcut validation (optional)
    if (formData.shortcut && formData.shortcut.length > 0) {
      if (formData.shortcut.length < 2 || formData.shortcut.length > 20) {
        newErrors.shortcut = 'Shortcut must be 2-20 characters';
      } else if (!/^[a-zA-Z0-9]+$/.test(formData.shortcut)) {
        newErrors.shortcut = 'Shortcut must be alphanumeric only';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  const isValid = formData.title.length >= MIN_TITLE_LENGTH &&
    formData.title.length <= MAX_TITLE_LENGTH &&
    formData.content.length >= MIN_CONTENT_LENGTH &&
    formData.content.length <= MAX_CONTENT_LENGTH &&
    (!formData.shortcut || (formData.shortcut.length >= 2 && formData.shortcut.length <= 20 && /^[a-zA-Z0-9]+$/.test(formData.shortcut)));

  const titleCharsRemaining = MAX_TITLE_LENGTH - formData.title.length;
  const contentCharsRemaining = MAX_CONTENT_LENGTH - formData.content.length;

  return (
    <div style={styles.overlay} onClick={onCancel} onKeyDown={handleKeyDown}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {response?.id ? 'Edit Canned Response' : 'New Canned Response'}
          </h2>
          <button
            style={styles.closeButton}
            onClick={onCancel}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Title <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              style={{
                ...styles.input,
                ...(errors.title ? styles.inputError : {})
              }}
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Quick response title"
              disabled={saving}
              autoFocus
            />
            <div style={{
              ...styles.charCounter,
              ...(titleCharsRemaining < 0 ? styles.charCounterError : {})
            }}>
              {titleCharsRemaining} characters remaining
            </div>
            {errors.title && <div style={styles.error}>{errors.title}</div>}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Content <span style={styles.required}>*</span>
            </label>
            <textarea
              style={{
                ...styles.textarea,
                ...(errors.content ? styles.inputError : {})
              }}
              value={formData.content}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="Response content that will be copied to clipboard"
              disabled={saving}
            />
            <div style={{
              ...styles.charCounter,
              ...(contentCharsRemaining < 0 ? styles.charCounterError : {})
            }}>
              {contentCharsRemaining} characters remaining
            </div>
            {errors.content && <div style={styles.error}>{errors.content}</div>}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Category</label>
            <select
              style={styles.select}
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              disabled={saving}
            >
              <option value="">None</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Shortcut</label>
            <input
              type="text"
              style={{
                ...styles.input,
                ...(errors.shortcut ? styles.inputError : {})
              }}
              value={formData.shortcut}
              onChange={(e) => handleChange('shortcut', e.target.value)}
              placeholder="/greeting or !welcome"
              disabled={saving}
            />
            <div style={styles.hint}>
              2-20 alphanumeric characters (optional)
            </div>
            {errors.shortcut && <div style={styles.error}>{errors.shortcut}</div>}
          </div>
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.cancelButton }}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.button,
              ...(saving ? styles.saving : isValid ? styles.saveButton : styles.saveButtonDisabled)
            }}
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CannedResponseEditor;
