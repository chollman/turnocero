const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/notifications — own notifications, newest first
// Query: ?before=<isoDate> ?limit=<n> (default 60, max 100)
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 60));
    const filter = { recipient: req.user._id };
    if (req.query.before) {
      const beforeDate = new Date(req.query.before);
      if (!isNaN(beforeDate)) filter.updatedAt = { $lt: beforeDate };
    }
    const notifs = await Notification.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    res.json(notifs);
  }),
);

// PATCH /api/notifications/read — mark matching notifications as read
// Body: { tableId } or { fromUserId } or { torneoId } or { compartidaId } or { type } or {} (mark all)
router.patch(
  "/read",
  protect,
  asyncHandler(async (req, res) => {
    const { tableId, fromUserId, torneoId, compartidaId, type } = req.body;
    const filter = { recipient: req.user._id, read: false };
    if (tableId) filter.tableId = tableId;
    if (fromUserId) filter.fromUserId = fromUserId;
    if (torneoId) filter.torneoId = torneoId;
    if (compartidaId) filter.compartidaId = compartidaId;
    if (type) filter.type = type;
    // Reset count: 0 además de read: true — sin esto, el próximo evento
    // hace $inc desde el count viejo (ej: count=3 antes de markRead → nuevo
    // evento → count=4 emitido al cliente, badge desincronizado).
    await Notification.updateMany(filter, { $set: { read: true, count: 0 } });
    res.json({ ok: true });
  }),
);

// DELETE /api/notifications — clear all
router.delete(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ ok: true });
  }),
);

module.exports = router;
