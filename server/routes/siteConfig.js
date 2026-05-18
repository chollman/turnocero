const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth');
const { getSiteConfig, updateSiteConfig } = require('../utils/siteConfig');

// GET /api/site-config — public; clients (incluso anónimos) necesitan saber qué mostrar
router.get('/', (_req, res) => {
  res.json(getSiteConfig());
});

// PATCH /api/site-config — admin only
router.patch('/', protect, requireAdmin, async (req, res) => {
  try {
    const { sections } = req.body || {};
    if (!sections || typeof sections !== 'object') {
      return res.status(400).json({ message: 'Body inválido: se esperaba { sections: {...} }' });
    }
    const io = req.app.get('io');
    const updated = await updateSiteConfig(sections, req.user._id, io);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
