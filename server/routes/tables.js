const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const Table = require("../models/Table");
const User = require("../models/User");
const { protect, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { parsePagination } = require("../utils/paginate");
const { emitNotificationReq } = require("../utils/emitNotification");
const {
  isValidCoord,
  attachDistance,
  buildBboxFilter,
} = require("../utils/geo");
const {
  normalizeLocationInput,
  locationForCreate,
} = require("../utils/locationHelpers");

// NOTA: requireSection('mesas') aplica SOLO al router (las rutas de este
// archivo). El helper `listTables` se exporta abajo y se reusa desde
// eventos.js — donde el gate de sección es `'eventos'`, no `'mesas'`.
router.use(requireSection("mesas"));

router.param("id", validateObjectId("id"));
router.param("userId", validateObjectId("userId"));

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const buildSearchClause = async (search) => {
  if (!search) return null;
  const escaped = search.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(escaped, "i");
  const matchingHosts = await User.find({ username: rx }).select("_id");
  return {
    $or: [
      { boardGame: rx },
      { host: { $in: matchingHosts.map((u) => u._id) } },
    ],
  };
};

// Fields exposed for any populated user reference returned by these routes.
// `bggUsername` enables the BG Watch chip/link in TableDetail player chips.
const POPULATE_USER_FIELDS = "username displayName avatar bggUsername";

const populateTable = (query) =>
  query
    .populate("host", POPULATE_USER_FIELDS)
    .populate("players", POPULATE_USER_FIELDS)
    .populate("pendingRequests", POPULATE_USER_FIELDS)
    .populate("images.uploader", "username displayName avatar");

// Los helpers de location (normalizeLocationInput, locationForCreate) viven
// en utils/locationHelpers.js — compartidos con eventos.js.
// Los helpers geo (attachDistance, buildBboxFilter) viven en utils/geo.js.

// Helper reusable que ejecuta el listado de mesas paginado con todas las
// opciones (search, distance, evento). Lo expone tables.js para reuso desde
// el router de eventos (`GET /api/eventos/:id/mesas`). El handler global de
// abajo es un wrapper fino que delega acá.
//
// `eventoId`:
//   - `null`  → solo mesas globales (filtro estricto eventoId:null, también
//               cuenta los docs viejos sin el campo).
//   - String  → solo mesas asociadas a ese evento.
async function listTables({ user, query, eventoId = null }) {
  const { page, limit, skip } = parsePagination(query);
  const searchClause = await buildSearchClause(query.search);
  const privacyFilter = user ? {} : { privacy: { $ne: "private" } };
  const scopeFilter =
    eventoId == null
      ? { $or: [{ eventoId: null }, { eventoId: { $exists: false } }] }
      : { eventoId };
  const baseFilter = {
    status: { $ne: "cancelled" },
    ...privacyFilter,
    ...scopeFilter,
    ...searchClause,
  };

  const userLat = user?.direccion?.lat ?? null;
  const userLng = user?.direccion?.lng ?? null;
  const maxKmRaw = parseFloat(query.maxDistanceKm);
  const maxKm = Number.isFinite(maxKmRaw) && maxKmRaw > 0 ? maxKmRaw : null;
  const filterByDistance = maxKm !== null && isValidCoord(userLat, userLng);

  if (filterByDistance) {
    const bbox = buildBboxFilter(userLat, userLng, maxKm);
    const all = await populateTable(
      Table.find({ ...baseFilter, ...bbox }),
    ).sort({ date: -1 });
    const withDistance = attachDistance(all, userLat, userLng).filter(
      (t) => t.distanceKm !== null && t.distanceKm <= maxKm,
    );
    const total = withDistance.length;
    const slice = withDistance.slice(skip, skip + limit);
    return {
      tables: slice,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  const [tables, total] = await Promise.all([
    populateTable(Table.find(baseFilter))
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Table.countDocuments(baseFilter),
  ]);
  const enriched = attachDistance(tables, userLat, userLng);
  return {
    tables: enriched,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

// GET /api/tables — public (anon sees only public tables); supports ?page, ?limit, ?search
// Solo lista mesas GLOBALES (eventoId:null). Las mesas asociadas a un evento
// se listan via `GET /api/eventos/:id/mesas` y NUNCA aparecen acá.
router.get("/", optionalAuth, async (req, res) => {
  try {
    const result = await listTables({
      user: req.user,
      query: req.query,
      eventoId: null,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/tables/mine — protected; returns tables where user is host or player
router.get("/mine", protect, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const searchClause = await buildSearchClause(req.query.search);
    const baseFilter = {
      $or: [{ host: req.user._id }, { players: req.user._id }],
      status: { $ne: "cancelled" },
    };
    const filter = searchClause
      ? { $and: [baseFilter, searchClause] }
      : baseFilter;
    const [tables, total] = await Promise.all([
      populateTable(Table.find(filter))
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Table.countDocuments(filter),
    ]);
    res.json({ tables, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/me/feed — protected; all tables for current user (all statuses), sorted date desc
// ?includeFriends=true also includes friends' tables
router.get("/me/feed", protect, async (req, res) => {
  try {
    let ids = [req.user._id];
    if (req.query.includeFriends === "true") {
      const me = await User.findById(req.user._id).select("friends").lean();
      ids = [req.user._id, ...(me.friends || [])];
    }
    const filter = { $or: [{ host: { $in: ids } }, { players: { $in: ids } }] };
    const tables = await populateTable(Table.find(filter)).sort({ date: -1 });
    res.json({ tables, total: tables.length });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/tables/top-games — most-played games in the last 7 days (public)
router.get("/top-games", optionalAuth, async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const games = await Table.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: since } } },
      { $group: { _id: "$boardGame", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, game: "$_id", count: 1 } },
    ]);
    res.json(games);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/tables/showcase — public; active upcoming tables count + one random table for auth pages
router.get("/showcase", async (req, res) => {
  try {
    const filter = { status: { $ne: "cancelled" }, date: { $gte: new Date() } };
    const total = await Table.countDocuments(filter);
    let table = null;
    if (total > 0) {
      const skip = Math.floor(Math.random() * total);
      table = await Table.findOne(filter)
        .skip(skip)
        .populate("host", POPULATE_USER_FIELDS)
        .select("boardGame host location date players maxPlayers")
        .lean();
    }
    res.json({ total, table });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/tables — protected
// `location` acepta string (legacy) o { texto, lat, lng } (nuevo).
router.post(
  "/",
  protect,
  [
    body("boardGame")
      .trim()
      .notEmpty()
      .withMessage("Game name is required")
      .isLength({ max: 100 })
      .withMessage("Game name is too long"),
    body("date")
      .notEmpty()
      .withMessage("Date is required")
      .isISO8601()
      .withMessage("Invalid date format"),
    body("maxPlayers")
      .notEmpty()
      .withMessage("Max players is required")
      .isInt({ min: 2, max: 20 })
      .withMessage("Max players must be between 2 and 20"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description is too long"),
    body("privacy")
      .optional()
      .isIn(["public", "private"])
      .withMessage("Invalid privacy value"),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        boardGame,
        date,
        maxPlayers,
        location,
        description,
        privacy,
        bggId,
        bggThumbnail,
        bggImage,
        bggYear,
        eventoId,
      } = req.body;

      if (!boardGame || !date || !maxPlayers) {
        return res
          .status(400)
          .json({ message: "Game, date and max players are required" });
      }

      // Scoping a evento: si se manda `eventoId`, validar permisos contra
      // canActInEvento (admin del sitio | author del evento | confirmed
      // registrant). El evento debe existir, no estar draft/cancelled, y
      // el user debe tener permiso.
      let validatedEventoId = null;
      if (eventoId) {
        const Evento = require("../models/Evento");
        const { canActInEvento } = require("../utils/eventoPermissions");
        const evento = await Evento.findById(eventoId).select(
          "_id author status registrations",
        );
        if (!evento) {
          return res.status(404).json({ message: "Evento no encontrado" });
        }
        if (evento.status === "cancelled" || evento.status === "draft") {
          return res
            .status(400)
            .json({ message: "No podés crear mesas en este evento" });
        }
        if (!canActInEvento(evento, req.user)) {
          return res
            .status(403)
            .json({
              message:
                "Solo inscriptos confirmados pueden crear mesas en este evento",
            });
        }
        validatedEventoId = evento._id;
      }

      const table = await Table.create({
        boardGame,
        date,
        maxPlayers,
        // Fallback al direccion del perfil si el host no especificó ubicación.
        location: locationForCreate(location, req.user.direccion),
        description,
        privacy: privacy || "public",
        host: req.user._id,
        players: [],
        bggId: bggId || null,
        bggThumbnail: bggThumbnail || null,
        bggImage: bggImage || null,
        bggYear: bggYear || null,
        eventoId: validatedEventoId,
      });

      await table.populate("host", POPULATE_USER_FIELDS);

      // Si la mesa es del evento, notificar a los demás confirmados (excepto
      // al host de la mesa, que es el actor). Notificación agregable: si el
      // mismo evento tiene varias mesas creadas, los inscriptos reciben UNA
      // notif con count incrementado. Además broadcast `evento:mesa-created`
      // al room del evento para refrescar el listado en EventoDetail.
      if (validatedEventoId) {
        const Evento = require("../models/Evento");
        const evento = await Evento.findById(validatedEventoId).select(
          "_id title registrations",
        );
        if (evento) {
          const actorId = req.user._id.toString();
          const recipients = (evento.registrations || [])
            .filter((r) => r.status === "confirmed")
            .map((r) => r.user.toString())
            .filter((id) => id !== actorId);
          await Promise.all(
            recipients.map((userId) =>
              emitNotificationReq(
                req,
                userId,
                "evento_mesa_created",
                {
                  eventoId: evento._id.toString(),
                  eventoTitle: evento.title,
                  eventoTableId: table._id.toString(),
                  gameName: table.boardGame,
                  hostUsername: req.user.username,
                },
                "evento:notification",
                { type: "evento_mesa_created" },
              ).catch(() => {}),
            ),
          );
          // Broadcast al room del evento (refresca la tab "Mesas" sin
          // depender de las notifs persistentes).
          const io = req.app.get("io");
          if (io) {
            io.to(`evento:${evento._id}`).emit("evento:mesa-created", {
              eventoId: evento._id.toString(),
              tableId: table._id.toString(),
            });
          }
        }
      }

      res.status(201).json(table);
    } catch (err) {
      if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({ message: messages[0] });
      }
      res.status(500).json({ message: "Server error" });
    }
  },
);

// GET /api/tables/:id — public; private tables require auth
router.get(
  "/:id",
  optionalAuth,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  validate,
  async (req, res) => {
    try {
      const table = await populateTable(Table.findById(req.params.id));
      if (!table) return res.status(404).json({ message: "Table not found" });
      if (table.privacy === "private" && !req.user) {
        return res.status(403).json({ message: "Esta mesa es privada" });
      }
      res.json(table);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// PUT /api/tables/:id — protected, host only
// Solo modifica campos PRESENTES en req.body (partial update — ver
// feedback_put_partial_update.md). `location` acepta string o subdocumento.
router.put(
  "/:id",
  protect,
  [
    param("id").isMongoId().withMessage("Invalid table ID"),
    body("date")
      .notEmpty()
      .withMessage("Date is required")
      .isISO8601()
      .withMessage("Invalid date format"),
    body("maxPlayers")
      .notEmpty()
      .withMessage("Max players is required")
      .isInt({ min: 2, max: 20 })
      .withMessage("Max players must be between 2 and 20"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description is too long"),
    body("privacy")
      .optional()
      .isIn(["public", "private"])
      .withMessage("Invalid privacy value"),
  ],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });

      if (table.status === "cancelled") {
        return res
          .status(400)
          .json({ message: "No se puede editar una mesa cancelada" });
      }

      if (table.host.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Solo el host puede editar esta mesa" });
      }

      const newMaxPlayers = Number(req.body.maxPlayers);
      if (newMaxPlayers < table.players.length) {
        return res.status(400).json({
          message: `No podés reducir los lugares por debajo de los jugadores actuales (${table.players.length})`,
        });
      }

      table.date = req.body.date;
      table.maxPlayers = newMaxPlayers;
      if (Object.prototype.hasOwnProperty.call(req.body, "location")) {
        table.location = normalizeLocationInput(req.body.location) ?? {
          texto: "",
          lat: null,
          lng: null,
        };
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
        table.description = req.body.description || "";
      }
      if (req.body.privacy) table.privacy = req.body.privacy;

      await table.save();
      await populateTable(Table.findById(table._id)).then((t) => res.json(t));
    } catch (err) {
      if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({ message: messages[0] });
      }
      res.status(500).json({ message: "Server error" });
    }
  },
);

// POST /api/tables/:id/join — protected
// For public tables: joins directly. For private tables: adds to pendingRequests.
router.post(
  "/:id/join",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);

      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }

      if (table.status === "cancelled") {
        return res
          .status(400)
          .json({ message: "This table has been cancelled" });
      }

      if (table.host.toString() === req.user._id.toString()) {
        return res
          .status(400)
          .json({ message: "You are the host of this table" });
      }

      if (table.players.some((p) => p.toString() === req.user._id.toString())) {
        return res
          .status(400)
          .json({ message: "You already joined this table" });
      }

      if (table.players.length >= table.maxPlayers) {
        return res.status(400).json({ message: "This table is full" });
      }

      if (table.privacy === "private") {
        if (
          table.pendingRequests.some(
            (r) => r.toString() === req.user._id.toString(),
          )
        ) {
          return res.status(400).json({
            message: "Ya enviaste una solicitud para unirte a esta mesa",
          });
        }
        table.pendingRequests.push(req.user._id);
        await table.save();
        const populated = await populateTable(Table.findById(table._id));

        await emitNotificationReq(
          req,
          table.host,
          "join_request",
          {
            tableId: table._id.toString(),
            tableName: table.boardGame,
            lastRequesterUsername: req.user.username,
          },
          "join:request",
          { requesterUsername: req.user.username },
        ).catch(() => {});

        return res.json({ requested: true, table: populated });
      }

      table.players.push(req.user._id);
      // Remove from followers if they were following
      const followerIdx = table.followers.findIndex(
        (f) => f.toString() === req.user._id.toString(),
      );
      if (followerIdx !== -1) table.followers.splice(followerIdx, 1);
      await table.save();
      const populated = await populateTable(Table.findById(table._id));
      res.json({ requested: false, table: populated });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// DELETE /api/tables/:id/request — protected; cancel own pending request
router.delete(
  "/:id/request",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });

      const idx = table.pendingRequests.findIndex(
        (r) => r.toString() === req.user._id.toString(),
      );
      if (idx === -1)
        return res
          .status(400)
          .json({ message: "No tenés una solicitud pendiente en esta mesa" });

      table.pendingRequests.splice(idx, 1);
      await table.save();
      const populated = await populateTable(Table.findById(table._id));
      res.json({ requested: false, table: populated });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// POST /api/tables/:id/requests/:userId/accept — protected, host only
router.post(
  "/:id/requests/:userId/accept",
  protect,
  [
    param("id").isMongoId().withMessage("Invalid table ID"),
    param("userId").isMongoId().withMessage("Invalid user ID"),
  ],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });

      if (table.host.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Solo el host puede aceptar solicitudes" });
      }

      if (table.status === "cancelled") {
        return res.status(400).json({
          message: "No se pueden aceptar solicitudes en una mesa cancelada",
        });
      }

      if (table.players.length >= table.maxPlayers) {
        return res.status(400).json({ message: "La mesa está llena" });
      }

      const idx = table.pendingRequests.findIndex(
        (r) => r.toString() === req.params.userId,
      );
      if (idx === -1)
        return res.status(404).json({ message: "Solicitud no encontrada" });

      table.pendingRequests.splice(idx, 1);
      table.players.push(req.params.userId);
      await table.save();
      const populated = await populateTable(Table.findById(table._id));

      await emitNotificationReq(
        req,
        req.params.userId,
        "join_accepted",
        { tableId: req.params.id, tableName: table.boardGame },
        "join:accepted",
      ).catch(() => {});

      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// POST /api/tables/:id/requests/:userId/reject — protected, host only
router.post(
  "/:id/requests/:userId/reject",
  protect,
  [
    param("id").isMongoId().withMessage("Invalid table ID"),
    param("userId").isMongoId().withMessage("Invalid user ID"),
  ],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });

      if (table.host.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Solo el host puede rechazar solicitudes" });
      }

      const idx = table.pendingRequests.findIndex(
        (r) => r.toString() === req.params.userId,
      );
      if (idx === -1)
        return res.status(404).json({ message: "Solicitud no encontrada" });

      table.pendingRequests.splice(idx, 1);
      await table.save();

      await emitNotificationReq(
        req,
        req.params.userId,
        "join_rejected",
        { tableId: table._id.toString(), tableName: table.boardGame },
        "join:rejected",
      ).catch(() => {});

      const populated = await populateTable(Table.findById(table._id));
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// POST /api/tables/:id/leave — protected
router.post(
  "/:id/leave",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);

      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }

      const playerIndex = table.players.findIndex(
        (p) => p.toString() === req.user._id.toString(),
      );

      if (playerIndex === -1) {
        return res.status(400).json({ message: "You are not in this table" });
      }

      table.players.splice(playerIndex, 1);
      await table.save();
      const populated = await populateTable(Table.findById(table._id));

      // Notify followers that a spot opened
      if (
        table.players.length < table.maxPlayers &&
        table.followers.length > 0
      ) {
        await Promise.all(
          table.followers.map((followerId) =>
            emitNotificationReq(
              req,
              followerId,
              "spot_opened",
              { tableId: table._id.toString(), tableName: table.boardGame },
              "table:spot-opened",
            ).catch(() => {}),
          ),
        );
      }

      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// POST /api/tables/:id/follow — protected; toggle follow; any non-member logged-in user
router.post(
  "/:id/follow",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      if (table.status === "cancelled")
        return res.status(400).json({ message: "Table is cancelled" });

      const uid = req.user._id.toString();
      if (
        table.host.toString() === uid ||
        table.players.some((p) => p.toString() === uid)
      ) {
        return res.status(400).json({ message: "Ya sos miembro de esta mesa" });
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
      res.status(500).json({ message: "Server error" });
    }
  },
);

// POST /api/tables/:id/react — protected; any logged-in user; toggles/replaces emoji reaction
router.post(
  "/:id/react",
  protect,
  [
    param("id").isMongoId().withMessage("Invalid table ID"),
    body("emoji")
      .isIn(["❤️", "🎲", "🔥", "👍", "😄"])
      .withMessage("Invalid emoji"),
  ],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      if (table.status === "cancelled")
        return res.status(400).json({ message: "Table is cancelled" });

      const { emoji } = req.body;
      const uid = req.user._id.toString();
      const existingIdx = table.reactions.findIndex(
        (r) => r.user.toString() === uid,
      );

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
      res.status(500).json({ message: "Server error" });
    }
  },
);

// DELETE /api/tables/:id — protected, host only
router.delete(
  "/:id",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  validate,
  async (req, res) => {
    try {
      const table = await Table.findById(req.params.id);

      if (!table) {
        return res.status(404).json({ message: "Table not found" });
      }

      if (table.host.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Only the host can cancel this table" });
      }

      table.status = "cancelled";
      await table.save();

      const hostId = req.user._id.toString();
      const recipients = new Set([
        ...table.players.map((p) => p.toString()),
        ...table.followers.map((f) => f.toString()),
      ]);
      recipients.delete(hostId);
      await Promise.all(
        [...recipients].map((userId) =>
          emitNotificationReq(
            req,
            userId,
            "table_cancelled",
            { tableId: table._id.toString(), tableName: table.boardGame },
            "table:cancelled",
          ).catch(() => {}),
        ),
      );

      res.json({ message: "Table cancelled successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
// Exportamos `listTables` para que el router de eventos (`GET /api/eventos/:id/mesas`)
// pueda reutilizar exactamente el mismo pipeline (paginación, search, distance,
// privacy) sin duplicar lógica.
module.exports.listTables = listTables;
