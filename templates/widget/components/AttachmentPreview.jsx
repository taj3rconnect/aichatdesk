import React from 'react';
import { isImage, getFileIcon, formatFileSize } from '../utils/fileValidation';

/**
 * Attachment preview grid component
 * @param {Object} props
 * @param {Array} props.attachments - Array of attachment metadata objects
 * @param {Function} props.onRemove - Callback when remove button clicked
 */
export default function AttachmentPreview({ attachments, onRemove }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {attachments.map((attachment, index) => (
          <AttachmentCard
            key={index}
            attachment={attachment}
            onRemove={() => onRemove(index)}
          />
        ))}
      </div>
    </div>
  );
}

function AttachmentCard({ attachment, onRemove }) {
  const { filename, originalName, url, type, size } = attachment;

  // Determine if this is an image for thumbnail display
  const showThumbnail = type.startsWith('image/');
  const icon = !showThumbnail ? getFileIcon({ type }) : null;

  return (
    <div style={styles.card}>
      {/* Remove button */}
      <button
        onClick={onRemove}
        style={styles.removeButton}
        title="Remove attachment"
      >
        ✕
      </button>

      {/* Preview area */}
      <div style={styles.preview}>
        {showThumbnail ? (
          <img
            src={url}
            alt={originalName}
            style={styles.thumbnail}
          />
        ) : (
          <div style={styles.iconContainer}>
            <span style={styles.icon}>{icon}</span>
          </div>
        )}
      </div>

      {/* File info */}
      <div style={styles.info}>
        <div style={styles.filename} title={originalName}>
          {originalName}
        </div>
        <div style={styles.filesize}>
          {formatFileSize(size)}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '8px 0',
    borderBottom: '1px solid #e5e7eb'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr'
    }
  },
  card: {
    position: 'relative',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '8px',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  removeButton: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#ffffff',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    transition: 'background-color 0.2s'
  },
  preview: {
    width: '100%',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: '4px',
    backgroundColor: '#ffffff'
  },
  thumbnail: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain'
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%'
  },
  icon: {
    fontSize: '48px'
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  filename: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#1f2937',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  filesize: {
    fontSize: '11px',
    color: '#6b7280'
  }
};
