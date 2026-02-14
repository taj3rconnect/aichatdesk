/**
 * Chunk text into semantic segments with overlap for RAG
 * @param {string} text - Text to chunk
 * @param {object} options - Chunking options
 * @param {number} options.maxChunkSize - Maximum characters per chunk
 * @param {number} options.overlap - Characters to overlap between chunks
 * @returns {Array<{text: string, index: number}>} Array of indexed chunks
 */
function chunkText(text, options = {}) {
  const { maxChunkSize = 1000, overlap = 200 } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks = [];
  let currentIndex = 0;

  // Split by double newlines (paragraph boundaries) first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    // If paragraph fits in current chunk, add it
    if (currentChunk.length + trimmedParagraph.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    } else {
      // Save current chunk if not empty
      if (currentChunk) {
        chunks.push({
          text: currentChunk,
          index: currentIndex++
        });

        // Add overlap to next chunk
        currentChunk = getOverlapText(currentChunk, overlap) + '\n\n' + trimmedParagraph;
      } else {
        // Paragraph itself is too large, need to split it
        const splitChunks = splitLargeParagraph(trimmedParagraph, maxChunkSize, overlap);
        for (const chunk of splitChunks) {
          chunks.push({
            text: chunk,
            index: currentIndex++
          });
        }
        currentChunk = '';
      }
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk,
      index: currentIndex++
    });
  }

  return chunks;
}

/**
 * Split large paragraph into smaller chunks
 * @param {string} paragraph - Large paragraph text
 * @param {number} maxChunkSize - Maximum chunk size
 * @param {number} overlap - Overlap size
 * @returns {Array<string>} Array of chunk texts
 */
function splitLargeParagraph(paragraph, maxChunkSize, overlap) {
  const chunks = [];

  // Try splitting by sentences first
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = getOverlapText(currentChunk, overlap) + ' ' + sentence;
      } else {
        // Single sentence is too large, split by words
        const wordChunks = splitByWords(sentence, maxChunkSize, overlap);
        chunks.push(...wordChunks.slice(0, -1));
        currentChunk = wordChunks[wordChunks.length - 1];
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Split text by word boundaries when sentences are too large
 * @param {string} text - Text to split
 * @param {number} maxChunkSize - Maximum chunk size
 * @param {number} overlap - Overlap size
 * @returns {Array<string>} Array of chunk texts
 */
function splitByWords(text, maxChunkSize, overlap) {
  const chunks = [];
  const words = text.split(/\s+/);
  let currentChunk = '';

  for (const word of words) {
    if (currentChunk.length + word.length + 1 <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = getOverlapText(currentChunk, overlap) + ' ' + word;
      } else {
        // Single word is larger than maxChunkSize, truncate it
        chunks.push(word.substring(0, maxChunkSize));
        currentChunk = '';
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Get last N characters from text for overlap
 * @param {string} text - Source text
 * @param {number} overlapSize - Number of characters to take
 * @returns {string} Overlap text
 */
function getOverlapText(text, overlapSize) {
  if (!text || overlapSize <= 0) return '';

  const overlap = text.slice(-overlapSize).trim();

  // Try to start at a word boundary
  const firstSpace = overlap.indexOf(' ');
  if (firstSpace > 0 && firstSpace < overlap.length / 2) {
    return overlap.slice(firstSpace + 1);
  }

  return overlap;
}

module.exports = { chunkText };
