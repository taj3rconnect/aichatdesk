import React, { useState, useRef } from 'react';

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/json',
  'text/csv',
  'text/html'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const styles = {
  dropZone: {
    border: '2px dashed #ccc',
    borderRadius: '8px',
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s',
    backgroundColor: '#fafafa'
  },
  dropZoneActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0'
  },
  dropZoneText: {
    color: '#666',
    fontSize: '16px',
    marginBottom: '8px'
  },
  dropZoneHint: {
    color: '#999',
    fontSize: '13px'
  },
  fileList: {
    marginTop: '20px'
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    marginBottom: '8px'
  },
  fileInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  fileIcon: {
    fontSize: '24px'
  },
  fileName: {
    fontWeight: '500',
    color: '#333'
  },
  fileSize: {
    fontSize: '13px',
    color: '#666'
  },
  fileError: {
    color: '#c33',
    fontSize: '13px',
    marginTop: '4px'
  },
  progressBar: {
    width: '100%',
    height: '4px',
    backgroundColor: '#e0e0e0',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s'
  },
  removeButton: {
    padding: '6px 12px',
    fontSize: '13px',
    border: 'none',
    backgroundColor: '#f44336',
    color: '#fff',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(type) {
  if (type.includes('pdf')) return '📄';
  if (type.includes('text')) return '📝';
  if (type.includes('json')) return '📋';
  if (type.includes('csv')) return '📊';
  if (type.includes('html')) return '🌐';
  return '📁';
}

function DocumentUploader({ onUploadComplete }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Unsupported file type. Supported: PDF, TXT, MD, DOCX, JSON, CSV, HTML';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    return null;
  };

  const addFiles = (newFiles) => {
    const fileArray = Array.from(newFiles).map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      error: validateFile(file),
      uploading: false,
      completed: false
    }));

    setFiles(prev => [...prev, ...fileArray]);

    // Auto-upload valid files
    fileArray.forEach(fileObj => {
      if (!fileObj.error) {
        uploadFile(fileObj);
      }
    });
  };

  const uploadFile = async (fileObj) => {
    setFiles(prev => prev.map(f =>
      f.id === fileObj.id ? { ...f, uploading: true } : f
    ));

    const formData = new FormData();
    formData.append('file', fileObj.file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setFiles(prev => prev.map(f =>
            f.id === fileObj.id ? { ...f, progress } : f
          ));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          setFiles(prev => prev.map(f =>
            f.id === fileObj.id ? { ...f, completed: true, uploading: false, progress: 100 } : f
          ));

          // Remove completed file after 2 seconds
          setTimeout(() => {
            setFiles(prev => prev.filter(f => f.id !== fileObj.id));
          }, 2000);

          if (onUploadComplete) {
            onUploadComplete();
          }
        } else {
          const response = JSON.parse(xhr.responseText);
          setFiles(prev => prev.map(f =>
            f.id === fileObj.id
              ? { ...f, error: response.error || 'Upload failed', uploading: false }
              : f
          ));
        }
      });

      xhr.addEventListener('error', () => {
        setFiles(prev => prev.map(f =>
          f.id === fileObj.id
            ? { ...f, error: 'Network error', uploading: false }
            : f
        ));
      });

      xhr.open('POST', '/api/knowledge/upload');
      xhr.send(formData);
    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.id === fileObj.id
          ? { ...f, error: error.message, uploading: false }
          : f
      ));
    }
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  return (
    <div>
      <div
        style={{
          ...styles.dropZone,
          ...(isDragging ? styles.dropZoneActive : {})
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div style={styles.dropZoneText}>
          📤 Drop files here or click to browse
        </div>
        <div style={styles.dropZoneHint}>
          Supported formats: PDF, TXT, MD, DOCX, JSON, CSV, HTML (max 10MB)
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx,.json,.csv,.html,.htm"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {files.length > 0 && (
        <div style={styles.fileList}>
          {files.map(fileObj => (
            <div key={fileObj.id} style={styles.fileItem}>
              <div style={styles.fileInfo}>
                <span style={styles.fileIcon}>{getFileIcon(fileObj.file.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={styles.fileName}>{fileObj.file.name}</div>
                  <div style={styles.fileSize}>{formatFileSize(fileObj.file.size)}</div>
                  {fileObj.error && (
                    <div style={styles.fileError}>{fileObj.error}</div>
                  )}
                  {fileObj.uploading && (
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: `${fileObj.progress}%` }} />
                    </div>
                  )}
                  {fileObj.completed && (
                    <div style={{ color: '#4CAF50', fontSize: '13px', marginTop: '4px' }}>
                      ✓ Upload complete
                    </div>
                  )}
                </div>
              </div>
              {!fileObj.completed && !fileObj.uploading && (
                <button
                  style={styles.removeButton}
                  onClick={() => removeFile(fileObj.id)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentUploader;
