const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Table = require('../models/Table');
const { protect } = require('../middleware/auth');
const { requireSection } = require('../middleware/sectionGate');
const saveNotification = require('../utils/saveNotification');

router.use(requireSection('mesas'));

const isParticipant = (table, userId) => {
  const id = userId.toString();
  return (
    table.host.toString() === id ||
    table.players.some((p) => p.toString() === id)
  );
};

// GET /api/tables/:id/messages — only participants
router.get('/', protect, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Mesa no encontrada' });
    if (!isParticipant(table, req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Solo los participantes pueden ver el chat' });
    }
    const messages = await Message.find({ table: req.params.id })
      .populate('sender', 'username displayName avatar')
      .sort({ createdAt: 1 })
      .limit(200);
    res.json(messages);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/messages — only participants; broadcasts via socket
router.post('/', protect, [
  body('content')
    .trim()
    .notEmpty().withMessage('El mensaje no puede estar vacío')
    .isLength({ max: 1000 }).withMessage('Mensaje demasiado largo'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Mesa no encontrada' });
    if (!isParticipant(table, req.user._id)) {
      return res.status(403).json({ message: 'Solo los participantes pueden enviar mensajes' });
    }

    const message = await Message.create({
      table: req.params.id,
      sender: req.user._id,
      content: req.body.content,
    });
    await message.populate('sender', 'username displayName avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(`table:${req.params.id}`).emit('chat:message', message);

      const senderId = req.user._id.toString();
      const participantIds = [
        table.host.toString(),
        ...table.players.map((p) => p.toString()),
      ].filter((pid) => pid !== senderId);

      const notif = {
        tableId: req.params.id,
        tableName: table.boardGame,
        senderUsername: req.user.username,
        messagePreview: req.body.content.slice(0, 60),
        timestamp: new Date(),
      };

      for (const pid of participantIds) {
        io.to(`user:${pid}`).emit('chat:notification', notif);
        saveNotification(pid, 'chat', {
          tableId: req.params.id,
          tableName: table.boardGame,
          lastSenderUsername: req.user.username,
          lastMessagePreview: notif.messagePreview,
        }).catch(() => {});
      }
    }

    res.status(201).json(message);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
