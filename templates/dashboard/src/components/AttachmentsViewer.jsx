import React, { useState, useEffect } from 'react';

/**
 * AttachmentsViewer Component
 *
 * Displays all file attachments from a chat session:
 * - Grid view with image thumbnails
 * - File type icons for non-image files
 * - Click to preview full-size images in modal
 * - Download link for all files
 * - Metadata: sender, file size, upload time
 */
function AttachmentsViewer({ sessionId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setAttachments([]);
      return;
    }

    fetchAttachments();
  }, [sessionId]);

  const fetchAttachments = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/dashboard/chats/${sessionId}/attachments`);

      if (!response.ok) {
        throw new Error('Failed to load attachments');
      }

      const data = await response.json();
      setAttachments(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return '📎';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('text/')) return '📝';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📎';
  };

  const isImage = (mimeType) => {
    return mimeType && mimeType.startsWith('image/');
  };

  const openLightbox = (attachment) => {
    if (isImage(attachment.type)) {
      setLightboxImage(attachment);
    }
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Empty state
  if (!sessionId) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>📎</span>
          <p style={styles.emptyText}>Select a chat to view attachments</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Attachments</h3>
        </div>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Attachments</h3>
        </div>
        <div style={styles.error}>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.retryButton} onClick={fetchAttachments}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No attachments state
  if (attachments.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Attachments</h3>
        </div>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>📎</span>
          <p style={styles.emptyText}>No attachments</p>
        </div>
      </div>
    );
  }

  // Main content - grid view
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Attachments ({attachments.length})</h3>
      </div>

      <div style={styles.grid}>
        {attachments.map((attachment, index) => (
          <div key={index} style={styles.gridItem}>
            {/* Thumbnail or icon */}
            <div
              style={styles.thumbnail}
              onClick={() => openLightbox(attachment)}
            >
              {isImage(attachment.type) ? (
                <img
                  src={`${apiUrl}${attachment.url}`}
                  alt={attachment.filename}
                  style={styles.thumbnailImage}
                />
              ) : (
                <div style={styles.fileIcon}>
                  <span style={styles.fileIconEmoji}>
                    {getFileIcon(attachment.type)}
                  </span>
                  <span style={styles.fileExt}>
                    {attachment.filename.split('.').pop().toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* File info */}
            <div style={styles.fileInfo}>
              <p style={styles.filename} title={attachment.filename}>
                {attachment.filename}
              </p>
              <div style={styles.metadata}>
                <span style={styles.metadataItem}>
                  {formatFileSize(attachment.size)}
                </span>
                <span style={styles.metadataItem}>
                  {attachment.sender === 'user' ? '👤 User' : '🤖 Agent'}
                </span>
                <span style={styles.metadataItem}>
                  {formatTimeAgo(attachment.uploadedAt)}
                </span>
              </div>

              {/* Download link */}
              <a
                href={`${apiUrl}${attachment.url}`}
                download={attachment.filename}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.downloadLink}
              >
                ⬇ Download
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox for image preview */}
      {lightboxImage && (
        <div style={styles.lightbox} onClick={closeLightbox}>
          <div style={styles.lightboxContent}>
            <button style={styles.closeButton} onClick={closeLightbox}>
              ✕
            </button>
            <img
              src={`${apiUrl}${lightboxImage.url}`}
              alt={lightboxImage.filename}
              style={styles.lightboxImage}
            />
            <p style={styles.lightboxCaption}>{lightboxImage.filename}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline styles for component isolation
const styles = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    overflow: 'hidden'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f9f9f9'
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
    padding: '16px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  gridItem: {
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    overflow: 'hidden',
    transition: 'box-shadow 0.2s'
  },
  thumbnail: {
    width: '100%',
    height: '120px',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    overflow: 'hidden'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  fileIcon: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fileIconEmoji: {
    fontSize: '48px',
    marginBottom: '8px'
  },
  fileExt: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '600'
  },
  fileInfo: {
    padding: '8px'
  },
  filename: {
    margin: '0 0 6px 0',
    fontSize: '12px',
    fontWeight: '500',
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  metadata: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '8px'
  },
  metadataItem: {
    fontSize: '11px',
    color: '#777'
  },
  downloadLink: {
    display: 'inline-block',
    fontSize: '12px',
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: '500'
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '12px',
    opacity: 0.3
  },
  emptyText: {
    color: '#999',
    fontSize: '14px',
    margin: 0
  },
  loading: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#666'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #f0f0f0',
    borderTop: '3px solid #007bff',
    borderRadius: '50%',
    margin: '0 auto 12px',
    animation: 'spin 1s linear infinite'
  },
  error: {
    padding: '20px',
    textAlign: 'center'
  },
  errorText: {
    color: '#d9534f',
    marginBottom: '12px'
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  lightbox: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    cursor: 'pointer'
  },
  lightboxContent: {
    position: 'relative',
    maxWidth: '90%',
    maxHeight: '90%',
    cursor: 'default'
  },
  closeButton: {
    position: 'absolute',
    top: '-40px',
    right: '0',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '32px',
    cursor: 'pointer',
    padding: '0',
    width: '40px',
    height: '40px',
    lineHeight: '40px'
  },
  lightboxImage: {
    maxWidth: '100%',
    maxHeight: '80vh',
    display: 'block'
  },
  lightboxCaption: {
    color: '#fff',
    textAlign: 'center',
    marginTop: '12px',
    fontSize: '14px'
  }
};

export default AttachmentsViewer;
