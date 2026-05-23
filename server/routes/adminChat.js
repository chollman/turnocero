const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const AdminMessage = require("../models/AdminMessage");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { protect, requireAdmin } = require("../middleware/auth");
const { emitNotificationReq } = require("../utils/emitNotification");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

// GET /api/admin-chat — fetch last 100 messages (admins only)
router.get(
  "/",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const messages = await AdminMessage.find()
      .populate("from", "username displayName avatar")
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  }),
);

// POST /api/admin-chat — send a message to the admin room
router.post(
  "/",
  protect,
  requireAdmin,
  [
    body("content")
      .trim()
      .notEmpty()
      .withMessage("El mensaje no puede estar vacío")
      .isLength({ max: 2000 })
      .withMessage("Mensaje demasiado largo"),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw httpError(400, errors.array()[0].msg);

    const message = await AdminMessage.create({
      from: req.user._id,
      content: req.body.content,
    });
    await message.populate("from", "username displayName avatar");

    // Emit per-admin (not to admin:room) so each socket receives EXACTLY ONE
    // admin:message event with its own notifId + count. Emitting to a room AND
    // per-user would deliver two events to the same socket and double-count.
    const otherAdmins = await User.find({
      isAdmin: true,
      _id: { $ne: req.user._id },
    }).select("_id");
    const messagePayload = message.toObject();
    await Promise.all(
      otherAdmins.map((admin) =>
        emitNotificationReq(
          req,
          admin._id,
          "admin_chat",
          {
            lastSenderUsername: req.user.username,
            lastMessagePreview: req.body.content.slice(0, 60),
          },
          "admin:message",
          messagePayload,
        ),
      ),
    );

    res.status(201).json(message);
  }),
);

// PATCH /api/admin-chat/read — mark admin chat notifications as read
router.patch(
  "/read",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await Notification.updateMany(
      { recipient: req.user._id, type: "admin_chat", read: false },
      { $set: { read: true } },
    );
    res.json({ ok: true });
  }),
);

module.exports = router;
