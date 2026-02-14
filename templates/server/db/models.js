const mongoose = require('mongoose');

// All collection names use aichatdesk_ prefix

const chatSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  userId: String,
  userEmail: String,
  userName: String,
  status: { type: String, enum: ['active', 'waiting', 'closed'], default: 'active' },
  category: { type: String, enum: ['billing', 'technical', 'general', 'feature_request', 'bug_report'] },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },
  mode: { type: String, enum: ['ai', 'human'], default: 'ai' },
  summary: String,
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  rating: Number,
  ratingComment: String
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_chats', required: true, index: true },
  sender: { type: String, enum: ['user', 'ai', 'agent'], required: true },
  senderName: String,
  content: { type: String, required: true },
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number
  }],
  metadata: mongoose.Schema.Types.Mixed, // AI confidence, sources, etc.
  isInternal: { type: Boolean, default: false }, // Agent notes
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

const agentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'supervisor', 'agent'], default: 'agent' },
  status: { type: String, enum: ['online', 'offline', 'away'], default: 'offline' },
  avatar: String,
  specialties: [String], // Categories they handle
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
}, { timestamps: true });

const knowledgeBaseSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: String,
  fileType: String,
  fileSize: Number,
  content: String, // Extracted text
  chunks: [{
    text: String,
    embeddingId: mongoose.Schema.Types.ObjectId
  }],
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },
  uploadedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const embeddingSchema = new mongoose.Schema({
  knowledgeBaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_knowledge_base' },
  chunkIndex: Number,
  text: { type: String, required: true },
  embedding: { type: [Number], required: true }, // Vector array
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const cannedResponseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: String,
  shortcut: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },
  usageCount: { type: Number, default: 0 }
}, { timestamps: true });

// Export models with aichatdesk_ collection names
const Chat = mongoose.model('aichatdesk_chats', chatSchema);
const Message = mongoose.model('aichatdesk_messages', messageSchema);
const Agent = mongoose.model('aichatdesk_agents', agentSchema);
const KnowledgeBase = mongoose.model('aichatdesk_knowledge_base', knowledgeBaseSchema);
const Embedding = mongoose.model('aichatdesk_embeddings', embeddingSchema);
const CannedResponse = mongoose.model('aichatdesk_canned_responses', cannedResponseSchema);

module.exports = {
  Chat,
  Message,
  Agent,
  KnowledgeBase,
  Embedding,
  CannedResponse
};
