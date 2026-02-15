const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { WorkflowCategory } = require('../db/models');
const { authenticateAgent } = require('../middleware/auth');

// AI-powered icon selection based on category name and prompt
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

// GET /api/categories - List active categories (public, for widget)
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

// GET /api/categories/all - List all categories (admin)
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

// POST /api/categories - Create category (admin)
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

// PUT /api/categories/:id - Update category (admin)
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

// DELETE /api/categories/:id - Delete category (admin)
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
