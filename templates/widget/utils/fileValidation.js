// Client-side file validation utility

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Allowed MIME types (must match server)
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/x-log',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/**
 * Validate file size and type
 * @param {File} file - File object to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateFile(file) {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File too large (max 10MB)'
    };
  }

  // Check MIME type
  const mimeType = file.type.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: 'File type not supported'
    };
  }

  return { valid: true };
}

/**
 * Get icon/emoji for file based on type
 * @param {File} file - File object
 * @returns {string} Icon emoji
 */
export function getFileIcon(file) {
  const type = file.type.toLowerCase();

  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📄';
  if (type.includes('word') || type === 'text/plain') return '📝';
  if (type.includes('zip')) return '📦';

  return '📎'; // Default
}

/**
 * Check if file is an image (for thumbnail preview)
 * @param {File} file - File object
 * @returns {boolean} True if image
 */
export function isImage(file) {
  return file.type.startsWith('image/');
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "2.3 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
