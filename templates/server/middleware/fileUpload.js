/**
 * @file fileUpload.js — Secure file upload middleware using multer
 * @description Handles multipart file uploads with security validation:
 *   - Dual validation: both MIME type AND file extension must match the allowlist
 *   - Allowed types: images (png, jpg, jpeg, gif), documents (pdf, doc, docx, txt, log), archives (zip)
 *   - File size limit: 10MB per file
 *   - Max files per request: 5
 *   - Filename sanitization: strips path traversal chars, prepends timestamp for uniqueness
 *   - Storage: disk-based in /uploads directory (auto-created on startup)
 * @requires multer
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists on module load
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Allowed MIME types and extensions for security
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/x-log',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
];

const ALLOWED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif',
  '.pdf', '.txt', '.log',
  '.zip', '.doc', '.docx'
];

// Configure multer disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename: remove path traversal and special chars
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Add timestamp to prevent collisions
    const filename = `${Date.now()}-${sanitized}`;
    cb(null, filename);
  }
});

// File filter for type and extension validation
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  // Check both MIME type AND extension for security
  const validMime = ALLOWED_MIME_TYPES.includes(mimeType);
  const validExt = ALLOWED_EXTENSIONS.includes(ext);

  if (validMime && validExt) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5 // Max 5 files per request
  }
});

module.exports = upload;
