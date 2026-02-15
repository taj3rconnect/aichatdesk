/**
 * @file embeddings — OpenAI embedding generation for knowledge base chunks
 * @description Generates vector embeddings using OpenAI's text-embedding API for use in
 * semantic search (RAG). Supports single-text and batch embedding with rate-limit-aware
 * batching. Links generated embeddings back to their KnowledgeBase document chunks.
 * @module utils/embeddings
 */

const OpenAI = require('openai');
const { Embedding, KnowledgeBase } = require('../db/models');

// Default embedding model
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

// Lazy initialization of OpenAI client
let openai = null;
function getOpenAIClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for embedding generation');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

/**
 * Generate embedding vector for a single text string
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 1536-dimensional embedding vector
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Invalid text input: must be a non-empty string');
  }

  try {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding generation failed:', error.message);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for all chunks in a knowledge base document
 * @param {ObjectId} knowledgeBaseId - MongoDB document ID
 * @param {Array} chunks - Array of chunk objects [{text, index}]
 * @returns {Promise<number>} - Count of embeddings created
 */
async function generateEmbeddingsForChunks(knowledgeBaseId, chunks) {
  if (!chunks || chunks.length === 0) {
    console.warn('No chunks provided for embedding generation');
    return 0;
  }

  console.log(`Generating embeddings for ${chunks.length} chunks...`);

  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 100;
  let createdCount = 0;

  // Process chunks in batches to avoid rate limiting
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    try {
      // Generate embeddings for batch in parallel
      const embeddingPromises = batch.map(async (chunk, batchIndex) => {
        const chunkIndex = i + batchIndex;

        try {
          const embeddingVector = await generateEmbedding(chunk.text);

          // Create embedding document
          const embedding = await Embedding.create({
            knowledgeBaseId,
            chunkIndex,
            text: chunk.text,
            embedding: embeddingVector,
            metadata: {}
          });

          // Update KnowledgeBase document with embeddingId
          await KnowledgeBase.updateOne(
            { _id: knowledgeBaseId },
            { $set: { [`chunks.${chunkIndex}.embeddingId`]: embedding._id } }
          );

          return embedding._id;
        } catch (error) {
          console.error(`Failed to generate embedding for chunk ${chunkIndex}:`, error.message);
          throw error;
        }
      });

      const embeddingIds = await Promise.all(embeddingPromises);
      createdCount += embeddingIds.length;

      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Generated ${embeddingIds.length} embeddings`);

      // Delay between batches to respect rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    } catch (error) {
      console.error(`Batch processing failed at index ${i}:`, error.message);
      throw error;
    }
  }

  console.log(`Successfully generated ${createdCount} embeddings for knowledge base ${knowledgeBaseId}`);
  return createdCount;
}

/**
 * Delete all embeddings for a knowledge base document
 * @param {ObjectId} knowledgeBaseId - MongoDB document ID
 * @returns {Promise<number>} - Count of embeddings deleted
 */
async function deleteEmbeddings(knowledgeBaseId) {
  try {
    const result = await Embedding.deleteMany({ knowledgeBaseId });
    console.log(`Deleted ${result.deletedCount} embeddings for knowledge base ${knowledgeBaseId}`);
    return result.deletedCount;
  } catch (error) {
    console.error('Failed to delete embeddings:', error.message);
    throw error;
  }
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsForChunks,
  deleteEmbeddings
};
