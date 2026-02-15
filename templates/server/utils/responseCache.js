const { ResponseCache } = require('../db/models');
const { generateEmbedding } = require('./embeddings');
const { cosineSimilarity } = require('./vectorSearch');

const CACHE_SIMILARITY_THRESHOLD = 0.75;
const MAX_CACHE_ENTRIES = 500;

/**
 * Find a cached response for a question using semantic similarity
 * @param {string} questionText - The user's question
 * @returns {Promise<object|null>} - Cached response or null
 */
async function findCachedResponse(questionText) {
  try {
    const questionEmbedding = await generateEmbedding(questionText);

    // Load recent cache entries
    const cacheEntries = await ResponseCache.find({})
      .sort({ createdAt: -1 })
      .limit(MAX_CACHE_ENTRIES)
      .lean();

    if (cacheEntries.length === 0) return null;

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const entry of cacheEntries) {
      const similarity = cosineSimilarity(questionEmbedding, entry.questionEmbedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    if (bestSimilarity >= CACHE_SIMILARITY_THRESHOLD && bestMatch) {
      // Increment hit count
      await ResponseCache.findByIdAndUpdate(bestMatch._id, { $inc: { hitCount: 1 } });
      console.log(`[Cache] HIT (${bestSimilarity.toFixed(3)}) for: "${questionText.substring(0, 50)}..."`);
      return {
        response: bestMatch.response,
        confidence: bestMatch.confidence,
        sources: bestMatch.sources,
        similarity: bestSimilarity,
        cached: true
      };
    }

    console.log(`[Cache] MISS (best: ${bestSimilarity.toFixed(3)}) for: "${questionText.substring(0, 50)}..."`);
    return null;
  } catch (error) {
    console.error('[Cache] Lookup error:', error.message);
    return null; // Fail silently — fall through to normal flow
  }
}

/**
 * Store a response in the cache
 * @param {string} question - The original question
 * @param {number[]} embedding - Pre-computed embedding (or null to generate)
 * @param {string} response - The AI response
 * @param {number} confidence - Confidence score
 * @param {string[]} sources - Source filenames
 */
async function cacheResponse(question, embedding, response, confidence, sources) {
  try {
    const questionEmbedding = embedding || await generateEmbedding(question);
    await ResponseCache.create({
      questionEmbedding,
      question,
      response,
      confidence,
      sources: sources || []
    });
    console.log(`[Cache] Stored response for: "${question.substring(0, 50)}..."`);
  } catch (error) {
    console.error('[Cache] Store error:', error.message);
    // Fail silently
  }
}

module.exports = { findCachedResponse, cacheResponse };
