const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Table = require('../models/Table');
const Compartida = require('../models/Compartida');
const { protect, optionalAuth } = require('../middleware/auth');
const { requireSection } = require('../middleware/sectionGate');

router.use(requireSection('comunidad'));

// GET /api/users — public list with optional search, sortBy, activeOnly
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, sortBy, activeOnly, friendsOnly, bgWatchOnly } = req.query;
    const isAdmin = !!req.user?.isAdmin;

    const query = {};
    if (!isAdmin) {
      query.isBanned = { $ne: true };
    }
    if (friendsOnly === 'true' && req.user) {
      query._id = { $in: req.user.friends };
    }
    if (bgWatchOnly === 'true') {
      query.bggUsername = { $exists: true, $nin: [null, ''] };
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { username: regex },
        { displayName: regex },
        { nombre: regex },
        { apellido: regex },
      ];
    }

    const selectFields = isAdmin
      ? 'username displayName nombre apellido avatar telegram celular bggUsername direccion createdAt isAdmin isBanned bannedAt bannedReason'
      : 'username displayName nombre apellido avatar telegram celular bggUsername direccion createdAt';

    let users = await User.find(query)
      .select(selectFields)
      .lean();

    const userIds = users.map((u) => u._id);

    const [hostedCounts, playerCounts, compartidaCounts] = await Promise.all([
      Table.aggregate([
        { $match: { host: { $in: userIds }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$host', count: { $sum: 1 } } },
      ]),
      Table.aggregate([
        { $match: { players: { $in: userIds }, status: { $ne: 'cancelled' } } },
        { $unwind: '$players' },
        { $match: { players: { $in: userIds } } },
        { $group: { _id: '$players', count: { $sum: 1 } } },
      ]),
      Compartida.aggregate([
        { $match: { author: { $in: userIds }, privacy: 'public' } },
        { $group: { _id: '$author', count: { $sum: 1 } } },
      ]),
    ]);

    const hostedMap = {};
    hostedCounts.forEach((h) => { hostedMap[h._id.toString()] = h.count; });

    const playerMap = {};
    playerCounts.forEach((p) => { playerMap[p._id.toString()] = p.count; });

    const compartidaMap = {};
    compartidaCounts.forEach((c) => { compartidaMap[c._id.toString()] = c.count; });

    if (activeOnly === 'true') {
      const activeIds = new Set([
        ...hostedCounts.map((h) => h._id.toString()),
        ...playerCounts.map((p) => p._id.toString()),
      ]);
      users = users.filter((u) => activeIds.has(u._id.toString()));
    }

    users = users.map((u) => ({
      ...u,
      tablesHosted: hostedMap[u._id.toString()] || 0,
      tablesAsPlayer: playerMap[u._id.toString()] || 0,
      compartidas: compartidaMap[u._id.toString()] || 0,
    }));

    if (sortBy === 'activity') {
      users.sort((a, b) => (b.tablesHosted + b.tablesAsPlayer) - (a.tablesHosted + a.tablesAsPlayer));
    } else if (sortBy === 'date_asc') {
      users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'date_desc') {
      users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      users.sort((a, b) => (a.username || '').localeCompare(b.username || '', 'es', { sensitivity: 'base' }));
    }

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// POST /api/users/by-bgg-usernames — batch resolve BGG usernames to Turnocero users.
// Public (no auth). Used by BG Watch surfaces to link play participants to their
// Turnocero profile when they're members. Capped at 50 usernames per request.
router.post('/by-bgg-usernames', async (req, res) => {
  try {
    const raw = Array.isArray(req.body?.usernames) ? req.body.usernames : [];
    const lowered = [...new Set(
      raw
        .filter((u) => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.trim().toLowerCase())
    )].slice(0, 50);

    if (lowered.length === 0) return res.json([]);

    const users = await User.aggregate([
      { $match: { bggUsername: { $exists: true, $nin: [null, ''] }, isBanned: { $ne: true } } },
      {
        $project: {
          _id: 1,
          username: 1,
          displayName: 1,
          avatar: 1,
          bggUsername: 1,
          _lower: { $toLower: '$bggUsername' },
        },
      },
      { $match: { _lower: { $in: lowered } } },
      { $project: { _lower: 0 } },
    ]);

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error al buscar usuarios por BGG' });
  }
});

// GET /api/users/:id — public profile + stats; relationship fields are null for anon
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const isAdmin = !!req.user?.isAdmin;
    const user = await User.findById(req.params.id)
      .select('username displayName nombre apellido avatar telegram celular bggUsername direccion createdAt friendRequests friends isBanned')
      .lean();

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.isBanned && !isAdmin) return res.status(404).json({ message: 'Usuario no encontrado' });

    const userId = user._id;

    const queries = [
      Table.find({ host: userId }).select('boardGame status date createdAt').lean(),
      Table.find({ players: userId }).select('boardGame status date createdAt').lean(),
    ];
    if (req.user) {
      queries.push(User.findById(req.user._id).select('friends friendRequests').lean());
    }

    const [tableResults, compartidaResult] = await Promise.all([
      Promise.all(queries),
      Compartida.aggregate([
        { $match: { author: userId, privacy: 'public' } },
        { $group: { _id: null, count: { $sum: 1 }, likes: { $sum: { $size: '$likes' } } } },
      ]),
    ]);

    const [hostedTables, playerTables, currentUser] = tableResults;
    const compartidaData = compartidaResult[0] || { count: 0, likes: 0 };

    const hostedActive = hostedTables.filter((t) => t.status !== 'cancelled');
    const playerActive = playerTables.filter((t) => t.status !== 'cancelled');

    const gameCounts = {};
    [...hostedActive, ...playerActive].forEach((t) => {
      gameCounts[t.boardGame] = (gameCounts[t.boardGame] || 0) + 1;
    });
    const favoriteGames = Object.entries(gameCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([game, count]) => ({ game, count }));

    const allDates = [...hostedTables, ...playerTables]
      .map((t) => new Date(t.createdAt))
      .sort((a, b) => b - a);
    const lastActivity = allDates[0] || null;

    let relationship = null;
    if (req.user && currentUser) {
      const userIdStr = userId.toString();
      const myIdStr = req.user._id.toString();
      const isFriend = (currentUser?.friends || []).some((f) => f.toString() === userIdStr);
      const requestSent = (user.friendRequests || []).some((r) => r.from.toString() === myIdStr);
      const requestReceived = (currentUser?.friendRequests || []).some((r) => r.from.toString() === userIdStr);
      relationship = isFriend ? 'friends'
        : requestSent ? 'request_sent'
        : requestReceived ? 'request_received'
        : 'none';
    }

    const { friendRequests: _fr, friends: _friends, isBanned: _isBanned, ...userPublic } = user;
    if (isAdmin) userPublic.isBanned = _isBanned;

    res.json({
      ...userPublic,
      relationship,
      friendsCount: (_friends || []).length,
      stats: {
        tablesHosted: {
          total: hostedTables.length,
          open: hostedTables.filter((t) => t.status === 'open').length,
          full: hostedTables.filter((t) => t.status === 'full').length,
          cancelled: hostedTables.filter((t) => t.status === 'cancelled').length,
          active: hostedActive.length,
        },
        tablesAsPlayer: {
          total: playerTables.length,
          active: playerActive.length,
        },
        totalGamesPlayed: hostedActive.length + playerActive.length,
        compartidas: compartidaData.count,
        likesReceived: compartidaData.likes,
        favoriteGames,
        lastActivity,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

module.exports = router;
