const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Table = require('../models/Table');
const { protect, optionalAuth } = require('../middleware/auth');

// GET /api/users — public list with optional search, sortBy, activeOnly
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, sortBy, activeOnly } = req.query;

    const query = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { username: regex },
        { displayName: regex },
        { nombre: regex },
        { apellido: regex },
      ];
    }

    let users = await User.find(query)
      .select('username displayName nombre apellido telegram celular direccion createdAt')
      .lean();

    const userIds = users.map((u) => u._id);

    const [hostedCounts, playerCounts] = await Promise.all([
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
    ]);

    const hostedMap = {};
    hostedCounts.forEach((h) => { hostedMap[h._id.toString()] = h.count; });

    const playerMap = {};
    playerCounts.forEach((p) => { playerMap[p._id.toString()] = p.count; });

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
    }));

    if (sortBy === 'activity') {
      users.sort((a, b) => (b.tablesHosted + b.tablesAsPlayer) - (a.tablesHosted + a.tablesAsPlayer));
    } else if (sortBy === 'date_asc') {
      users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
      users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// GET /api/users/:id — public profile + stats; relationship fields are null for anon
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username displayName nombre apellido telegram celular bggUsername direccion createdAt friendRequests friends')
      .lean();

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const userId = user._id;

    const queries = [
      Table.find({ host: userId }).select('boardGame status date createdAt').lean(),
      Table.find({ players: userId }).select('boardGame status date createdAt').lean(),
    ];
    if (req.user) {
      queries.push(User.findById(req.user._id).select('friends friendRequests').lean());
    }

    const [hostedTables, playerTables, currentUser] = await Promise.all(queries);

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

    const { friendRequests: _fr, friends: _friends, ...userPublic } = user;

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
        favoriteGames,
        lastActivity,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

module.exports = router;
