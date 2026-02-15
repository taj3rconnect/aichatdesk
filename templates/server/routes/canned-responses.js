/**
 * @file Canned Responses Routes — Pre-written reply template management
 * @description CRUD for reusable response templates that agents can quickly insert
 *   into chat conversations. Supports category filtering, text search, keyboard
 *   shortcuts (2-20 alphanumeric chars), and usage tracking for popularity sorting.
 *   Creating/updating requires admin or supervisor role; using requires any agent role.
 *   Soft-delete pattern (active=false) preserves historical usage data.
 *
 * @requires ../middleware/auth - authenticateAgent, requireRole
 */

const express = require('express');
const router = express.Router();
const { CannedResponse } = require('../db/models');
const { authenticateAgent, requireRole } = require('../middleware/auth');

// Validation constants
const VALID_CATEGORIES = ['billing', 'technical', 'general', 'feature_request', 'bug_report'];
const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 100;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 1000;
const SHORTCUT_REGEX = /^[a-zA-Z0-9]{2,20}$/;

/**
 * GET /api/canned-responses
 * List all active canned responses
 */
router.get('/', authenticateAgent, async (req, res) => {
  try {
    const { category, search } = req.query;

    // Build query
    const query = { active: true };

    if (category && VALID_CATEGORIES.includes(category)) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch responses
    const responses = await CannedResponse.find(query)
      .populate('createdBy', 'name')
      .sort({ usageCount: -1, title: 1 });

    // Format response
    const formatted = responses.map(response => ({
      id: response._id,
      title: response.title,
      content: response.content,
      category: response.category,
      shortcut: response.shortcut,
      usageCount: response.usageCount,
      createdBy: response.createdBy?.name || 'Unknown',
      createdAt: response.createdAt,
      updatedAt: response.updatedAt
    }));

    res.json(formatted);
  } catch (error) {
    console.error('List canned responses error:', error);
    res.status(500).json({
      error: 'Failed to retrieve canned responses',
      details: error.message
    });
  }
});

/**
 * POST /api/canned-responses
 * Create new canned response (admin/supervisor only)
 */
router.post('/', authenticateAgent, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { title, content, category, shortcut } = req.body;

    // Validation
    const errors = [];

    if (!title || title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) {
      errors.push(`Title must be between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters`);
    }

    if (!content || content.length < MIN_CONTENT_LENGTH || content.length > MAX_CONTENT_LENGTH) {
      errors.push(`Content must be between ${MIN_CONTENT_LENGTH} and ${MAX_CONTENT_LENGTH} characters`);
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    if (shortcut && !SHORTCUT_REGEX.test(shortcut)) {
      errors.push('Shortcut must be 2-20 alphanumeric characters');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // Create canned response
    const cannedResponse = await CannedResponse.create({
      title,
      content,
      category: category || null,
      shortcut: shortcut || null,
      createdBy: req.agent.agentId,
      active: true,
      usageCount: 0
    });

    // Populate createdBy for response
    await cannedResponse.populate('createdBy', 'name');

    res.status(201).json({
      id: cannedResponse._id,
      title: cannedResponse.title,
      content: cannedResponse.content,
      category: cannedResponse.category,
      shortcut: cannedResponse.shortcut,
      usageCount: cannedResponse.usageCount,
      createdBy: cannedResponse.createdBy?.name || 'Unknown',
      createdAt: cannedResponse.createdAt,
      updatedAt: cannedResponse.updatedAt
    });
  } catch (error) {
    console.error('Create canned response error:', error);
    res.status(500).json({
      error: 'Failed to create canned response',
      details: error.message
    });
  }
});

/**
 * PATCH /api/canned-responses/:id
 * Update canned response (admin/supervisor only)
 */
router.patch('/:id', authenticateAgent, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { title, content, category, shortcut } = req.body;

    // Find existing response
    const cannedResponse = await CannedResponse.findById(req.params.id);

    if (!cannedResponse || !cannedResponse.active) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    // Validation
    const errors = [];

    if (title !== undefined) {
      if (title.length < MIN_TITLE_LENGTH || title.length > MAX_TITLE_LENGTH) {
        errors.push(`Title must be between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters`);
      }
    }

    if (content !== undefined) {
      if (content.length < MIN_CONTENT_LENGTH || content.length > MAX_CONTENT_LENGTH) {
        errors.push(`Content must be between ${MIN_CONTENT_LENGTH} and ${MAX_CONTENT_LENGTH} characters`);
      }
    }

    if (category !== undefined && category !== null) {
      if (!VALID_CATEGORIES.includes(category)) {
        errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
      }
    }

    if (shortcut !== undefined && shortcut !== null && shortcut !== '') {
      if (!SHORTCUT_REGEX.test(shortcut)) {
        errors.push('Shortcut must be 2-20 alphanumeric characters');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // Update fields
    if (title !== undefined) cannedResponse.title = title;
    if (content !== undefined) cannedResponse.content = content;
    if (category !== undefined) cannedResponse.category = category;
    if (shortcut !== undefined) cannedResponse.shortcut = shortcut;

    await cannedResponse.save();
    await cannedResponse.populate('createdBy', 'name');

    res.json({
      id: cannedResponse._id,
      title: cannedResponse.title,
      content: cannedResponse.content,
      category: cannedResponse.category,
      shortcut: cannedResponse.shortcut,
      usageCount: cannedResponse.usageCount,
      createdBy: cannedResponse.createdBy?.name || 'Unknown',
      createdAt: cannedResponse.createdAt,
      updatedAt: cannedResponse.updatedAt
    });
  } catch (error) {
    console.error('Update canned response error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid response ID' });
    }

    res.status(500).json({
      error: 'Failed to update canned response',
      details: error.message
    });
  }
});

/**
 * DELETE /api/canned-responses/:id
 * Soft delete canned response (admin only)
 */
router.delete('/:id', authenticateAgent, requireRole('admin'), async (req, res) => {
  try {
    const cannedResponse = await CannedResponse.findById(req.params.id);

    if (!cannedResponse || !cannedResponse.active) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    // Soft delete
    cannedResponse.active = false;
    await cannedResponse.save();

    res.json({ message: 'Canned response deleted successfully' });
  } catch (error) {
    console.error('Delete canned response error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid response ID' });
    }

    res.status(500).json({
      error: 'Failed to delete canned response',
      details: error.message
    });
  }
});

/**
 * POST /api/canned-responses/:id/use
 * Increment usage count
 */
router.post('/:id/use', authenticateAgent, async (req, res) => {
  try {
    const cannedResponse = await CannedResponse.findByIdAndUpdate(
      req.params.id,
      { $inc: { usageCount: 1 } },
      { new: true }
    );

    if (!cannedResponse || !cannedResponse.active) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    res.json({ message: 'Usage count incremented', usageCount: cannedResponse.usageCount });
  } catch (error) {
    console.error('Increment usage count error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid response ID' });
    }

    res.status(500).json({
      error: 'Failed to increment usage count',
      details: error.message
    });
  }
});

module.exports = router;
