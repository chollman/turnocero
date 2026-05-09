const express = require('express');
const router = express.Router();
const Table = require('../models/Table');
const { protect } = require('../middleware/auth');

// GET /api/tables - Get all open tables
router.get('/', protect, async (req, res) => {
  try {
    const tables = await Table.find({ status: { $ne: 'cancelled' } })
      .populate('host', 'username')
      .populate('players', 'username')
      .sort({ date: 1 });

    res.json(tables);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tables/mine - Get tables the user is hosting or joined
router.get('/mine', protect, async (req, res) => {
  try {
    const tables = await Table.find({
      $or: [{ host: req.user._id }, { players: req.user._id }],
      status: { $ne: 'cancelled' },
    })
      .populate('host', 'username')
      .populate('players', 'username')
      .sort({ date: 1 });

    res.json(tables);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables - Create a new table
router.post('/', protect, async (req, res) => {
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

// POST /api/tables/:id/join - Join a table
router.post('/:id/join', protect, async (req, res) => {
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

// POST /api/tables/:id/leave - Leave a table
router.post('/:id/leave', protect, async (req, res) => {
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

// DELETE /api/tables/:id - Cancel a table (host only)
router.delete('/:id', protect, async (req, res) => {
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
