const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");
const Table = require("../models/Table");
const Compartida = require("../models/Compartida");
const Community = require("../models/Community");
const { optionalAuth, protect } = require("../middleware/auth");
const { resolveCommunities } = require("../middleware/resolveCommunities");
const validateObjectId = require("../middleware/validateObjectId");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { parsePagination } = require("../utils/paginate");
const { escapeRegex } = require("../utils/regex");
const { isSameId } = require("../utils/idCompare");
const { resolveUsersByBggUsernames } = require("../services/userLookup");
const { isSectionEnabled } = require("../utils/siteConfig");
const communityService = require("../services/communityService");

// NOTA: este router NO se gatea a nivel router. `GET /api/users` (sin
// `?community`) es infraestructura compartida — lo consumen DMs, búsqueda de
// participantes de torneos, BG Watch y los perfiles linkeados desde
// notificaciones. La sección `comunidad` solo restringe la vista de miembros
// POR comunidad (`?community=<id>`, ver abajo).
router.param("id", validateObjectId("id"));

// GET /api/users — public list with optional search, sortBy, activeOnly
router.get(
  "/",
  optionalAuth,
  resolveCommunities,
  asyncHandler(async (req, res) => {
    const { search, sortBy, activeOnly, friendsOnly, bgWatchOnly, community } =
      req.query;
    const isAdmin = !!req.user?.isAdmin;

    const query = {};
    if (!isAdmin) {
      query.isBanned = { $ne: true };
    }

    // ── Vista de miembros de una comunidad (lista de /comunidades/:slug) ──
    // Solo cuando viene `?community`. Gateada por la sección `comunidad`
    // (global Y per-comunidad) y restringida a miembros de esa comunidad.
    // Los admins bypassean todos los gates.
    if (community) {
      if (!mongoose.isValidObjectId(community)) {
        throw httpError(400, "Comunidad inválida");
      }
      if (!isAdmin && !isSectionEnabled("comunidad")) {
        throw httpError(403, "Sección deshabilitada");
      }
      const targetCommunity = await Community.findById(community);
      if (!targetCommunity) throw httpError(404, "Comunidad no encontrada");
      if (!isAdmin && targetCommunity.sections?.get("comunidad") === false) {
        throw httpError(403, "Sección deshabilitada");
      }
      if (
        !isAdmin &&
        !communityService.isMember(req.user, targetCommunity._id)
      ) {
        throw httpError(403, "No sos miembro de esta comunidad");
      }
      query["communityMemberships.community"] = targetCommunity._id;
    }

    if (friendsOnly === "true" && req.user) {
      query._id = { $in: req.user.friends };
    }
    if (bgWatchOnly === "true") {
      query.bggUsername = { $exists: true, $nin: [null, ""] };
    }
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { username: regex },
        { displayName: regex },
        { nombre: regex },
        { apellido: regex },
      ];
    }

    const selectFields = isAdmin
      ? "username displayName nombre apellido avatar telegram celular bggUsername direccion createdAt isAdmin isBanned bannedAt bannedReason"
      : "username displayName nombre apellido avatar telegram celular bggUsername direccion createdAt";

    let users = await User.find(query).select(selectFields).lean();

    const userIds = users.map((u) => u._id);

    // Scope de los conteos de actividad (mesas / compartidas). Si se pide una
    // comunidad puntual (`?community`, vista de miembros), los números son de
    // ESA comunidad; si no, de las comunidades que el viewer está viendo (en
    // modo tenant = la del subdominio). `req.viewingCommunities` lo puebla
    // `resolveCommunities`. Las agregaciones no castean strings → ObjectId.
    const countScope = community
      ? [new mongoose.Types.ObjectId(String(community))]
      : req.viewingCommunities || [];
    const inScope = { community: { $in: countScope } };

    const [hostedCounts, playerCounts, compartidaCounts] = await Promise.all([
      Table.aggregate([
        {
          $match: {
            host: { $in: userIds },
            status: { $ne: "cancelled" },
            ...inScope,
          },
        },
        { $group: { _id: "$host", count: { $sum: 1 } } },
      ]),
      Table.aggregate([
        {
          $match: {
            players: { $in: userIds },
            status: { $ne: "cancelled" },
            ...inScope,
          },
        },
        { $unwind: "$players" },
        { $match: { players: { $in: userIds } } },
        { $group: { _id: "$players", count: { $sum: 1 } } },
      ]),
      Compartida.aggregate([
        { $match: { author: { $in: userIds }, privacy: "public", ...inScope } },
        { $group: { _id: "$author", count: { $sum: 1 } } },
      ]),
    ]);

    const hostedMap = {};
    hostedCounts.forEach((h) => {
      hostedMap[h._id.toString()] = h.count;
    });

    const playerMap = {};
    playerCounts.forEach((p) => {
      playerMap[p._id.toString()] = p.count;
    });

    const compartidaMap = {};
    compartidaCounts.forEach((c) => {
      compartidaMap[c._id.toString()] = c.count;
    });

    if (activeOnly === "true") {
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

    if (sortBy === "activity") {
      users.sort(
        (a, b) =>
          b.tablesHosted +
          b.tablesAsPlayer -
          (a.tablesHosted + a.tablesAsPlayer),
      );
    } else if (sortBy === "date_asc") {
      users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === "date_desc") {
      users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      users.sort((a, b) =>
        (a.username || "").localeCompare(b.username || "", "es", {
          sensitivity: "base",
        }),
      );
    }

    res.json(users);
  }),
);

// GET /api/users/jugadores — buscador liviano de usuarios para vincular como
// jugador al cargar una partida en BG Watch. Amigos primero, luego con BGG
// conectado, luego el resto (alfabético). Excluye al propio usuario y baneados.
// Solo los que tienen `bggUsername` se pueden vincular (el front fija
// player.username = su bggUsername); el resto se ofrece como nombre suelto.
router.get(
  "/jugadores",
  protect,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 15,
      maxLimit: 30,
    });
    const friends = (req.user.friends || []).map(
      (f) => new mongoose.Types.ObjectId(String(f)),
    );

    const match = {
      isBanned: { $ne: true },
      _id: { $ne: new mongoose.Types.ObjectId(String(req.user._id)) },
    };
    const q = (req.query.q || "").trim();
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      match.$or = [
        { username: regex },
        { displayName: regex },
        { nombre: regex },
        { apellido: regex },
      ];
    }

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          isFriend: { $in: ["$_id", friends] },
          hasBgg: {
            $and: [
              { $ne: ["$bggUsername", null] },
              { $ne: ["$bggUsername", ""] },
            ],
          },
        },
      },
      { $sort: { isFriend: -1, hasBgg: -1, displayName: 1, username: 1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                username: 1,
                displayName: 1,
                avatar: 1,
                bggUsername: 1,
                isFriend: 1,
              },
            },
          ],
          total: [{ $count: "n" }],
        },
      },
    ];

    const [result] = await User.aggregate(pipeline);
    const total = result?.total?.[0]?.n || 0;
    res.json({
      items: result?.items || [],
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }),
);

// POST /api/users/by-bgg-usernames — batch resolve BGG usernames to Turnocero users.
// Public (no auth). Used by BG Watch surfaces to link play participants to their
// Turnocero profile when they're members. Capped at 50 usernames per request.
router.post(
  "/by-bgg-usernames",
  asyncHandler(async (req, res) => {
    const raw = Array.isArray(req.body?.usernames) ? req.body.usernames : [];
    const users = await resolveUsersByBggUsernames(raw, { cap: 50 });
    res.json(users);
  }),
);

// GET /api/users/:id — public profile + stats; relationship fields are null for anon
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = !!req.user?.isAdmin;
    const user = await User.findById(req.params.id)
      .select(
        "username displayName nombre apellido avatar telegram celular bggUsername direccion createdAt friendRequests friends isBanned",
      )
      .lean();

    if (!user) throw httpError(404, "Usuario no encontrado");
    if (user.isBanned && !isAdmin)
      throw httpError(404, "Usuario no encontrado");

    const userId = user._id;

    const queries = [
      Table.find({ host: userId })
        .select("boardGame status date createdAt")
        .lean(),
      Table.find({ players: userId })
        .select("boardGame status date createdAt")
        .lean(),
    ];
    if (req.user) {
      queries.push(
        User.findById(req.user._id).select("friends friendRequests").lean(),
      );
    }

    const [tableResults, compartidaResult] = await Promise.all([
      Promise.all(queries),
      Compartida.aggregate([
        { $match: { author: userId, privacy: "public" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            likes: { $sum: { $size: "$likes" } },
          },
        },
      ]),
    ]);

    const [hostedTables, playerTables, currentUser] = tableResults;
    const compartidaData = compartidaResult[0] || { count: 0, likes: 0 };

    const hostedActive = hostedTables.filter((t) => t.status !== "cancelled");
    const playerActive = playerTables.filter((t) => t.status !== "cancelled");

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
      const isFriend = (currentUser?.friends || []).some((f) =>
        isSameId(f, userId),
      );
      const requestSent = (user.friendRequests || []).some((r) =>
        isSameId(r.from, req.user._id),
      );
      const requestReceived = (currentUser?.friendRequests || []).some((r) =>
        isSameId(r.from, userId),
      );
      relationship = isFriend
        ? "friends"
        : requestSent
          ? "request_sent"
          : requestReceived
            ? "request_received"
            : "none";
    }

    const {
      friendRequests: _fr,
      friends: _friends,
      isBanned: _isBanned,
      ...userPublic
    } = user;
    if (isAdmin) userPublic.isBanned = _isBanned;

    res.json({
      ...userPublic,
      relationship,
      friendsCount: (_friends || []).length,
      stats: {
        tablesHosted: {
          total: hostedTables.length,
          open: hostedTables.filter((t) => t.status === "open").length,
          full: hostedTables.filter((t) => t.status === "full").length,
          cancelled: hostedTables.filter((t) => t.status === "cancelled")
            .length,
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
  }),
);

module.exports = router;
