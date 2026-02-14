import React, { useState } from 'react';

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: '600',
    color: '#333',
    cursor: 'pointer',
    userSelect: 'none'
  },
  thHover: {
    backgroundColor: '#ebebeb'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #e0e0e0',
    color: '#555'
  },
  fileIcon: {
    marginRight: '8px',
    fontSize: '16px'
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '13px',
    border: 'none',
    backgroundColor: '#f44336',
    color: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  deleteButtonHover: {
    backgroundColor: '#d32f2f'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  modal: {
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
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#333'
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  modalButton: {
    padding: '10px 20px',
    fontSize: '14px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
    color: '#333'
  },
  confirmButton: {
    backgroundColor: '#f44336',
    color: '#fff'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginTop: '20px'
  },
  pageButton: {
    padding: '8px 16px',
    fontSize: '14px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fff',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  pageButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  pageInfo: {
    fontSize: '14px',
    color: '#666'
  }
};

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getFileIcon(type) {
  if (!type) return '📁';
  if (type.includes('pdf')) return '📄';
  if (type.includes('text')) return '📝';
  if (type.includes('json')) return '📋';
  if (type.includes('csv')) return '📊';
  if (type.includes('html')) return '🌐';
  return '📁';
}

function getFileTypeLabel(mimeType) {
  if (!mimeType) return 'Unknown';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('plain')) return 'TXT';
  if (mimeType.includes('markdown')) return 'MD';
  if (mimeType.includes('wordprocessing')) return 'DOCX';
  if (mimeType.includes('json')) return 'JSON';
  if (mimeType.includes('csv')) return 'CSV';
  if (mimeType.includes('html')) return 'HTML';
  return mimeType.split('/')[1]?.toUpperCase() || 'Unknown';
}

function DocumentList({ documents, onDelete }) {
  const [sortBy, setSortBy] = useState('uploadedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [hoveredHeader, setHoveredHeader] = useState(null);

  const itemsPerPage = 20;

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const sortedDocuments = [...documents].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortBy === 'filename') {
      aVal = (aVal || '').toLowerCase();
      bVal = (bVal || '').toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDocuments = sortedDocuments.slice(startIndex, startIndex + itemsPerPage);

  const handleDeleteClick = (doc) => {
    setDeleteConfirm(doc);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || deleting) return;

    setDeleting(true);
    try {
      await onDelete(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      alert(`Failed to delete: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  if (documents.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📚</div>
        <div style={{ fontSize: '16px', marginBottom: '8px' }}>No documents uploaded yet</div>
        <div style={{ fontSize: '14px' }}>Upload your first document to get started</div>
      </div>
    );
  }

  return (
    <>
      <table style={styles.table}>
        <thead>
          <tr>
            <th
              style={{
                ...styles.th,
                ...(hoveredHeader === 'filename' ? styles.thHover : {})
              }}
              onClick={() => handleSort('filename')}
              onMouseEnter={() => setHoveredHeader('filename')}
              onMouseLeave={() => setHoveredHeader(null)}
            >
              Filename {sortBy === 'filename' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={styles.th}>Type</th>
            <th
              style={{
                ...styles.th,
                ...(hoveredHeader === 'fileSize' ? styles.thHover : {})
              }}
              onClick={() => handleSort('fileSize')}
              onMouseEnter={() => setHoveredHeader('fileSize')}
              onMouseLeave={() => setHoveredHeader(null)}
            >
              Size {sortBy === 'fileSize' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th
              style={{
                ...styles.th,
                ...(hoveredHeader === 'uploadedAt' ? styles.thHover : {})
              }}
              onClick={() => handleSort('uploadedAt')}
              onMouseEnter={() => setHoveredHeader('uploadedAt')}
              onMouseLeave={() => setHoveredHeader(null)}
            >
              Upload Date {sortBy === 'uploadedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={styles.th}>Chunks</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedDocuments.map(doc => (
            <tr key={doc.id}>
              <td style={styles.td}>
                <span style={styles.fileIcon}>{getFileIcon(doc.fileType)}</span>
                {doc.filename || doc.originalName || 'Unknown'}
              </td>
              <td style={styles.td}>{getFileTypeLabel(doc.fileType)}</td>
              <td style={styles.td}>{formatFileSize(doc.fileSize)}</td>
              <td style={styles.td}>{formatDate(doc.uploadedAt)}</td>
              <td style={styles.td}>{doc.chunkCount || 0}</td>
              <td style={styles.td}>
                <button
                  style={{
                    ...styles.deleteButton,
                    ...(hoveredButton === doc.id ? styles.deleteButtonHover : {})
                  }}
                  onClick={() => handleDeleteClick(doc)}
                  onMouseEnter={() => setHoveredButton(doc.id)}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={{
              ...styles.pageButton,
              ...(currentPage === 1 ? styles.pageButtonDisabled : {})
            }}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span style={styles.pageInfo}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            style={{
              ...styles.pageButton,
              ...(currentPage === totalPages ? styles.pageButtonDisabled : {})
            }}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {deleteConfirm && (
        <div style={styles.modal} onClick={handleDeleteCancel}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Delete Document</h3>
            <p>
              Are you sure you want to delete <strong>{deleteConfirm.filename}</strong>?
              This will remove it from the knowledge base.
            </p>
            <div style={styles.modalButtons}>
              <button
                style={{ ...styles.modalButton, ...styles.cancelButton }}
                onClick={handleDeleteCancel}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.modalButton, ...styles.confirmButton }}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DocumentList;
