const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// GET /api/notifications — own notifications, newest first
router.get('/', protect, async (req, res) => {
  try {
    const notifs = await Notification.find({ recipient: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(60)
      .lean();
    res.json(notifs);
  } catch {
    res.status(500).json({ message: 'Error al cargar notificaciones' });
  }
});

// PATCH /api/notifications/read — mark matching notifications as read
// Body: { tableId } or { fromUserId } or { torneoId } or {} (mark all)
router.patch('/read', protect, async (req, res) => {
  try {
    const { tableId, fromUserId, torneoId } = req.body;
    const filter = { recipient: req.user._id, read: false };
    if (tableId)    filter.tableId    = tableId;
    if (fromUserId) filter.fromUserId = fromUserId;
    if (torneoId)   filter.torneoId   = torneoId;
    await Notification.updateMany(filter, { $set: { read: true } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Error al marcar como leído' });
  }
});

// DELETE /api/notifications — clear all
router.delete('/', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Error al limpiar notificaciones' });
  }
});

module.exports = router;
