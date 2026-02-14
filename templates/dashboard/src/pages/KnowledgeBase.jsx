import React, { useState, useEffect } from 'react';
import DocumentUploader from '../components/DocumentUploader';
import DocumentList from '../components/DocumentList';

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#333',
    margin: 0
  },
  count: {
    fontSize: '14px',
    color: '#666',
    marginTop: '4px'
  },
  error: {
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '6px',
    padding: '12px 16px',
    marginBottom: '20px',
    color: '#c33'
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '16px'
  }
};

function KnowledgeBase() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = async () => {
    try {
      setError(null);
      const response = await fetch('/api/knowledge');

      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }

      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      console.error('Fetch documents error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadComplete = () => {
    fetchDocuments();
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Remove from local state
      setDocuments(docs => docs.filter(doc => doc.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      throw err; // Re-throw for DocumentList to handle
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Knowledge Base</h1>
          <div style={styles.count}>
            {loading ? 'Loading...' : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'}`}
          </div>
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Upload Documents</h2>
        <DocumentUploader onUploadComplete={handleUploadComplete} />
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Documents</h2>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Loading documents...
          </div>
        ) : (
          <DocumentList documents={documents} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}

export default KnowledgeBase;
