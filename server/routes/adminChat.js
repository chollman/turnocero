const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const AdminMessage = require('../models/AdminMessage');
const { protect, requireAdmin } = require('../middleware/auth');

// GET /api/admin-chat — fetch last 100 messages (admins only)
router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const messages = await AdminMessage.find()
      .populate('from', 'username')
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin-chat — send a message to the admin room
router.post(
  '/',
  protect,
  requireAdmin,
  [
    body('content')
      .trim()
      .notEmpty().withMessage('El mensaje no puede estar vacío')
      .isLength({ max: 2000 }).withMessage('Mensaje demasiado largo'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    try {
      const message = await AdminMessage.create({
        from: req.user._id,
        content: req.body.content,
      });
      await message.populate('from', 'username');

      const io = req.app.get('io');
      if (io) {
        io.to('admin:room').emit('admin:message', message);
      }

      res.status(201).json(message);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
