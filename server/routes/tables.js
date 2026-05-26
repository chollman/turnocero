const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const Table = require("../models/Table");
const User = require("../models/User");
const { protect, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { parsePagination } = require("../utils/paginate");
const { escapeRegex } = require("../utils/regex");
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
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");

// NOTA: requireSection('mesas') aplica SOLO al router (las rutas de este
// archivo). El helper `listTables` se exporta abajo y se reusa desde
// eventos.js — donde el gate de sección es `'eventos'`, no `'mesas'`.
router.use(requireSection("mesas"));

router.param("id", validateObjectId("id"));
router.param("userId", validateObjectId("userId"));

// Convierte el resultado de express-validator en un httpError 400 con el
// primer mensaje. Usado en TODOS los handlers que tienen middlewares de
// `body()`/`param()` antes del asyncHandler.
function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, errors.array()[0].msg);
}

// Mongoose ValidationError → 400 con el primer mensaje.
function rethrowValidation(err) {
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    throw httpError(400, messages[0]);
  }
  throw err;
}

const buildSearchClause = async (search) => {
  if (!search) return null;
  const rx = new RegExp(escapeRegex(search.slice(0, 100)), "i");
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
router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const result = await listTables({
      user: req.user,
      query: req.query,
      eventoId: null,
    });
    res.json(result);
  }),
);

// GET /api/tables/mine — protected; returns tables where user is host or player
router.get(
  "/mine",
  protect,
  asyncHandler(async (req, res) => {
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
  }),
);

// GET /api/me/feed — protected; all tables for current user (all statuses), sorted date desc
// ?includeFriends=true also includes friends' tables
router.get(
  "/me/feed",
  protect,
  asyncHandler(async (req, res) => {
    let ids = [req.user._id];
    if (req.query.includeFriends === "true") {
      const me = await User.findById(req.user._id).select("friends").lean();
      ids = [req.user._id, ...(me.friends || [])];
    }
    const filter = { $or: [{ host: { $in: ids } }, { players: { $in: ids } }] };
    const tables = await populateTable(Table.find(filter)).sort({ date: -1 });
    res.json({ tables, total: tables.length });
  }),
);

// GET /api/tables/top-games — most-played games in the last 7 days (public)
router.get(
  "/top-games",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const games = await Table.aggregate([
      { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: since } } },
      { $group: { _id: "$boardGame", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, game: "$_id", count: 1 } },
    ]);
    res.json(games);
  }),
);

// GET /api/tables/showcase — public; active upcoming tables count + one random table for auth pages
router.get(
  "/showcase",
  asyncHandler(async (req, res) => {
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
  }),
);

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
    body("rules")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Rules are too long"),
    body("tags")
      .optional()
      .isArray({ max: 5 })
      .withMessage("Cannot have more than 5 tags"),
    body("tags.*")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 30 })
      .withMessage("Each tag must be 1-30 characters"),
    body("privacy")
      .optional()
      .isIn(["public", "private"])
      .withMessage("Invalid privacy value"),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const {
      boardGame,
      date,
      maxPlayers,
      location,
      description,
      rules,
      tags,
      privacy,
      bggId,
      bggThumbnail,
      bggImage,
      bggYear,
      eventoId,
    } = req.body;

    if (!boardGame || !date || !maxPlayers) {
      throw httpError(400, "Game, date and max players are required");
    }

    // Scoping a evento: si se manda `eventoId`, validar permisos contra
    // canActInEvento (admin del sitio | author del evento | confirmed
    // registrant). El evento debe existir, no estar draft/cancelled, y
    // el user debe tener permiso.
    let validatedEventoId = null;
    let eventoLocation = null;
    let resolvedDate = date;
    if (eventoId) {
      const Evento = require("../models/Evento");
      const { canActInEvento } = require("../utils/eventoPermissions");
      const evento = await Evento.findById(eventoId).select(
        "_id author status registrations location eventDate",
      );
      if (!evento) throw httpError(404, "Evento no encontrado");
      if (evento.status === "cancelled" || evento.status === "draft") {
        throw httpError(400, "No podés crear mesas en este evento");
      }
      if (!canActInEvento(evento, req.user)) {
        throw httpError(
          403,
          "Solo inscriptos confirmados pueden crear mesas en este evento",
        );
      }
      validatedEventoId = evento._id;
      // La ubicación de las mesas del evento se hereda del evento (single
      // source of truth). Ignoramos cualquier `location` del body para que
      // un cliente no pueda crear una mesa "del evento" en otra dirección.
      eventoLocation = evento.location
        ? {
            texto: evento.location.texto || "",
            lat: evento.location.lat ?? null,
            lng: evento.location.lng ?? null,
            displayName: evento.location.displayName || "",
          }
        : null;
      // El día se fuerza al del evento; la hora-del-día la elige el host.
      // Defensivo: si un cliente bypassea el form, no puede crear una mesa
      // "del evento" en otra fecha.
      if (evento.eventDate && date) {
        const requested = new Date(date);
        const base = new Date(evento.eventDate);
        if (!Number.isNaN(requested.getTime())) {
          base.setHours(
            requested.getHours(),
            requested.getMinutes(),
            requested.getSeconds(),
            0,
          );
          resolvedDate = base;
        } else {
          resolvedDate = base;
        }
      } else if (evento.eventDate) {
        resolvedDate = evento.eventDate;
      }
    }

    let table;
    try {
      table = await Table.create({
        boardGame,
        date: resolvedDate,
        maxPlayers,
        // Si la mesa está dentro de un evento, location = location del evento.
        // Si no, fallback al direccion del perfil si el host no especificó.
        location: validatedEventoId
          ? eventoLocation
          : locationForCreate(location, req.user.direccion),
        description,
        rules: rules || "",
        tags: Array.isArray(tags) ? tags : [],
        privacy: privacy || "public",
        host: req.user._id,
        players: [],
        bggId: bggId || null,
        bggThumbnail: bggThumbnail || null,
        bggImage: bggImage || null,
        bggYear: bggYear || null,
        eventoId: validatedEventoId,
      });
    } catch (err) {
      rethrowValidation(err);
    }

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
  }),
);

// GET /api/tables/:id — public; private tables require auth
router.get(
  "/:id",
  optionalAuth,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  asyncHandler(async (req, res) => {
    checkValidation(req);
    const table = await populateTable(Table.findById(req.params.id));
    if (!table) throw httpError(404, "Table not found");
    if (table.privacy === "private" && !req.user) {
      throw httpError(403, "Esta mesa es privada");
    }
    res.json(table);
  }),
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
    body("rules")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Rules are too long"),
    body("tags")
      .optional()
      .isArray({ max: 5 })
      .withMessage("Cannot have more than 5 tags"),
    body("tags.*")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 30 })
      .withMessage("Each tag must be 1-30 characters"),
    body("privacy")
      .optional()
      .isIn(["public", "private"])
      .withMessage("Invalid privacy value"),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    if (table.status === "cancelled") {
      throw httpError(400, "No se puede editar una mesa cancelada");
    }

    if (!isSameId(table.host, req.user._id)) {
      throw httpError(403, "Solo el host puede editar esta mesa");
    }

    const newMaxPlayers = Number(req.body.maxPlayers);
    if (newMaxPlayers < table.players.length) {
      throw httpError(
        400,
        `No podés reducir los lugares por debajo de los jugadores actuales (${table.players.length})`,
      );
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
    if (Object.prototype.hasOwnProperty.call(req.body, "rules")) {
      table.rules = req.body.rules || "";
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "tags")) {
      table.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
    }
    if (req.body.privacy) table.privacy = req.body.privacy;

    try {
      await table.save();
    } catch (err) {
      rethrowValidation(err);
    }
    const populated = await populateTable(Table.findById(table._id));
    res.json(populated);
  }),
);

// POST /api/tables/:id/join — protected
// For public tables: joins directly. For private tables: adds to pendingRequests.
router.post(
  "/:id/join",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    if (table.status === "cancelled") {
      throw httpError(400, "This table has been cancelled");
    }

    if (isSameId(table.host, req.user._id)) {
      throw httpError(400, "You are the host of this table");
    }

    if (table.players.some((p) => isSameId(p, req.user._id))) {
      throw httpError(400, "You already joined this table");
    }

    if (table.players.length >= table.maxPlayers) {
      throw httpError(400, "This table is full");
    }

    if (table.privacy === "private") {
      if (table.pendingRequests.some((r) => isSameId(r, req.user._id))) {
        throw httpError(
          400,
          "Ya enviaste una solicitud para unirte a esta mesa",
        );
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
    const followerIdx = table.followers.findIndex((f) =>
      isSameId(f, req.user._id),
    );
    if (followerIdx !== -1) table.followers.splice(followerIdx, 1);
    await table.save();
    const populated = await populateTable(Table.findById(table._id));
    res.json({ requested: false, table: populated });
  }),
);

// DELETE /api/tables/:id/request — protected; cancel own pending request
router.delete(
  "/:id/request",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    const idx = table.pendingRequests.findIndex((r) =>
      isSameId(r, req.user._id),
    );
    if (idx === -1) {
      throw httpError(400, "No tenés una solicitud pendiente en esta mesa");
    }

    table.pendingRequests.splice(idx, 1);
    await table.save();
    const populated = await populateTable(Table.findById(table._id));
    res.json({ requested: false, table: populated });
  }),
);

// POST /api/tables/:id/requests/:userId/accept — protected, host only
router.post(
  "/:id/requests/:userId/accept",
  protect,
  [
    param("id").isMongoId().withMessage("Invalid table ID"),
    param("userId").isMongoId().withMessage("Invalid user ID"),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    if (!isSameId(table.host, req.user._id)) {
      throw httpError(403, "Solo el host puede aceptar solicitudes");
    }

    if (table.status === "cancelled") {
      throw httpError(
        400,
        "No se pueden aceptar solicitudes en una mesa cancelada",
      );
    }

    if (table.players.length >= table.maxPlayers) {
      throw httpError(400, "La mesa está llena");
    }

    const idx = table.pendingRequests.findIndex((r) =>
      isSameId(r, req.params.userId),
    );
    if (idx === -1) throw httpError(404, "Solicitud no encontrada");

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
  }),
);

// POST /api/tables/:id/requests/:userId/reject — protected, host only
router.post(
  "/:id/requests/:userId/reject",
  protect,
  [
    param("id").isMongoId().withMessage("Invalid table ID"),
    param("userId").isMongoId().withMessage("Invalid user ID"),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    if (!isSameId(table.host, req.user._id)) {
      throw httpError(403, "Solo el host puede rechazar solicitudes");
    }

    const idx = table.pendingRequests.findIndex((r) =>
      isSameId(r, req.params.userId),
    );
    if (idx === -1) throw httpError(404, "Solicitud no encontrada");

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
  }),
);

// POST /api/tables/:id/leave — protected
router.post(
  "/:id/leave",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    const playerIndex = table.players.findIndex((p) =>
      isSameId(p, req.user._id),
    );

    if (playerIndex === -1) {
      throw httpError(400, "You are not in this table");
    }

    table.players.splice(playerIndex, 1);
    await table.save();
    const populated = await populateTable(Table.findById(table._id));

    // Notify followers that a spot opened
    if (table.players.length < table.maxPlayers && table.followers.length > 0) {
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
  }),
);

// POST /api/tables/:id/follow — protected; toggle follow; any non-member logged-in user
router.post(
  "/:id/follow",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");
    if (table.status === "cancelled") {
      throw httpError(400, "Table is cancelled");
    }

    if (
      isSameId(table.host, req.user._id) ||
      table.players.some((p) => isSameId(p, req.user._id))
    ) {
      throw httpError(400, "Ya sos miembro de esta mesa");
    }

    const idx = table.followers.findIndex((f) => isSameId(f, req.user._id));
    if (idx !== -1) {
      table.followers.splice(idx, 1);
    } else {
      table.followers.push(req.user._id);
    }

    await table.save();
    res.json({ followers: table.followers, isFollowing: idx === -1 });
  }),
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
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");
    if (table.status === "cancelled") {
      throw httpError(400, "Table is cancelled");
    }

    const { emoji } = req.body;
    const existingIdx = table.reactions.findIndex((r) =>
      isSameId(r.user, req.user._id),
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
  }),
);

// DELETE /api/tables/:id — protected, host only
router.delete(
  "/:id",
  protect,
  [param("id").isMongoId().withMessage("Invalid table ID")],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    if (!isSameId(table.host, req.user._id)) {
      throw httpError(403, "Only the host can cancel this table");
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
  }),
);

module.exports = router;
// Exportamos `listTables` para que el router de eventos (`GET /api/eventos/:id/mesas`)
// pueda reutilizar exactamente el mismo pipeline (paginación, search, distance,
// privacy) sin duplicar lógica.
module.exports.listTables = listTables;
