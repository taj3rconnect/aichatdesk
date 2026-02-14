import { useState } from 'react';
import { validateFile } from '../utils/fileValidation';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

/**
 * Hook for file upload with progress tracking
 * @returns {Object} { uploadFiles, uploading, progress, error }
 */
export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  /**
   * Upload files to server with progress tracking
   * @param {File[]} files - Array of File objects to upload
   * @returns {Promise<Object>} { files: [...metadata] }
   */
  const uploadFiles = async (files) => {
    // Reset state
    setError(null);
    setProgress(0);

    // Validate all files before uploading
    const validationErrors = [];
    files.forEach((file, index) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        validationErrors.push(`${file.name}: ${validation.error}`);
      }
    });

    // If any files are invalid, reject immediately
    if (validationErrors.length > 0) {
      const errorMessage = `${validationErrors.length} file(s) rejected:\n${validationErrors.join('\n')}`;
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    // Create FormData and append files
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      };

      // Handle successful upload
      xhr.onload = () => {
        setUploading(false);

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            setProgress(100);
            resolve(response);
          } catch (parseError) {
            const errorMsg = 'Failed to parse server response';
            setError(errorMsg);
            reject(new Error(errorMsg));
          }
        } else {
          // Handle server errors (4xx, 5xx)
          let errorMsg = 'Upload failed';
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            errorMsg = errorResponse.message || errorResponse.error || errorMsg;
          } catch (e) {
            errorMsg = xhr.statusText || errorMsg;
          }
          setError(errorMsg);
          reject(new Error(errorMsg));
        }
      };

      // Handle network errors
      xhr.onerror = () => {
        setUploading(false);
        const errorMsg = 'Upload failed. Check your connection.';
        setError(errorMsg);
        reject(new Error(errorMsg));
      };

      // Handle upload abort
      xhr.onabort = () => {
        setUploading(false);
        const errorMsg = 'Upload cancelled';
        setError(errorMsg);
        reject(new Error(errorMsg));
      };

      // Send request
      setUploading(true);
      xhr.open('POST', `${API_URL}/api/upload`);
      xhr.send(formData);
    });
  };

  return {
    uploadFiles,
    uploading,
    progress,
    error
  };
}
