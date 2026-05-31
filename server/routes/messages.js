const express = require("express");
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require("express-validator");
const Message = require("../models/Message");
const Table = require("../models/Table");
const { protect } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { emitNotificationReq } = require("../utils/emitNotification");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");

router.use(requireSection("mesas"));

// `:id` viene del parent mount (`/api/tables/:id/messages`), por lo que
// router.param('id') no se dispara — validamos con middleware.
router.use(validateObjectId("id"));

const isParticipant = (table, userId) => {
  return (
    isSameId(table.host, userId) ||
    table.players.some((p) => isSameId(p, userId))
  );
};

// GET /api/tables/:id/messages — only participants
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Mesa no encontrada");
    if (!isParticipant(table, req.user._id) && !req.user.isAdmin) {
      throw httpError(403, "Solo los participantes pueden ver el chat");
    }
    const messages = await Message.find({ table: req.params.id })
      .populate("sender", "username displayName avatar")
      .sort({ createdAt: 1 })
      .limit(200);
    res.json(messages);
  }),
);

// POST /api/tables/:id/messages — only participants; broadcasts via socket
router.post(
  "/",
  protect,
  [
    body("content")
      .trim()
      .notEmpty()
      .withMessage("El mensaje no puede estar vacío")
      .isLength({ max: 1000 })
      .withMessage("Mensaje demasiado largo"),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw httpError(400, errors.array()[0].msg);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Mesa no encontrada");
    if (!isParticipant(table, req.user._id)) {
      throw httpError(403, "Solo los participantes pueden enviar mensajes");
    }

    const message = await Message.create({
      table: req.params.id,
      sender: req.user._id,
      content: req.body.content,
    });
    await message.populate("sender", "username displayName avatar");

    const io = req.app.get("io");
    if (io) io.to(`table:${req.params.id}`).emit("chat:message", message);

    const senderId = req.user._id.toString();
    const participantIds = [
      table.host.toString(),
      ...table.players.map((p) => p.toString()),
    ].filter((pid) => pid !== senderId);

    const messagePreview = req.body.content.slice(0, 60);

    await Promise.all(
      participantIds.map((pid) =>
        emitNotificationReq(
          req,
          pid,
          "chat",
          {
            tableId: req.params.id,
            tableName: table.boardGame,
            lastSenderUsername: req.user.username,
            lastMessagePreview: messagePreview,
            actor: {
              userId: req.user._id.toString(),
              username: req.user.username,
            },
          },
          "chat:notification",
          { senderUsername: req.user.username, messagePreview },
        ).catch(() => {}),
      ),
    );

    res.status(201).json(message);
  }),
);

module.exports = router;
