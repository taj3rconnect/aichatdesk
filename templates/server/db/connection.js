/**
 * @file connection.js — MongoDB connection manager
 * @description Establishes and manages the Mongoose connection to MongoDB. All AIChatDesk
 *   collections use the 'aichatdesk_' prefix to avoid conflicts when sharing a database
 *   with other applications. Includes graceful shutdown on SIGINT.
 * @requires mongoose
 */
const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the MONGODB_URI environment variable.
 * Logs discovered aichatdesk_* collections on successful connection.
 * @returns {Promise<void>}
 * @throws {Error} If MONGODB_URI is not set or connection fails
 */
async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(uri, {
      // Connection options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('MongoDB connected:', mongoose.connection.name);

    // List existing aichatdesk_ collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const aiChatDeskCollections = collections
      .map(c => c.name)
      .filter(name => name.startsWith('aichatdesk_'));

    console.log('AIChatDesk collections:', aiChatDeskCollections.length > 0 ? aiChatDeskCollections.join(', ') : 'none (will be created on first use)');

  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

module.exports = { connectDB };
