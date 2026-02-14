import React, { useState, useRef, useEffect } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
import { validateFile } from '../utils/fileValidation';
import AttachmentPreview from './AttachmentPreview';

const MAX_ATTACHMENTS = 5;
const MAX_CHARS = 2000;

/**
 * Message input component with file attachment support
 * @param {Object} props
 * @param {Function} props.onSend - Callback when message is sent
 * @param {boolean} props.disabled - Disable input
 */
export default function MessageInput({ onSend, disabled = false }) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const { uploadFiles, uploading, progress, error: uploadError } = useFileUpload();

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e) => {
    // Enter to send, Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return;
    if (disabled || uploading) return;

    // Send message with attachments
    onSend({
      content: message.trim(),
      attachments: attachments
    });

    // Clear input and reset
    setMessage('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleAttachClick = () => {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    await handleFiles(files);
    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (let item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      await handleFiles(files);
    }
  };

  const handleFiles = async (files) => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      alert(`Maximum ${MAX_ATTACHMENTS} attachments allowed per message`);
      return;
    }

    // Limit to available slots
    const availableSlots = MAX_ATTACHMENTS - attachments.length;
    const filesToUpload = files.slice(0, availableSlots);

    try {
      // Upload files to server
      const response = await uploadFiles(filesToUpload);

      // Add returned metadata to attachments
      setAttachments(prev => [...prev, ...response.files]);
    } catch (error) {
      console.error('File upload failed:', error);
      // Error is already set in useFileUpload hook
    }
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const charCount = message.length;
  const showCharCount = charCount > MAX_CHARS * 0.8;
  const overLimit = charCount > MAX_CHARS;

  return (
    <div style={styles.container}>
      {/* Upload progress bar */}
      {uploading && (
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <div style={styles.progressText}>
            Uploading {attachments.length} file(s)... {progress}%
          </div>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div style={styles.errorBanner}>
          {uploadError}
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />
      )}

      {/* Input area */}
      <div style={styles.inputRow}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.gif,.pdf,.txt,.log,.zip,.doc,.docx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Attachment button */}
        <button
          onClick={handleAttachClick}
          disabled={disabled || uploading || attachments.length >= MAX_ATTACHMENTS}
          style={styles.attachButton}
          title="Attach file"
        >
          📎
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Type your message..."
          disabled={disabled || uploading}
          style={styles.textarea}
          rows={1}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || uploading || (!message.trim() && attachments.length === 0) || overLimit}
          style={styles.sendButton}
          title="Send message"
        >
          ✈️
        </button>
      </div>

      {/* Character counter */}
      {showCharCount && (
        <div style={{ ...styles.charCounter, color: overLimit ? '#ef4444' : '#6b7280' }}>
          {charCount} / {MAX_CHARS}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#ffffff'
  },
  progressContainer: {
    marginBottom: '8px'
  },
  progressBar: {
    width: '100%',
    height: '4px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px'
  },
  errorBanner: {
    padding: '8px 12px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '4px',
    fontSize: '14px',
    whiteSpace: 'pre-wrap'
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end'
  },
  attachButton: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    fontSize: '18px',
    flexShrink: 0,
    height: '40px',
    transition: 'all 0.2s'
  },
  textarea: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    minHeight: '40px',
    maxHeight: '150px',
    transition: 'border-color 0.2s'
  },
  sendButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '18px',
    flexShrink: 0,
    height: '40px',
    transition: 'all 0.2s'
  },
  charCounter: {
    fontSize: '12px',
    textAlign: 'right',
    marginTop: '-4px'
  }
};
