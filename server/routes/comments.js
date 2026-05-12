const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, param, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Table = require('../models/Table');
const { protect } = require('../middleware/auth');
const saveNotification = require('../utils/saveNotification');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

// GET /api/tables/:id/comments — any logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    const comments = await Comment.find({ table: req.params.id })
      .populate('author', 'username')
      .sort({ createdAt: 1 });

    res.json(comments);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/comments — any logged-in user
router.post('/', protect, [
  body('content')
    .trim()
    .notEmpty().withMessage('El comentario no puede estar vacío')
    .isLength({ max: 500 }).withMessage('El comentario no puede superar los 500 caracteres'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });
    if (table.status === 'cancelled') {
      return res.status(400).json({ message: 'No se pueden agregar comentarios a una mesa cancelada' });
    }

    const comment = await Comment.create({
      table: req.params.id,
      author: req.user._id,
      content: req.body.content,
    });

    await comment.populate('author', 'username');

    // Notify members and followers (except the author)
    const io = req.app.get('io');
    if (io) {
      const uid = req.user._id.toString();
      const recipients = new Set([
        table.host.toString(),
        ...table.players.map((p) => p.toString()),
        ...table.followers.map((f) => f.toString()),
      ]);
      recipients.delete(uid);
      recipients.forEach((userId) => {
        io.to(`user:${userId}`).emit('table:comment', {
          tableId: table._id.toString(),
          tableName: table.boardGame,
          commenterUsername: req.user.username,
          commentPreview: req.body.content.slice(0, 60),
          timestamp: new Date(),
        });
        saveNotification(userId, 'comment', {
          tableId: table._id.toString(),
          tableName: table.boardGame,
          lastCommenterUsername: req.user.username,
          lastCommentPreview: req.body.content.slice(0, 60),
        }).catch(() => {});
      });
    }

    res.status(201).json(comment);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tables/:id/comments/:commentId — author only
router.put('/:commentId', protect, [
  param('commentId').isMongoId().withMessage('Invalid comment ID'),
  body('content')
    .trim()
    .notEmpty().withMessage('El comentario no puede estar vacío')
    .isLength({ max: 500 }).withMessage('El comentario no puede superar los 500 caracteres'),
], validate, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Solo el autor puede editar este comentario' });
    }

    comment.content = req.body.content;
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate('author', 'username');

    res.json(comment);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tables/:id/comments/:commentId — author, host, or admin
router.delete('/:commentId', protect, [
  param('commentId').isMongoId().withMessage('Invalid comment ID'),
], validate, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const table = await Table.findById(req.params.id);
    const isAuthor = comment.author.toString() === req.user._id.toString();
    const isHost = table && table.host.toString() === req.user._id.toString();

    if (!isAuthor && !isHost && !req.user.isAdmin) {
      return res.status(403).json({ message: 'No tenés permiso para eliminar este comentario' });
    }

    await comment.deleteOne();
    res.json({ message: 'Comment deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
