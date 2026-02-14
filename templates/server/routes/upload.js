const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload');

// POST /api/upload - File upload endpoint with validation and storage
router.post('/', upload.array('files', 5), (req, res) => {
  try {
    // Validate files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        message: 'Please select at least one file to upload'
      });
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

// Error handler for multer errors
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
