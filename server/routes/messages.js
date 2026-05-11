const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Table = require('../models/Table');
const { protect } = require('../middleware/auth');

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
    if (!isParticipant(table, req.user._id)) {
      return res.status(403).json({ message: 'Solo los participantes pueden ver el chat' });
    }
    const messages = await Message.find({ table: req.params.id })
      .populate('sender', 'username')
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
    await message.populate('sender', 'username');

    // Broadcast to all sockets in this table's room
    const io = req.app.get('io');
    if (io) io.to(`table:${req.params.id}`).emit('chat:message', message);

    res.status(201).json(message);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
