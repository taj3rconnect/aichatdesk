const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const { KnowledgeBase, Embedding } = require('../db/models');
const { extractText } = require('../utils/textExtractor');
const { chunkText } = require('../utils/chunker');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  }
});

// Allowed file types
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx', '.json', '.csv', '.html', '.htm'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/json',
  'text/csv',
  'text/html'
];

/**
 * POST /api/knowledge/upload
 * Upload and process FAQ document
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, mimetype, size, path: filePath } = req.file;
    const ext = originalname.substring(originalname.lastIndexOf('.')).toLowerCase();

    // Validate file type
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME_TYPES.includes(mimetype)) {
      await fs.unlink(filePath); // Clean up uploaded file
      return res.status(400).json({
        error: `Unsupported file type: ${ext}. Supported formats: PDF, TXT, MD, DOCX, JSON, CSV, HTML`
      });
    }

    // Extract text from uploaded file
    let extractedText;
    try {
      extractedText = await extractText(filePath, mimetype);
    } catch (error) {
      await fs.unlink(filePath);
      return res.status(500).json({
        error: `Failed to extract text: ${error.message}`
      });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      await fs.unlink(filePath);
      return res.status(400).json({
        error: 'No text content found in file'
      });
    }

    // Chunk the extracted text
    const chunks = chunkText(extractedText, {
      maxChunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '200')
    });

    if (chunks.length === 0) {
      await fs.unlink(filePath);
      return res.status(400).json({
        error: 'No valid chunks created from file content'
      });
    }

    // Create knowledge base document
    const knowledgeDoc = await KnowledgeBase.create({
      filename: originalname,
      originalName: originalname,
      fileType: mimetype,
      fileSize: size,
      content: extractedText,
      chunks: chunks.map(chunk => ({
        text: chunk.text,
        embeddingId: null // Will be populated in Phase 2.2
      })),
      uploadedBy: req.body.uploadedBy || null, // Optional for Phase 4
      uploadedAt: new Date(),
      active: true
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

    res.status(201).json({
      id: knowledgeDoc._id,
      filename: knowledgeDoc.filename,
      fileType: knowledgeDoc.fileType,
      fileSize: knowledgeDoc.fileSize,
      chunkCount: chunks.length,
      uploadedAt: knowledgeDoc.uploadedAt,
      message: 'File uploaded and processed successfully'
    });
  } catch (error) {
    // Clean up file on error
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        // Ignore unlink errors
      }
    }

    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to process file upload',
      details: error.message
    });
  }
});

/**
 * GET /api/knowledge
 * List all knowledge base documents
 */
router.get('/', async (req, res) => {
  try {
    const documents = await KnowledgeBase.find({ active: true })
      .select('_id filename originalName fileType fileSize uploadedAt chunks')
      .sort({ uploadedAt: -1 });

    const response = documents.map(doc => ({
      id: doc._id,
      filename: doc.filename,
      originalName: doc.originalName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      uploadedAt: doc.uploadedAt,
      chunkCount: doc.chunks?.length || 0
    }));

    res.json(response);
  } catch (error) {
    console.error('List knowledge base error:', error);
    res.status(500).json({
      error: 'Failed to retrieve knowledge base documents',
      details: error.message
    });
  }
});

/**
 * GET /api/knowledge/:id
 * Get single document details
 */
router.get('/:id', async (req, res) => {
  try {
    const document = await KnowledgeBase.findById(req.params.id);

    if (!document || !document.active) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      id: document._id,
      filename: document.filename,
      originalName: document.originalName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      content: document.content,
      chunks: document.chunks,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedBy
    });
  } catch (error) {
    console.error('Get document error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    res.status(500).json({
      error: 'Failed to retrieve document',
      details: error.message
    });
  }
});

/**
 * DELETE /api/knowledge/:id
 * Soft-delete document and clean up embeddings
 */
router.delete('/:id', async (req, res) => {
  try {
    const document = await KnowledgeBase.findById(req.params.id);

    if (!document || !document.active) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Soft delete the document
    document.active = false;
    await document.save();

    // Delete related embeddings
    await Embedding.deleteMany({ knowledgeBaseId: req.params.id });

    res.status(204).send();
  } catch (error) {
    console.error('Delete document error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    res.status(500).json({
      error: 'Failed to delete document',
      details: error.message
    });
  }
});

module.exports = router;
