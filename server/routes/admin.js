const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Table = require('../models/Table');

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
    const searchTerm = (req.query.search || '').trim();

    const col = mongoose.connection.db.collection(name);

    let query = {};
    if (searchTerm) {
      if (/^[0-9a-f]{24}$/i.test(searchTerm)) {
        try {
          query = { _id: new mongoose.Types.ObjectId(searchTerm) };
        } catch { /* invalid ObjectId, keep empty query */ }
      } else {
        const sample = await col.findOne({});
        if (sample) {
          const stringFields = Object.entries(sample)
            .filter(([, v]) => typeof v === 'string')
            .map(([k]) => k);
          if (stringFields.length > 0) {
            query = { $or: stringFields.map((f) => ({ [f]: { $regex: searchTerm, $options: 'i' } })) };
          }
        }
      }
    }

    const [docs, total] = await Promise.all([
      col.find(query).skip(skip).limit(limit).toArray(),
      col.countDocuments(query),
    ]);

    res.json({ docs, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/admin — toggle isAdmin
router.patch('/users/:id/admin', protect, requireAdmin, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    target.isAdmin = !target.isAdmin;
    await target.save({ validateModifiedOnly: true });
    res.json({ _id: target._id, username: target.username, isAdmin: target.isAdmin });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/ban — toggle ban
router.patch('/users/:id/ban', protect, requireAdmin, async (req, res) => {
  try {
    const { banned, reason } = req.body;
    if (typeof banned !== 'boolean') {
      return res.status(400).json({ message: 'El campo "banned" debe ser booleano' });
    }
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'No podés banearte a vos mismo' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (target.isAdmin) {
      return res.status(400).json({ message: 'No podés banear a otro admin' });
    }

    target.isBanned = banned;
    target.bannedAt = banned ? new Date() : null;
    target.bannedReason = banned ? (reason || '').toString().slice(0, 500) : '';
    await target.save({ validateModifiedOnly: true });

    res.json({
      _id: target._id,
      username: target.username,
      isBanned: target.isBanned,
      bannedAt: target.bannedAt,
      bannedReason: target.bannedReason,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/users/:id — hard delete user
router.delete('/users/:id', protect, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'No podés eliminarte a vos mismo' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (target.isAdmin) {
      return res.status(400).json({ message: 'No podés eliminar a otro admin' });
    }

    const id = target._id;

    // Cleanup: remove user from array references so UX doesn't break.
    // References in scalar fields (host, sender, author, etc.) are left orphaned
    // and will render as "Usuario eliminado" in the UI.
    await Promise.all([
      Table.updateMany(
        {},
        {
          $pull: {
            players: id,
            pendingRequests: id,
            followers: id,
            reactions: { user: id },
          },
        }
      ),
      User.updateMany(
        {},
        {
          $pull: {
            friends: id,
            friendRequests: { from: id },
          },
        }
      ),
    ]);

    await User.findByIdAndDelete(id);

    res.json({ _id: id, deleted: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
