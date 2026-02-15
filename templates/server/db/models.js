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
  ticketType: { type: String, enum: ['chat', 'bug', 'feature', 'question', 'support'], default: 'chat' },
  userPriority: { type: String, enum: ['low', 'medium', 'high'] },
  mood: { type: Number, min: 1, max: 5 },
  summary: String,
  metadata: mongoose.Schema.Types.Mixed, // Sentiment reasoning and other metadata
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  rating: Number,
  ratingComment: String,
  agentNotes: String
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_chats', required: true, index: true },
  sender: { type: String, enum: ['user', 'ai', 'agent'], required: true },
  senderName: String,
  content: { type: String, required: true },
  attachments: [new mongoose.Schema({
    filename: String,
    url: String,
    type: String,
    size: Number
  }, { _id: false })],
  metadata: mongoose.Schema.Types.Mixed, // AI confidence, sources, etc.
  isInternal: { type: Boolean, default: false }, // Agent notes
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

const agentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'supervisor', 'agent'], default: 'agent' }, // legacy compat
  systemRole: { type: String, enum: ['admin', 'manager', 'agent'], default: 'agent' },
  roles: [{ type: String }], // team/role names e.g. ['Support', 'PreSales']
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },
  status: { type: String, enum: ['online', 'offline', 'away'], default: 'offline' },
  avatar: String,
  specialties: [String], // Categories they handle
  office365Email: String, // Office 365 calendar email
  teamsEmail: String, // Microsoft Teams email
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
}, { timestamps: true });

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  icon: { type: String, default: '👥' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const inviteLinkSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents', required: true },
  defaultRoles: [String],
  defaultManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },
  maxUses: { type: Number, default: 0 }, // 0 = unlimited
  usedCount: { type: Number, default: 0 },
  expiresAt: Date,
  active: { type: Boolean, default: true },
  label: String
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
  usageCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const workflowCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String, default: '💬' },
  prompt: { type: String, required: true },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const responseCacheSchema = new mongoose.Schema({
  questionEmbedding: { type: [Number], required: true },
  question: { type: String, required: true },
  response: { type: String, required: true },
  confidence: Number,
  sources: [String],
  hitCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 604800 } // 7-day TTL
}, { timestamps: true });

const teamsConversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  conversationReference: { type: mongoose.Schema.Types.Mixed, required: true },
  teamsUserId: String,
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },
  threadId: String
}, { timestamps: true });

// Export models with aichatdesk_ collection names
const Chat = mongoose.model('aichatdesk_chats', chatSchema);
const Message = mongoose.model('aichatdesk_messages', messageSchema);
const Agent = mongoose.model('aichatdesk_agents', agentSchema);
const KnowledgeBase = mongoose.model('aichatdesk_knowledge_base', knowledgeBaseSchema);
const Embedding = mongoose.model('aichatdesk_embeddings', embeddingSchema);
const CannedResponse = mongoose.model('aichatdesk_canned_responses', cannedResponseSchema);
const WorkflowCategory = mongoose.model('aichatdesk_workflow_categories', workflowCategorySchema);
const ResponseCache = mongoose.model('aichatdesk_response_cache', responseCacheSchema);
const TeamsConversation = mongoose.model('aichatdesk_teams_conversations', teamsConversationSchema);
const Role = mongoose.model('aichatdesk_roles', roleSchema);
const InviteLink = mongoose.model('aichatdesk_invite_links', inviteLinkSchema);

module.exports = {
  Chat,
  Message,
  Agent,
  KnowledgeBase,
  Embedding,
  CannedResponse,
  WorkflowCategory,
  ResponseCache,
  TeamsConversation,
  Role,
  InviteLink
};
