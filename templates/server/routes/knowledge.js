const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const { KnowledgeBase, Embedding } = require('../db/models');
const { extractText } = require('../utils/textExtractor');
const { chunkText } = require('../utils/chunker');
const { generateEmbeddingsForChunks, deleteEmbeddings } = require('../utils/embeddings');

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
        embeddingId: null // Will be populated by generateEmbeddingsForChunks
      })),
      uploadedBy: req.body.uploadedBy || null, // Optional for Phase 4
      uploadedAt: new Date(),
      active: true
    });

    // Generate embeddings for all chunks
    let embeddingCount = 0;
    try {
      embeddingCount = await generateEmbeddingsForChunks(
        knowledgeDoc._id,
        knowledgeDoc.chunks
      );
      console.log(`Generated ${embeddingCount} embeddings for ${knowledgeDoc.filename}`);
    } catch (error) {
      console.error('Embedding generation failed:', error.message);
      // Don't fail upload if embeddings fail - can retry later
      // But log warning for admin visibility
    }

    // Clean up uploaded file
    await fs.unlink(filePath);

    res.status(201).json({
      id: knowledgeDoc._id,
      filename: knowledgeDoc.filename,
      fileType: knowledgeDoc.fileType,
      fileSize: knowledgeDoc.fileSize,
      chunkCount: chunks.length,
      embeddingCount: embeddingCount || 0,
      uploadedAt: knowledgeDoc.uploadedAt,
      message: 'Document uploaded and processed'
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
 * POST /api/knowledge/import-url
 * Fetch a web page and add its content to the knowledge base
 */
router.post('/import-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    // Fetch the page
    const cheerio = require('cheerio');
    let response;
    try {
      response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      return res.status(400).json({ error: `Failed to fetch URL: ${err.message}` });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, nav, footer
    $('script, style, nav, footer, header, noscript, iframe').remove();

    // Extract text from main content areas
    const title = $('title').text().trim() || url;
    const bodyText = $('main, article, .content, .faq, #content, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    if (!bodyText || bodyText.length < 50) {
      return res.status(400).json({ error: 'Could not extract meaningful content from this URL' });
    }

    // Chunk and embed
    const rawChunks = chunkText(bodyText);
    // chunkText returns {text, index} objects
    const chunkObjs = rawChunks.map(c => typeof c === 'string' ? { text: c } : c);

    const kbEntry = await KnowledgeBase.create({
      filename: `url-import-${Date.now()}`,
      originalName: title.substring(0, 100),
      fileType: 'web-page',
      content: bodyText,
      chunks: chunkObjs.map(c => ({ text: c.text })),
      active: true
    });

    // generateEmbeddingsForChunks(knowledgeBaseId, chunks) — chunks need .text property
    // It also links embeddings back to KB doc automatically
    const embeddingCount = await generateEmbeddingsForChunks(kbEntry._id, chunkObjs);

    console.log(`[KB] Imported URL: ${title} (${chunkObjs.length} chunks, ${embeddingCount} embeddings)`);

    res.json({
      success: true,
      title,
      contentLength: bodyText.length,
      chunks: chunkObjs.length,
      embeddings: embeddingCount
    });
  } catch (error) {
    console.error('URL import error:', error);
    res.status(500).json({ error: `Failed to import URL: ${error.message}` });
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
 * PUT /api/knowledge/:id
 * Update document content, re-chunk and re-embed
 */
router.put('/:id', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const document = await KnowledgeBase.findById(req.params.id);
    if (!document || !document.active) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete old embeddings
    await deleteEmbeddings(document._id);

    // Re-chunk the new content
    const rawChunks = chunkText(content);
    const chunkObjs = rawChunks.map(c => typeof c === 'string' ? { text: c } : c);

    // Update document
    document.content = content;
    document.chunks = chunkObjs.map(c => ({ text: c.text }));
    await document.save();

    // Re-generate embeddings
    const embeddingCount = await generateEmbeddingsForChunks(document._id, chunkObjs);

    console.log(`[KB] Updated document ${document.originalName}: ${chunkObjs.length} chunks, ${embeddingCount} embeddings`);

    res.json({
      success: true,
      chunks: chunkObjs.length,
      embeddings: embeddingCount
    });
  } catch (error) {
    console.error('Update document error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    res.status(500).json({ error: 'Failed to update document' });
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

    // Delete all embeddings for this document
    await deleteEmbeddings(req.params.id);

    // Soft delete the document
    document.active = false;
    await document.save();

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

/**
 * POST /api/knowledge/push
 * Push a conversation snippet (question, answer, or both) directly into the knowledge base
 * This enables self-learning from agent conversations
 */
const { generateEmbedding } = require('../utils/embeddings');
const { authenticateAgent, requireRole } = require('../middleware/auth');

router.post('/push', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { question, answer, source } = req.body;

    if (!question && !answer) {
      return res.status(400).json({ error: 'At least question or answer is required' });
    }

    // Build the text to embed
    let text = '';
    if (question && answer) {
      text = `Q: ${question}\nA: ${answer}`;
    } else if (question) {
      text = question;
    } else {
      text = answer;
    }

    // Create a KB entry for tracking
    const kbEntry = await KnowledgeBase.create({
      filename: `chat-learning-${Date.now()}`,
      originalName: source || 'Chat Conversation',
      fileType: 'text/plain',
      fileSize: text.length,
      content: text,
      chunks: [{ text }],
      active: true
    });

    // Generate embedding and store
    const embedding = await generateEmbedding(text);
    if (embedding) {
      await Embedding.create({
        knowledgeBaseId: kbEntry._id,
        chunkIndex: 0,
        text: text,
        embedding: embedding,
        metadata: { source: 'chat-push', pushDate: new Date().toISOString() }
      });
    }

    console.log(`[Knowledge] Pushed conversation snippet to RAG (${text.length} chars)`);
    return res.status(201).json({ success: true, id: kbEntry._id, textLength: text.length });
  } catch (err) {
    console.error('[Knowledge] Push error:', err.message);
    return res.status(500).json({ error: 'Failed to push to knowledge base' });
  }
});

module.exports = router;
