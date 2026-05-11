const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Table = require('../models/Table');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

const buildSearchClause = async (search) => {
  if (!search) return null;
  const escaped = search.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'i');
  const matchingHosts = await User.find({ username: rx }).select('_id');
  return { $or: [{ boardGame: rx }, { host: { $in: matchingHosts.map((u) => u._id) } }] };
};

// GET /api/tables — protected; supports ?page, ?limit, ?search
router.get('/', protect, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const searchClause = await buildSearchClause(req.query.search);
    const filter = { status: { $ne: 'cancelled' }, ...searchClause };
    const [tables, total] = await Promise.all([
      Table.find(filter).populate('host', 'username').populate('players', 'username').sort({ date: 1 }).skip(skip).limit(limit),
      Table.countDocuments(filter),
    ]);
    res.json({ tables, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tables/mine — protected; returns tables where user is host or player
router.get('/mine', protect, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const searchClause = await buildSearchClause(req.query.search);
    const baseFilter = { $or: [{ host: req.user._id }, { players: req.user._id }], status: { $ne: 'cancelled' } };
    const filter = searchClause ? { $and: [baseFilter, searchClause] } : baseFilter;
    const [tables, total] = await Promise.all([
      Table.find(filter).populate('host', 'username').populate('players', 'username').sort({ date: 1 }).skip(skip).limit(limit),
      Table.countDocuments(filter),
    ]);
    res.json({ tables, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables — protected
router.post('/', protect, [
  body('boardGame').trim().notEmpty().withMessage('Game name is required').isLength({ max: 100 }).withMessage('Game name is too long'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('maxPlayers').notEmpty().withMessage('Max players is required').isInt({ min: 2, max: 20 }).withMessage('Max players must be between 2 and 20'),
  body('location').optional().trim().isLength({ max: 200 }).withMessage('Location is too long'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description is too long'),
], validate, async (req, res) => {
  try {
    const { boardGame, date, maxPlayers, location, description } = req.body;

    if (!boardGame || !date || !maxPlayers) {
      return res.status(400).json({ message: 'Game, date and max players are required' });
    }

    const table = await Table.create({
      boardGame,
      date,
      maxPlayers,
      location,
      description,
      host: req.user._id,
      players: [],
    });

    await table.populate('host', 'username');

    res.status(201).json(table);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tables/:id — protected; returns a single table
router.get('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id)
      .populate('host', 'username')
      .populate('players', 'username');
    if (!table) return res.status(404).json({ message: 'Table not found' });
    res.json(table);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/tables/:id — protected, host only
router.put('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('maxPlayers').notEmpty().withMessage('Max players is required').isInt({ min: 2, max: 20 }).withMessage('Max players must be between 2 and 20'),
  body('location').optional().trim().isLength({ max: 200 }).withMessage('Location is too long'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description is too long'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    if (table.status === 'cancelled') {
      return res.status(400).json({ message: 'No se puede editar una mesa cancelada' });
    }

    if (table.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Solo el host puede editar esta mesa' });
    }

    const newMaxPlayers = Number(req.body.maxPlayers);
    if (newMaxPlayers < table.players.length) {
      return res.status(400).json({
        message: `No podés reducir los lugares por debajo de los jugadores actuales (${table.players.length})`,
      });
    }

    table.date = req.body.date;
    table.maxPlayers = newMaxPlayers;
    table.location = req.body.location || '';
    table.description = req.body.description || '';

    await table.save();
    await table.populate('host', 'username');
    await table.populate('players', 'username');

    res.json(table);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/join — protected
router.post('/:id/join', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }

    if (table.status === 'cancelled') {
      return res.status(400).json({ message: 'This table has been cancelled' });
    }

    if (table.host.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You are the host of this table' });
    }

    if (table.players.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'You already joined this table' });
    }

    if (table.players.length >= table.maxPlayers) {
      return res.status(400).json({ message: 'This table is full' });
    }

    table.players.push(req.user._id);
    await table.save();
    await table.populate('host', 'username');
    await table.populate('players', 'username');

    res.json(table);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/leave — protected
router.post('/:id/leave', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }

    const playerIndex = table.players.findIndex(
      (p) => p.toString() === req.user._id.toString()
    );

    if (playerIndex === -1) {
      return res.status(400).json({ message: 'You are not in this table' });
    }

    table.players.splice(playerIndex, 1);
    await table.save();
    await table.populate('host', 'username');
    await table.populate('players', 'username');

    res.json(table);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tables/:id — protected, host only
router.delete('/:id', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }

    if (table.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can cancel this table' });
    }

    table.status = 'cancelled';
    await table.save();

    res.json({ message: 'Table cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
