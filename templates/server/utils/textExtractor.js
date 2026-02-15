/**
 * @file textExtractor — Multi-format text extraction for knowledge base ingestion
 * @description Extracts plain text from uploaded files in various formats: PDF, TXT, Markdown,
 * DOCX, JSON, CSV, and HTML. Normalizes whitespace and removes markup. Used during
 * knowledge base document upload before chunking and embedding.
 * @module utils/textExtractor
 */

const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const csvParser = require('csv-parser');
const cheerio = require('cheerio');
const { createReadStream } = require('fs');

/**
 * Extract text from various file formats
 * @param {string} filePath - Path to the file
 * @param {string} fileType - MIME type or extension
 * @returns {Promise<string>} Extracted text content
 */
async function extractText(filePath, fileType) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = fileType?.toLowerCase() || '';

  try {
    // PDF files
    if (ext === '.pdf' || mimeType.includes('pdf')) {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      return cleanText(data.text);
    }

    // Plain text and Markdown
    if (ext === '.txt' || ext === '.md' || mimeType.includes('text/plain') || mimeType.includes('text/markdown')) {
      const content = await fs.readFile(filePath, 'utf-8');
      return cleanText(content);
    }

    // DOCX files
    if (ext === '.docx' || mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
      const result = await mammoth.extractRawText({ path: filePath });
      return cleanText(result.value);
    }

    // JSON files
    if (ext === '.json' || mimeType.includes('json')) {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      // Pretty print for better readability
      return cleanText(JSON.stringify(data, null, 2));
    }

    // CSV files
    if (ext === '.csv' || mimeType.includes('csv')) {
      return await parseCSV(filePath);
    }

    // HTML files
    if (ext === '.html' || ext === '.htm' || mimeType.includes('html')) {
      const content = await fs.readFile(filePath, 'utf-8');
      const $ = cheerio.load(content);
      // Remove script and style tags
      $('script, style').remove();
      // Extract text content
      const text = $('body').text() || $.text();
      return cleanText(text);
    }

    throw new Error(`Unsupported file type: ${ext || mimeType}. Supported formats: PDF, TXT, MD, DOCX, JSON, CSV, HTML`);
  } catch (error) {
    if (error.message.includes('Unsupported file type')) {
      throw error;
    }
    throw new Error(`Failed to extract text from ${ext || mimeType}: ${error.message}`);
  }
}

/**
 * Parse CSV file and convert to readable text format
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<string>} CSV content as formatted text
 */
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        // Convert rows to readable format
        const lines = rows.map(row => {
          return Object.entries(row)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        });
        resolve(cleanText(lines.join('\n')));
      })
      .on('error', (error) => reject(new Error(`Failed to parse CSV: ${error.message}`)));
  });
}

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return '';

  return text
    .trim()
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines (more than 2 consecutive)
    .replace(/\n{3,}/g, '\n\n')
    // Normalize spaces
    .replace(/[ \t]+/g, ' ');
}

module.exports = { extractText };
