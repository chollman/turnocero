const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Table = require('../models/Table');
const User = require('../models/User');
const { protect, optionalAuth } = require('../middleware/auth');
const { requireSection } = require('../middleware/sectionGate');
const saveNotification = require('../utils/saveNotification');

router.use(requireSection('mesas'));

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

// Fields exposed for any populated user reference returned by these routes.
// `bggUsername` enables the BG Watch chip/link in TableDetail player chips.
const POPULATE_USER_FIELDS = 'username displayName avatar bggUsername';

const populateTable = (query) =>
  query
    .populate('host', POPULATE_USER_FIELDS)
    .populate('players', POPULATE_USER_FIELDS)
    .populate('pendingRequests', POPULATE_USER_FIELDS)
    .populate('images.uploader', 'username displayName avatar');

// GET /api/tables — public (anon sees only public tables); supports ?page, ?limit, ?search
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const searchClause = await buildSearchClause(req.query.search);
    const privacyFilter = req.user ? {} : { privacy: { $ne: 'private' } };
    const filter = { status: { $ne: 'cancelled' }, ...privacyFilter, ...searchClause };
    const [tables, total] = await Promise.all([
      populateTable(Table.find(filter)).sort({ date: -1 }).skip(skip).limit(limit),
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
      populateTable(Table.find(filter)).sort({ date: -1 }).skip(skip).limit(limit),
      Table.countDocuments(filter),
    ]);
    res.json({ tables, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/me/feed — protected; all tables for current user (all statuses), sorted date desc
// ?includeFriends=true also includes friends' tables
router.get('/me/feed', protect, async (req, res) => {
  try {
    let ids = [req.user._id];
    if (req.query.includeFriends === 'true') {
      const me = await User.findById(req.user._id).select('friends').lean();
      ids = [req.user._id, ...(me.friends || [])];
    }
    const filter = { $or: [{ host: { $in: ids } }, { players: { $in: ids } }] };
    const tables = await populateTable(Table.find(filter)).sort({ date: -1 });
    res.json({ tables, total: tables.length });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tables/top-games — most-played games in the last 7 days (public)
router.get('/top-games', optionalAuth, async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const games = await Table.aggregate([
      { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: since } } },
      { $group: { _id: '$boardGame', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, game: '$_id', count: 1 } },
    ]);
    res.json(games);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tables/showcase — public; active upcoming tables count + one random table for auth pages
router.get('/showcase', async (req, res) => {
  try {
    const filter = { status: { $ne: 'cancelled' }, date: { $gte: new Date() } };
    const total = await Table.countDocuments(filter);
    let table = null;
    if (total > 0) {
      const skip = Math.floor(Math.random() * total);
      table = await Table.findOne(filter)
        .skip(skip)
        .populate('host', POPULATE_USER_FIELDS)
        .select('boardGame host location date players maxPlayers')
        .lean();
    }
    res.json({ total, table });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tables/showcase — public; active upcoming tables count + one random table for auth pages
router.get('/showcase', async (req, res) => {
  try {
    const filter = { status: { $ne: 'cancelled' }, date: { $gte: new Date() } };
    const total = await Table.countDocuments(filter);
    let table = null;
    if (total > 0) {
      const skip = Math.floor(Math.random() * total);
      table = await Table.findOne(filter)
        .skip(skip)
        .populate('host', POPULATE_USER_FIELDS)
        .select('boardGame host location date players maxPlayers')
        .lean();
    }
    res.json({ total, table });
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
  body('privacy').optional().isIn(['public', 'private']).withMessage('Invalid privacy value'),
], validate, async (req, res) => {
  try {
    const { boardGame, date, maxPlayers, location, description, privacy, bggId, bggThumbnail, bggImage, bggYear } = req.body;

    if (!boardGame || !date || !maxPlayers) {
      return res.status(400).json({ message: 'Game, date and max players are required' });
    }

    const table = await Table.create({
      boardGame,
      date,
      maxPlayers,
      location,
      description,
      privacy: privacy || 'public',
      host: req.user._id,
      players: [],
      bggId: bggId || null,
      bggThumbnail: bggThumbnail || null,
      bggImage: bggImage || null,
      bggYear: bggYear || null,
    });

    await table.populate('host', POPULATE_USER_FIELDS);

    res.status(201).json(table);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tables/:id — public; private tables require auth
router.get('/:id', optionalAuth, [
  param('id').isMongoId().withMessage('Invalid table ID'),
], validate, async (req, res) => {
  try {
    const table = await populateTable(Table.findById(req.params.id));
    if (!table) return res.status(404).json({ message: 'Table not found' });
    if (table.privacy === 'private' && !req.user) {
      return res.status(403).json({ message: 'Esta mesa es privada' });
    }
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
  body('privacy').optional().isIn(['public', 'private']).withMessage('Invalid privacy value'),
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
    if (req.body.privacy) table.privacy = req.body.privacy;

    await table.save();
    await populateTable(Table.findById(table._id)).then((t) => res.json(t));
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/join — protected
// For public tables: joins directly. For private tables: adds to pendingRequests.
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

    if (table.privacy === 'private') {
      if (table.pendingRequests.some((r) => r.toString() === req.user._id.toString())) {
        return res.status(400).json({ message: 'Ya enviaste una solicitud para unirte a esta mesa' });
      }
      table.pendingRequests.push(req.user._id);
      await table.save();
      const populated = await populateTable(Table.findById(table._id));

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${table.host}`).emit('join:request', {
          tableId: table._id.toString(),
          tableName: table.boardGame,
          requesterUsername: req.user.username,
          timestamp: new Date(),
        });
        saveNotification(table.host, 'join_request', {
          tableId: table._id.toString(),
          tableName: table.boardGame,
          lastRequesterUsername: req.user.username,
        }).catch(() => {});
      }

      return res.json({ requested: true, table: populated });
    }

    table.players.push(req.user._id);
    // Remove from followers if they were following
    const followerIdx = table.followers.findIndex((f) => f.toString() === req.user._id.toString());
    if (followerIdx !== -1) table.followers.splice(followerIdx, 1);
    await table.save();
    const populated = await populateTable(Table.findById(table._id));
    res.json({ requested: false, table: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tables/:id/request — protected; cancel own pending request
router.delete('/:id/request', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    const idx = table.pendingRequests.findIndex((r) => r.toString() === req.user._id.toString());
    if (idx === -1) return res.status(400).json({ message: 'No tenés una solicitud pendiente en esta mesa' });

    table.pendingRequests.splice(idx, 1);
    await table.save();
    const populated = await populateTable(Table.findById(table._id));
    res.json({ requested: false, table: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/requests/:userId/accept — protected, host only
router.post('/:id/requests/:userId/accept', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
  param('userId').isMongoId().withMessage('Invalid user ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    if (table.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Solo el host puede aceptar solicitudes' });
    }

    if (table.status === 'cancelled') {
      return res.status(400).json({ message: 'No se pueden aceptar solicitudes en una mesa cancelada' });
    }

    if (table.players.length >= table.maxPlayers) {
      return res.status(400).json({ message: 'La mesa está llena' });
    }

    const idx = table.pendingRequests.findIndex((r) => r.toString() === req.params.userId);
    if (idx === -1) return res.status(404).json({ message: 'Solicitud no encontrada' });

    table.pendingRequests.splice(idx, 1);
    table.players.push(req.params.userId);
    await table.save();
    const populated = await populateTable(Table.findById(table._id));

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.params.userId}`).emit('join:accepted', {
        tableId: req.params.id,
        tableName: table.boardGame,
        timestamp: new Date(),
      });
      saveNotification(req.params.userId, 'join_accepted', {
        tableId: req.params.id,
        tableName: table.boardGame,
      }).catch(() => {});
    }

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/requests/:userId/reject — protected, host only
router.post('/:id/requests/:userId/reject', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
  param('userId').isMongoId().withMessage('Invalid user ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    if (table.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Solo el host puede rechazar solicitudes' });
    }

    const idx = table.pendingRequests.findIndex((r) => r.toString() === req.params.userId);
    if (idx === -1) return res.status(404).json({ message: 'Solicitud no encontrada' });

    table.pendingRequests.splice(idx, 1);
    await table.save();

    saveNotification(req.params.userId, 'join_rejected', {
      tableId: table._id.toString(),
      tableName: table.boardGame,
    }).catch(() => {});
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.params.userId}`).emit('join:rejected', {
        tableId: table._id.toString(),
        tableName: table.boardGame,
        timestamp: new Date(),
      });
    }

    const populated = await populateTable(Table.findById(table._id));
    res.json(populated);
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
    const populated = await populateTable(Table.findById(table._id));

    // Notify followers that a spot opened
    if (table.players.length < table.maxPlayers && table.followers.length > 0) {
      const io = req.app.get('io');
      if (io) {
        table.followers.forEach((followerId) => {
          io.to(`user:${followerId}`).emit('table:spot-opened', {
            tableId: table._id.toString(),
            tableName: table.boardGame,
            timestamp: new Date(),
          });
          saveNotification(followerId, 'spot_opened', {
            tableId: table._id.toString(),
            tableName: table.boardGame,
          }).catch(() => {});
        });
      }
    }

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/follow — protected; toggle follow; any non-member logged-in user
router.post('/:id/follow', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });
    if (table.status === 'cancelled') return res.status(400).json({ message: 'Table is cancelled' });

    const uid = req.user._id.toString();
    if (table.host.toString() === uid || table.players.some((p) => p.toString() === uid)) {
      return res.status(400).json({ message: 'Ya sos miembro de esta mesa' });
    }

    const idx = table.followers.findIndex((f) => f.toString() === uid);
    if (idx !== -1) {
      table.followers.splice(idx, 1);
    } else {
      table.followers.push(req.user._id);
    }

    await table.save();
    res.json({ followers: table.followers, isFollowing: idx === -1 });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tables/:id/react — protected; any logged-in user; toggles/replaces emoji reaction
router.post('/:id/react', protect, [
  param('id').isMongoId().withMessage('Invalid table ID'),
  body('emoji').isIn(['❤️', '🎲', '🔥', '👍', '😄']).withMessage('Invalid emoji'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });
    if (table.status === 'cancelled') return res.status(400).json({ message: 'Table is cancelled' });

    const { emoji } = req.body;
    const uid = req.user._id.toString();
    const existingIdx = table.reactions.findIndex((r) => r.user.toString() === uid);

    if (existingIdx !== -1) {
      if (table.reactions[existingIdx].emoji === emoji) {
        table.reactions.splice(existingIdx, 1);
      } else {
        table.reactions[existingIdx].emoji = emoji;
      }
    } else {
      table.reactions.push({ user: req.user._id, emoji });
    }

    await table.save();
    res.json({ reactions: table.reactions });
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

    const io = req.app.get('io');
    const hostId = req.user._id.toString();
    const recipients = new Set([
      ...table.players.map((p) => p.toString()),
      ...table.followers.map((f) => f.toString()),
    ]);
    recipients.delete(hostId);
    recipients.forEach((userId) => {
      saveNotification(userId, 'table_cancelled', {
        tableId: table._id.toString(),
        tableName: table.boardGame,
      }).catch(() => {});
      if (io) {
        io.to(`user:${userId}`).emit('table:cancelled', {
          tableId: table._id.toString(),
          tableName: table.boardGame,
          timestamp: new Date(),
        });
      }
    });

    res.json({ message: 'Table cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
