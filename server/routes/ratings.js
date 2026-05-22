const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const Rating = require('../models/Rating');
const Table = require('../models/Table');
const { protect } = require('../middleware/auth');
const { requireSection } = require('../middleware/sectionGate');
const validateObjectId = require('../middleware/validateObjectId');

router.use(requireSection('mesas'));

// `:id` viene del parent mount (`/api/tables/:id/ratings`).
router.use(validateObjectId('id'));

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const isParticipant = (table, userId) => {
  const uid = userId.toString();
  return (
    table.host.toString() === uid ||
    table.players.some((p) => p.toString() === uid)
  );
};

// GET /api/tables/:id/ratings
router.get('/', protect, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    const ratings = await Rating.find({ table: req.params.id })
      .populate('rater', 'username displayName avatar')
      .sort({ createdAt: -1 });

    const avg = ratings.length
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : null;

    res.json({ ratings, avg, count: ratings.length });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/ratings — participants only, after table date
router.post('/', protect, [
  body('score')
    .isInt({ min: 1, max: 5 })
    .withMessage('La puntuación debe ser entre 1 y 5'),
  body('comment')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage('El comentario no puede superar los 300 caracteres'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    if (new Date(table.date) > new Date()) {
      return res.status(400).json({ message: 'Solo se puede valorar una mesa después de que se jugó' });
    }

    if (!isParticipant(table, req.user._id)) {
      return res.status(403).json({ message: 'Solo los participantes de la mesa pueden valorarla' });
    }

    const existing = await Rating.findOne({ table: req.params.id, rater: req.user._id });

    let rating;
    if (existing) {
      existing.score = req.body.score;
      existing.comment = req.body.comment || '';
      rating = await existing.save();
    } else {
      rating = await Rating.create({
        table: req.params.id,
        rater: req.user._id,
        score: req.body.score,
        comment: req.body.comment || '',
      });
    }

    await rating.populate('rater', 'username displayName avatar');

    const allRatings = await Rating.find({ table: req.params.id });
    const avg = allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;

    res.status(201).json({ rating, avg, count: allRatings.length });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
