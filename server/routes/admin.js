const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, requireAdmin } = require('../middleware/auth');

// GET /api/admin/collections
router.get('/collections', protect, requireAdmin, async (req, res) => {
  try {
    const cols = await mongoose.connection.db.listCollections().toArray();
    const names = cols
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'))
      .sort();
    res.json(names);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/collections/:name
router.get('/collections/:name', protect, requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const col = mongoose.connection.db.collection(name);
    const [docs, total] = await Promise.all([
      col.find({}).skip(skip).limit(limit).toArray(),
      col.countDocuments(),
    ]);

    res.json({ docs, total, page, pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/admin — toggle isAdmin
router.patch('/users/:id/admin', protect, requireAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    target.isAdmin = !target.isAdmin;
    await target.save({ validateModifiedOnly: true });
    res.json({ _id: target._id, username: target.username, isAdmin: target.isAdmin });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
