const express = require('express');
const router = express.Router();
const { Setting } = require('../db/models');
const { authenticateAgent, requireRole } = require('../middleware/auth');

/**
 * GET /api/settings
 * Get all settings (admin/manager only)
 */
router.get('/', authenticateAgent, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const settings = await Setting.find({}).lean();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (err) {
    console.error('Get settings error:', err.message);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

/**
 * PUT /api/settings
 * Update settings (admin only)
 */
router.put('/', authenticateAgent, requireRole('admin'), async (req, res) => {
  try {
    const updates = req.body; // { key: value, key2: value2, ... }
    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate(
        { key },
        { key, value, updatedAt: new Date() },
        { upsert: true }
      );
    }
    console.log('[Settings] Updated:', Object.keys(updates).join(', '));
    res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', err.message);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * GET /api/settings/public/:key
 * Get a single setting value (public, no auth needed — for widget use)
 */
router.get('/public/:key', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key }).lean();
    res.json({ value: setting ? setting.value : null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load setting' });
  }
});

module.exports = router;
