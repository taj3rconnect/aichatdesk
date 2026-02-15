/**
 * @file models.js — Mongoose schema definitions for all AIChatDesk collections
 * @description Defines 12 models: Chat, Message, Agent, Role, InviteLink, KnowledgeBase,
 *   Embedding, CannedResponse, WorkflowCategory, ResponseCache, TeamsConversation, Setting.
 *   All collections are prefixed with 'aichatdesk_' to namespace within shared databases.
 * @requires mongoose
 */
const mongoose = require('mongoose');

// ============================================================
// Chat — Represents a single chat session between a user and AI/agent
// ============================================================
const chatSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },       // Unique browser session identifier
  userId: String,                                                  // External user ID (if authenticated)
  userEmail: String,                                               // User's email (captured from pre-chat form)
  userName: String,                                                // User's display name
  status: { type: String, enum: ['active', 'waiting', 'closed'], default: 'active' }, // active = in progress, waiting = queued for agent, closed = ended
  category: { type: String, enum: ['billing', 'technical', 'general', 'feature_request', 'bug_report'] }, // AI-classified or agent-assigned topic
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },    // System-determined priority (from sentiment analysis)
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },             // Latest AI sentiment analysis result
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },  // Human agent assigned to this chat (null = AI-only)
  mode: { type: String, enum: ['ai', 'human'], default: 'ai' },   // ai = AI responding, human = live agent took over
  ticketType: { type: String, enum: ['chat', 'bug', 'feature', 'question', 'support'], default: 'chat' }, // User-selected ticket classification
  userPriority: { type: String, enum: ['low', 'medium', 'high'] }, // User self-reported priority (from pre-chat form)
  mood: { type: Number, min: 1, max: 5 },                         // AI-detected user mood score (1=frustrated, 5=happy)
  summary: String,                                                 // AI-generated chat summary
  metadata: mongoose.Schema.Types.Mixed,                           // Flexible field: sentiment reasoning, escalation details, etc.
  startedAt: { type: Date, default: Date.now },                    // When chat was created
  endedAt: Date,                                                   // When chat was closed (null if active)
  rating: Number,                                                  // Post-chat user rating (1-5)
  ratingComment: String,                                           // Optional user feedback comment
  agentNotes: String                                               // Private notes from assigned agent
}, { timestamps: true });

// ============================================================
// Message — Individual message within a chat session
// ============================================================
const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_chats', required: true, index: true }, // Parent chat reference
  sender: { type: String, enum: ['user', 'ai', 'agent'], required: true }, // Who sent: end user, AI bot, or human agent
  senderName: String,                                              // Display name of sender
  content: { type: String, required: true },                       // Message text content
  attachments: [new mongoose.Schema({                              // File attachments (images, docs, etc.)
    filename: String,                                              // Sanitized filename on disk
    url: String,                                                   // Public URL path to file
    type: String,                                                  // MIME type
    size: Number                                                   // File size in bytes
  }, { _id: false })],
  metadata: mongoose.Schema.Types.Mixed,                           // AI response metadata: confidence score, KB sources used, etc.
  isInternal: { type: Boolean, default: false },                   // True = internal agent note (hidden from user)
  sentAt: { type: Date, default: Date.now }                        // Message timestamp
}, { timestamps: true });

// ============================================================
// Agent — Operator/admin user who manages chats from the dashboard
// ============================================================
const agentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },           // Login email (unique identifier)
  name: { type: String, required: true },                          // Display name shown in chat
  passwordHash: { type: String, required: true },                  // bcrypt-hashed password (never expose in API responses)
  role: { type: String, enum: ['admin', 'supervisor', 'agent'], default: 'agent' }, // Legacy role field — kept for backward compatibility
  systemRole: { type: String, enum: ['admin', 'manager', 'agent'], default: 'agent' }, // Current role: admin (full access), manager (team lead), agent (operator)
  roles: [{ type: String }],                                       // Team/group memberships, e.g. ['Support', 'PreSales'] — used for routing and permissions
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' }, // Direct manager (for team hierarchy)
  status: { type: String, enum: ['online', 'offline', 'away'], default: 'offline' }, // Current availability status
  avatar: String,                                                  // Profile image URL
  specialties: [String],                                           // Chat categories this agent handles (for smart routing)
  office365Email: String,                                          // Office 365 email for calendar scheduling integration
  teamsEmail: String,                                              // Microsoft Teams email for Teams bot integration
  active: { type: Boolean, default: true },                        // Soft delete flag — false = deactivated account
  createdAt: { type: Date, default: Date.now },                    // Account creation timestamp
  lastLogin: Date                                                  // Most recent login timestamp
}, { timestamps: true });

// ============================================================
// Role — Team/group definition that agents can be assigned to
// ============================================================
const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },            // Team name, e.g. 'Support', 'Sales'
  description: String,                                             // Human-readable description of team purpose
  icon: { type: String, default: '👥' },                           // Emoji icon for UI display
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' }, // Team manager (can manage agents in this role)
  active: { type: Boolean, default: true }                         // Soft delete flag
}, { timestamps: true });

// ============================================================
// InviteLink — Shareable registration links for onboarding new agents
// ============================================================
const inviteLinkSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },            // Unique invite code (used in registration URL)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents', required: true }, // Admin who created the link
  defaultRoles: [String],                                          // Roles auto-assigned to agents who register via this link
  defaultManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' },          // Manager auto-assigned on registration
  maxUses: { type: Number, default: 0 },                           // Usage limit (0 = unlimited)
  usedCount: { type: Number, default: 0 },                         // How many times this link has been used
  expiresAt: Date,                                                 // Expiration date (null = never expires)
  active: { type: Boolean, default: true },                        // Can be deactivated without deleting
  label: String                                                    // Admin-facing label for identification
}, { timestamps: true });

// ============================================================
// KnowledgeBase — Uploaded documents used for AI-powered responses (RAG)
// ============================================================
const knowledgeBaseSchema = new mongoose.Schema({
  filename: { type: String, required: true },                      // Stored filename on disk
  originalName: String,                                            // Original upload filename
  fileType: String,                                                // MIME type of the uploaded file
  fileSize: Number,                                                // File size in bytes
  content: String,                                                 // Full extracted text content from the document
  chunks: [{                                                       // Text split into chunks for vector embedding
    text: String,                                                  // Chunk text content
    embeddingId: mongoose.Schema.Types.ObjectId                    // Reference to corresponding Embedding document
  }],
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' }, // Agent who uploaded the document
  uploadedAt: { type: Date, default: Date.now },                   // Upload timestamp
  active: { type: Boolean, default: true }                         // Soft delete — inactive docs excluded from AI search
}, { timestamps: true });

// ============================================================
// Embedding — Vector embeddings for knowledge base semantic search
// ============================================================
const embeddingSchema = new mongoose.Schema({
  knowledgeBaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_knowledge_base' }, // Parent KB document
  chunkIndex: Number,                                              // Position of this chunk in the source document
  text: { type: String, required: true },                          // Original text that was embedded
  embedding: { type: [Number], required: true },                   // Float vector array (OpenAI embedding dimensions)
  metadata: mongoose.Schema.Types.Mixed                            // Source info, page numbers, etc.
}, { timestamps: true });

// ============================================================
// CannedResponse — Pre-written reply templates for agents
// ============================================================
const cannedResponseSchema = new mongoose.Schema({
  title: { type: String, required: true },                         // Short title shown in template picker
  content: { type: String, required: true },                       // Full response text (inserted into chat)
  category: String,                                                // Grouping category, e.g. 'Greeting', 'Billing'
  shortcut: String,                                                // Keyboard shortcut trigger, e.g. '/hello'
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' }, // Author
  usageCount: { type: Number, default: 0 },                        // Times used (for sorting by popularity)
  active: { type: Boolean, default: true }                         // Soft delete flag
}, { timestamps: true });

// ============================================================
// WorkflowCategory — Configurable chat categories shown in widget UI
// ============================================================
const workflowCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },                          // Category label shown to users
  icon: { type: String, default: '💬' },                           // Emoji icon for UI display
  prompt: { type: String, required: true },                        // System prompt injected into AI when this category is selected
  active: { type: Boolean, default: true },                        // Whether to show in widget
  sortOrder: { type: Number, default: 0 }                          // Display order (ascending)
}, { timestamps: true });

// ============================================================
// ResponseCache — Cached AI responses to avoid redundant API calls
// ============================================================
const responseCacheSchema = new mongoose.Schema({
  questionEmbedding: { type: [Number], required: true },           // Vector embedding of the cached question (for similarity matching)
  question: { type: String, required: true },                      // Original question text
  response: { type: String, required: true },                      // Cached AI response
  confidence: Number,                                              // AI confidence score when response was generated
  sources: [String],                                               // KB sources used to generate this response
  hitCount: { type: Number, default: 0 },                          // Number of cache hits
  createdAt: { type: Date, default: Date.now, expires: 604800 }    // Auto-delete after 7 days (MongoDB TTL index)
}, { timestamps: true });

// ============================================================
// TeamsConversation — Microsoft Teams bot conversation state
// ============================================================
const teamsConversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true }, // Maps to AIChatDesk chat sessionId
  conversationReference: { type: mongoose.Schema.Types.Mixed, required: true }, // Bot Framework conversation reference (needed to send proactive messages)
  teamsUserId: String,                                             // Teams user ID
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'aichatdesk_agents' }, // Linked agent account
  threadId: String                                                 // Teams thread/channel ID
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

// ============================================================
// Setting — Key-value store for admin-configurable settings
// ============================================================
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },             // Setting identifier, e.g. 'profanityList', 'widgetTheme'
  value: mongoose.Schema.Types.Mixed,                              // Setting value (string, array, object — flexible)
  updatedAt: { type: Date, default: Date.now }                     // Last modification timestamp
});
const Setting = mongoose.model('aichatdesk_settings', settingSchema);

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
  InviteLink,
  Setting
};
