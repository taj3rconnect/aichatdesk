/**
 * @file vectorSearch — Semantic search over knowledge base embeddings
 * @description Performs vector similarity search by embedding a query via OpenAI,
 * computing cosine similarity against all stored embeddings, and returning the
 * top-K results above a configurable similarity threshold. Used by the AI chat
 * pipeline to retrieve relevant knowledge base context (RAG).
 * @module utils/vectorSearch
 */

const { Embedding, KnowledgeBase } = require('../db/models');
const { generateEmbedding } = require('./embeddings');

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score between -1 and 1 (1 = identical, 0 = unrelated, -1 = opposite)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    throw new Error('Vectors must be arrays of equal length');
  }

  // Calculate dot product
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);

  // Calculate magnitudes
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  // Return cosine similarity
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Search knowledge base for relevant chunks using vector similarity
 * @param {string} query - Search query text
 * @param {object} options - Search options
 * @param {number} options.topK - Number of top results to return (default: 5)
 * @param {number} options.minSimilarity - Minimum similarity threshold (default: 0.3)
 * @returns {Promise<Array>} - Array of {text, similarity, filename, knowledgeBaseId, chunkIndex}
 */
async function searchKnowledgeBase(query, options = {}) {
  const { topK = 5, minSimilarity = 0.3 } = options;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('Query must be a non-empty string');
  }

  try {
    // Step 1: Generate embedding for query
    console.log(`Generating embedding for query: "${query.substring(0, 50)}..."`);
    const queryEmbedding = await generateEmbedding(query);

    // Step 2: Fetch all embeddings from MongoDB
    const allEmbeddings = await Embedding.find({}).lean();

    if (allEmbeddings.length === 0) {
      console.warn('Knowledge base is empty - no embeddings found');
      return [];
    }

    console.log(`Searching across ${allEmbeddings.length} embeddings...`);

    // Step 3: Calculate cosine similarity for each embedding
    const similarities = allEmbeddings.map(embedding => {
      const similarity = cosineSimilarity(queryEmbedding, embedding.embedding);
      return {
        text: embedding.text,
        similarity,
        knowledgeBaseId: embedding.knowledgeBaseId,
        chunkIndex: embedding.chunkIndex,
        metadata: embedding.metadata
      };
    });

    // Step 4: Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Step 5: Filter by minimum similarity threshold
    const filtered = similarities.filter(item => item.similarity >= minSimilarity);

    if (filtered.length === 0) {
      console.log(`No results above similarity threshold ${minSimilarity}`);
      return [];
    }

    // Step 6: Take top K results
    const topResults = filtered.slice(0, topK);

    // Step 7: Populate KnowledgeBase references to get filenames
    const resultsWithFilenames = await Promise.all(
      topResults.map(async result => {
        const knowledgeDoc = await KnowledgeBase.findById(result.knowledgeBaseId).lean();
        return {
          text: result.text,
          similarity: result.similarity,
          filename: knowledgeDoc ? knowledgeDoc.filename : 'Unknown',
          knowledgeBaseId: result.knowledgeBaseId,
          chunkIndex: result.chunkIndex,
          metadata: result.metadata
        };
      })
    );

    // Log search metrics
    const topSimilarity = resultsWithFilenames[0]?.similarity || 0;
    console.log(`Search complete: ${resultsWithFilenames.length} results, top similarity: ${topSimilarity.toFixed(3)}`);

    return resultsWithFilenames;
  } catch (error) {
    console.error('Vector search failed:', error.message);
    throw new Error(`Failed to search knowledge base: ${error.message}`);
  }
}

module.exports = {
  cosineSimilarity,
  searchKnowledgeBase
};
