/**
 * @file Categories Routes — Workflow category management for AI behavior customization
 * @description Manages workflow categories that customize the AI assistant's behavior
 *   per chat session. Each category has a custom system prompt that is prepended to
 *   the AI's instructions, allowing different greeting styles, topic focus, or
 *   personality per department/use case (e.g., "Sales", "Technical Support").
 *
 *   Categories are shown in the chat widget for user self-selection.
 *   When a chat has a categoryId, the AI query pipeline injects the category's
 *   prompt before the standard system prompt, overriding default behavior.
 *
 *   Icons are auto-selected via Claude Haiku AI when not explicitly provided.
 *
 * @requires @anthropic-ai/sdk - AI-powered emoji icon selection
 * @requires ../middleware/auth - Agent authentication for admin endpoints
 */

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { WorkflowCategory } = require('../db/models');
const { authenticateAgent } = require('../middleware/auth');

/**
 * Pick an emoji icon for a category using Claude Haiku.
 * Falls back to default chat emoji on API failure or missing key.
 * @param {string} name - Category name
 * @param {string} prompt - Category prompt (truncated to 200 chars for AI context)
 * @returns {Promise<string>} Single emoji character
 */
async function pickIcon(name, prompt) {
  try {
    if (!process.env.CLAUDE_API_KEY) return '💬';
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const res = await client.messages.create({
      model: 'claude-haiku-3-20240307',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: `Pick ONE emoji icon that best represents this customer support category.\nCategory: ${name}\nPurpose: ${prompt.substring(0, 200)}\n\nRespond with ONLY the single emoji, nothing else.`
      }]
    });
    const emoji = res.content[0].text.trim();
    // Validate it's actually an emoji (1-2 chars or emoji sequences)
    if (emoji.length <= 8 && emoji.length > 0) return emoji;
    return '💬';
  } catch (err) {
    console.error('[Categories] AI icon pick failed:', err.message);
    return '💬';
  }
}

/**
 * GET /api/categories
 * List active categories sorted by sortOrder then name. Public endpoint (no auth)
 * used by the chat widget to display category selection.
 */
router.get('/', async (req, res) => {
  try {
    const categories = await WorkflowCategory.find({ active: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name icon prompt');
    res.json(categories);
  } catch (error) {
    console.error('[Categories] List error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/categories/all
 * List all categories including inactive ones. Requires agent authentication.
 */
router.get('/all', authenticateAgent, async (req, res) => {
  try {
    const categories = await WorkflowCategory.find()
      .sort({ sortOrder: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('[Categories] List all error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/categories
 * Create a new workflow category. Requires agent authentication.
 * Auto-picks emoji icon via AI if not provided.
 * @param {string} req.body.name - Category display name
 * @param {string} req.body.prompt - System prompt prepended to AI instructions
 * @param {string} [req.body.icon] - Emoji icon (auto-picked if omitted)
 * @param {boolean} [req.body.active=true] - Whether category is visible in widget
 * @param {number} [req.body.sortOrder=0] - Display order (lower = first)
 */
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const { name, icon, prompt, active, sortOrder } = req.body;
    if (!name || !prompt) {
      return res.status(400).json({ error: 'name and prompt are required' });
    }
    // Auto-pick icon using AI if not provided
    const resolvedIcon = icon || await pickIcon(name, prompt);
    const category = await WorkflowCategory.create({
      name,
      icon: resolvedIcon,
      prompt,
      active: active !== false,
      sortOrder: sortOrder || 0
    });
    console.log(`[Categories] Created: ${name}`);
    res.status(201).json(category);
  } catch (error) {
    console.error('[Categories] Create error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * PUT /api/categories/:id
 * Update an existing workflow category. Re-picks icon via AI if name/prompt
 * changed and no explicit icon provided.
 */
router.put('/:id', authenticateAgent, async (req, res) => {
  try {
    const { name, icon, prompt, active, sortOrder } = req.body;
    // Re-pick icon if name or prompt changed and no explicit icon provided
    const update = { name, prompt, active, sortOrder };
    if (icon) {
      update.icon = icon;
    } else if (name && prompt) {
      update.icon = await pickIcon(name, prompt);
    }
    const category = await WorkflowCategory.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    console.log(`[Categories] Updated: ${category.name}`);
    res.json(category);
  } catch (error) {
    console.error('[Categories] Update error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

/**
 * DELETE /api/categories/:id
 * Hard-delete a workflow category. Requires agent authentication.
 */
router.delete('/:id', authenticateAgent, async (req, res) => {
  try {
    const category = await WorkflowCategory.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    console.log(`[Categories] Deleted: ${category.name}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Categories] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
