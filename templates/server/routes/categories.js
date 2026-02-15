const express = require('express');
const router = express.Router();
const { WorkflowCategory } = require('../db/models');
const { authenticateAgent } = require('../middleware/auth');

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
    const category = await WorkflowCategory.create({
      name,
      icon: icon || '💬',
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
    const category = await WorkflowCategory.findByIdAndUpdate(
      req.params.id,
      { name, icon, prompt, active, sortOrder },
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
