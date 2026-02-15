/**
 * @file Upload Routes — Secure file upload for chat attachments
 * @description Handles file uploads from the chat widget with multi-layer security:
 *
 *   Security validation:
 *     1. MIME type checking via multer fileFilter (middleware/fileUpload)
 *        Allowed: PNG, JPG, GIF, PDF, TXT, LOG, ZIP, DOC, DOCX
 *     2. Blocked extension check (server-side, post-upload):
 *        Rejects executables (.exe, .bat, .cmd, .ps1, .sh, etc.)
 *     3. File size limit: 10MB per file (configurable in multer middleware)
 *     4. File count limit: Max 5 files per request
 *
 *   Metadata extraction: Each uploaded file returns filename, originalName,
 *   public URL (/uploads/filename), MIME type, and size in bytes.
 *
 *   Audit logging: All uploads are logged with client IP, timestamp,
 *   file count, and per-file details (name, type, size).
 *
 * @requires ../middleware/fileUpload - Multer configuration with MIME type filtering
 */

const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload');

/** Blocked file extensions — executable and script formats rejected for security */
const BLOCKED_EXTENSIONS = [
  '.exe', '.com', '.bat', '.cmd', '.scr', '.pif', '.msi',
  '.vbs', '.js', '.ws', '.wsf', '.ps1', '.sh', '.cpl', '.inf', '.reg'
];

/**
 * POST /api/upload
 * Upload up to 5 files with security validation. Returns file metadata array.
 * Files are stored in /uploads/ directory with generated filenames.
 * @param {File[]} req.files - Multipart file uploads (field name: 'files')
 */
router.post('/', upload.array('files', 5), (req, res) => {
  try {
    // Validate files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        message: 'Please select at least one file to upload'
      });
    }

    // Check for blocked file extensions
    for (const file of req.files) {
      const ext = '.' + file.originalname.split('.').pop().toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({
          error: 'Blocked file type',
          message: `File type "${ext}" is not allowed for security reasons`,
          blockedFile: file.originalname
        });
      }
    }

    // Get client IP for security audit
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Log upload for security audit
    console.log(`[UPLOAD] ${new Date().toISOString()} - IP: ${clientIp} - Files: ${req.files.length}`);
    req.files.forEach(file => {
      console.log(`  - ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
    });

    // Build file metadata array
    const fileMetadata = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      url: `/uploads/${file.filename}`, // Public URL for download
      type: file.mimetype,
      size: file.size
    }));

    // Return file metadata to client
    res.status(200).json({
      success: true,
      files: fileMetadata,
      message: `${fileMetadata.length} file(s) uploaded successfully`
    });

  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message || 'An error occurred while uploading files'
    });
  }
});

/** Express error handler for multer-specific upload errors (size, count, type) */
router.use((err, req, res, next) => {
  if (err) {
    // Handle specific multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'Maximum file size is 10MB',
        maxSize: '10MB'
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Maximum 5 files allowed per upload',
        maxFiles: 5
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(415).json({
        error: 'Invalid file type',
        message: err.message || 'File type not supported'
      });
    }

    // File type validation error from fileFilter
    if (err.message && err.message.includes('File type not supported')) {
      return res.status(415).json({
        error: 'Invalid file type',
        message: err.message,
        allowedTypes: 'PNG, JPG, JPEG, GIF, PDF, TXT, LOG, ZIP, DOC, DOCX'
      });
    }

    // Generic upload error
    return res.status(500).json({
      error: 'Upload failed',
      message: err.message || 'An error occurred during file upload'
    });
  }

  next();
});

module.exports = router;
