import React, { useState, useRef } from 'react';

const MAX_ATTACHMENTS = 5;

/**
 * Drag-and-drop wrapper for file uploads
 * @param {Object} props
 * @param {ReactNode} props.children - Children to wrap
 * @param {Function} props.onFilesDropped - Callback when files are dropped
 * @param {number} props.currentAttachmentCount - Current number of attachments
 */
export default function FileDropZone({ children, onFilesDropped, currentAttachmentCount = 0 }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current++;

    // Only show drop zone if we have available slots
    if (currentAttachmentCount < MAX_ATTACHMENTS) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);
    dragCounterRef.current = 0;

    // Check if we can accept more files
    if (currentAttachmentCount >= MAX_ATTACHMENTS) {
      alert(`Maximum ${MAX_ATTACHMENTS} attachments allowed per message`);
      return;
    }

    // Extract files from dataTransfer
    const files = Array.from(e.dataTransfer.files || []);

    if (files.length > 0) {
      onFilesDropped(files);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={styles.container}
    >
      {children}

      {/* Drop overlay */}
      {isDragging && (
        <div style={styles.overlay}>
          <div style={styles.overlayContent}>
            <div style={styles.dropIcon}>📁</div>
            <div style={styles.dropText}>Drop files here</div>
            <div style={styles.dropSubtext}>
              {MAX_ATTACHMENTS - currentAttachmentCount} slot(s) available
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '2px dashed #3b82f6',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    pointerEvents: 'none'
  },
  overlayContent: {
    textAlign: 'center'
  },
  dropIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  dropText: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: '8px'
  },
  dropSubtext: {
    fontSize: '14px',
    color: '#6b7280'
  }
};
