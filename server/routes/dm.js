const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const DirectMessage = require('../models/DirectMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { requireSection } = require('../middleware/sectionGate');
const saveNotification = require('../utils/saveNotification');

router.use(requireSection('dms'));

// GET /api/dm — list of conversations (latest message per contact + unread count)
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await DirectMessage.aggregate([
      { $match: { $or: [{ from: userId }, { to: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$from', userId] }, '$to', '$from'],
          },
          lastMessage: { $first: '$$ROOT' },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$to', userId] }, { $eq: ['$readByRecipient', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'contact',
          pipeline: [{ $project: { username: 1 } }],
        },
      },
      { $unwind: '$contact' },
      {
        $project: {
          contact: 1,
          lastMessage: 1,
          unread: 1,
        },
      },
    ]);

    res.json(conversations);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/dm/:userId — paginated message history with a specific user
router.get('/:userId', protect, async (req, res) => {
  try {
    const otherId = new mongoose.Types.ObjectId(req.params.userId);
    const userId = req.user._id;

    const isFriend = req.user.friends.some((f) => f.toString() === req.params.userId);
    if (!isFriend) {
      return res.status(403).json({ message: 'Solo podés chatear con tus amigos' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 40);
    const skip = (page - 1) * limit;

    const messages = await DirectMessage.find({
      $or: [
        { from: userId, to: otherId },
        { from: otherId, to: userId },
      ],
    })
      .populate('from', 'username')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    res.json(messages);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/dm/:userId — send a message
router.post(
  '/:userId',
  protect,
  [
    body('content')
      .trim()
      .notEmpty().withMessage('El mensaje no puede estar vacío')
      .isLength({ max: 1000 }).withMessage('Mensaje demasiado largo'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    try {
      const recipientId = req.params.userId;

      const isFriend = req.user.friends.some((f) => f.toString() === recipientId);
      if (!isFriend) {
        return res.status(403).json({ message: 'Solo podés chatear con tus amigos' });
      }

      const recipient = await User.findById(recipientId).select('username');
      if (!recipient) return res.status(404).json({ message: 'Usuario no encontrado' });

      // Detect first-ever message between these two users
      const priorCount = await DirectMessage.countDocuments({
        $or: [
          { from: req.user._id, to: recipientId },
          { from: recipientId, to: req.user._id },
        ],
      });
      const isNewConversation = priorCount === 0;

      const message = await DirectMessage.create({
        from: req.user._id,
        to: recipientId,
        content: req.body.content,
      });
      await message.populate('from', 'username');

      await saveNotification(recipientId, 'dm', {
        fromUserId: req.user._id.toString(),
        fromUsername: req.user.username,
        lastMessagePreview: req.body.content.slice(0, 60),
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${recipientId}`).emit('dm:message', {
          ...message.toObject(),
          isNewConversation,
        });
      }

      res.status(201).json(message);
    } catch {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// PATCH /api/dm/:userId/read — mark messages from that user as read
router.patch('/:userId/read', protect, async (req, res) => {
  try {
    await DirectMessage.updateMany(
      { from: req.params.userId, to: req.user._id, readByRecipient: false },
      { $set: { readByRecipient: true } }
    );
    await Notification.updateMany(
      { recipient: req.user._id, type: 'dm', fromUserId: req.params.userId, read: false },
      { $set: { read: true } }
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
