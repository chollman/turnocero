const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const multer = require("../config/multer");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");
const Torneo = require("../models/Torneo");
const TorneoMatch = require("../models/TorneoMatch");
const TorneoGroup = require("../models/TorneoGroup");
const TorneoGame = require("../models/TorneoGame");
const User = require("../models/User");
const { protect, requireAdmin } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { emitNotificationReq } = require("../utils/emitNotification");

router.use(requireSection("torneos"));

router.param("id", validateObjectId("id"));
router.param("userId", validateObjectId("userId"));
router.param("matchId", validateObjectId("matchId"));
router.param("gameId", validateObjectId("gameId"));
router.param("groupId", validateObjectId("groupId"));
const {
  generateLeagueFixture,
  generateSingleElimBracket,
  computeStandings,
  generateGroupsPhase,
  computeGroupStandings,
  validateNextPhase,
} = require("../utils/tournamentGeneration");

const USER_FIELDS = "username displayName nombre apellido avatar";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

function isAdmin(req) {
  return !!req.user?.isAdmin;
}

/** Hide drafts from non-admins. */
function visibleStatusFilter(req) {
  if (isAdmin(req)) return {};
  return { status: { $ne: "draft" } };
}

/**
 * State transitions allowed.
 * Note: `draft → in_progress` is only valid for `inscriptionMode === 'admin_only'`
 * (validation enforced in the handler, not the table).
 */
const VALID_TRANSITIONS = {
  draft: new Set(["registration", "in_progress"]),
  registration: new Set(["in_progress", "draft"]),
  in_progress: new Set(["finished"]),
  finished: new Set([]),
};

/** Generates and inserts the match documents for a torneo, then patches nextMatch refs. */
async function buildAndInsertMatches(torneo) {
  const ids = torneo.participants.map((p) => p._id || p);
  const raw =
    torneo.format === "league"
      ? generateLeagueFixture(ids)
      : generateSingleElimBracket(ids);

  if (raw.length === 0) {
    throw new Error(
      "No se pudieron generar los partidos: faltan participantes.",
    );
  }

  // Insert without nextMatch refs first.
  const docs = raw.map((m) => ({
    torneo: torneo._id,
    round: m.round,
    matchIndex: m.matchIndex,
    playerA: m.playerA || null,
    playerB: m.playerB || null,
    isUpperSlot: m.isUpperSlot ?? true,
    winner: m.winner || null,
    status: m.status,
    playedAt: m.playedAt || null,
  }));
  const inserted = await TorneoMatch.insertMany(docs);

  // For single_elim, patch nextMatch refs by (round, matchIndex) lookup.
  if (torneo.format === "single_elim") {
    const byKey = new Map(
      inserted.map((doc) => [`${doc.round}-${doc.matchIndex}`, doc]),
    );
    const ops = [];
    raw.forEach((m, idx) => {
      if (!m.nextMatchKey) return;
      const next = byKey.get(m.nextMatchKey);
      if (!next) return;
      ops.push({
        updateOne: {
          filter: { _id: inserted[idx]._id },
          update: { $set: { nextMatch: next._id } },
        },
      });
    });
    if (ops.length > 0) await TorneoMatch.bulkWrite(ops);
  }

  return inserted;
}

/** Builds the groups + games for the given phase of a groups-format torneo. */
async function buildAndInsertGroupsForPhase(
  torneo,
  phaseNumber,
  playerIds,
  tableSizeOverride,
) {
  const tableSize = tableSizeOverride ?? torneo.tableSize;
  const layout = generateGroupsPhase(playerIds, tableSize);
  if (layout.length === 0) throw new Error("No se pudieron armar los grupos.");

  // Insert groups
  const groupDocs = layout.map((g) => ({
    torneo: torneo._id,
    phase: phaseNumber,
    tableNumber: g.tableNumber,
    players: g.players,
    advancedPlayers: [],
    status: "in_progress",
  }));
  const insertedGroups = await TorneoGroup.insertMany(groupDocs);

  // Insert games (P per group)
  const gameDocs = [];
  for (const group of insertedGroups) {
    for (let n = 1; n <= torneo.gamesPerGroup; n++) {
      gameDocs.push({
        torneo: torneo._id,
        group: group._id,
        gameNumber: n,
        results: [],
        status: "pending",
      });
    }
  }
  if (gameDocs.length > 0) await TorneoGame.insertMany(gameDocs);

  return insertedGroups;
}

/** Recursively clears downstream match winners for single_elim when a result is undone. */
async function cascadeClearWinner(
  matchId,
  slotKey /* 'playerA' | 'playerB' */,
) {
  const match = await TorneoMatch.findById(matchId);
  if (!match) return;
  // Capture old winner before clearing slot, to know which slot to clear in *its* nextMatch.
  const wasWinner = match.winner ? String(match.winner) : null;
  match[slotKey] = null;
  // If the match also had a winner already, clear it (it depended on the slot we just nulled).
  if (match.status === "completed" && wasWinner) {
    match.winner = null;
    match.isDraw = false;
    match.status = "pending";
    match.playedAt = null;
  }
  await match.save();

  if (match.nextMatch && wasWinner) {
    const child = await TorneoMatch.findById(match.nextMatch);
    if (!child) return;
    const childSlot = match.isUpperSlot ? "playerA" : "playerB";
    if (child[childSlot] && String(child[childSlot]) === wasWinner) {
      await cascadeClearWinner(child._id, childSlot);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// CRUD básico del torneo
// ─────────────────────────────────────────────────────────────────

// GET /api/torneos — paginated list (?status, ?game, ?page, ?limit)
router.get("/", protect, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter = { ...visibleStatusFilter(req) };
    if (req.query.status) {
      const requested = String(req.query.status);
      if (requested === "draft" && !isAdmin(req)) {
        return res.status(403).json({ message: "Acceso restringido" });
      }
      filter.status = requested;
    }
    if (req.query.game) {
      filter.game = new RegExp(escapeRegex(String(req.query.game)), "i");
    }

    const [torneos, total] = await Promise.all([
      Torneo.find(filter)
        .populate("createdBy", USER_FIELDS)
        .populate("winner", USER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Torneo.countDocuments(filter),
    ]);

    // Add lightweight counts (participants, pending) without populating arrays.
    const summarized = torneos.map((t) => ({
      ...t,
      participantCount: (t.participants || []).length,
      pendingCount: (t.pendingRegistrations || []).length,
      participants: undefined,
      pendingRegistrations: undefined,
      rejectedRegistrations: undefined,
    }));

    res.json({
      torneos: summarized,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: "Error al obtener torneos" });
  }
});

// POST /api/torneos — admin only, multipart with optional image
router.post(
  "/",
  protect,
  requireAdmin,
  multer.single("image"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        game,
        format,
        maxParticipants,
        inscriptionMode,
        tableSize,
        gamesPerGroup,
        qualifiersPerGroup,
      } = req.body;
      if (!title?.trim() || !game?.trim() || !format) {
        return res
          .status(400)
          .json({
            message: "Faltan campos obligatorios (título, juego, formato)",
          });
      }
      if (!["league", "single_elim", "groups"].includes(format)) {
        return res.status(400).json({ message: "Formato inválido" });
      }
      if (
        inscriptionMode &&
        !["open", "admin_only"].includes(inscriptionMode)
      ) {
        return res
          .status(400)
          .json({ message: "Modo de inscripción inválido" });
      }

      let image;
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: "turnocero/torneos",
          transformation: [{ width: 1200, crop: "limit" }],
        });
        image = { url: result.secure_url, publicId: result.public_id };
      }

      const data = {
        title: title.trim(),
        description: description?.trim() || "",
        game: game.trim(),
        format,
        inscriptionMode: inscriptionMode || "open",
        maxParticipants: maxParticipants
          ? Math.max(2, parseInt(maxParticipants))
          : null,
        image,
        createdBy: req.user._id,
      };
      if (format === "groups") {
        data.tableSize = tableSize ? clamp(parseInt(tableSize), 2, 12) : 4;
        data.gamesPerGroup = gamesPerGroup
          ? clamp(parseInt(gamesPerGroup), 1, 12)
          : 3;
        data.qualifiersPerGroup = qualifiersPerGroup
          ? Math.max(1, parseInt(qualifiersPerGroup))
          : 2;
      }

      const torneo = await Torneo.create(data);
      const populated = await Torneo.findById(torneo._id).populate(
        "createdBy",
        USER_FIELDS,
      );
      res.status(201).json(populated);
    } catch (err) {
      res.status(500).json({ message: "Error al crear el torneo" });
    }
  },
);

// GET /api/torneos/:id — admin only
router.get("/:id", protect, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(404).json({ message: "Torneo no encontrado" });
    const torneo = await Torneo.findById(req.params.id)
      .populate("createdBy", USER_FIELDS)
      .populate("participants", USER_FIELDS)
      .populate("pendingRegistrations.user", USER_FIELDS)
      .populate("winner", USER_FIELDS)
      .populate("runnerUp", USER_FIELDS)
      .lean();
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    if (torneo.status === "draft" && !isAdmin(req)) {
      return res.status(404).json({ message: "Torneo no encontrado" });
    }
    // Hide pending registrations from non-admins (privacy).
    if (!isAdmin(req)) {
      torneo.pendingRegistrations = [];
      torneo.rejectedRegistrations = [];
    }
    res.json(torneo);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener el torneo" });
  }
});

// PUT /api/torneos/:id — admin only, metadata + optional new image
router.put(
  "/:id",
  protect,
  requireAdmin,
  multer.single("image"),
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });

      const {
        title,
        description,
        game,
        maxParticipants,
        inscriptionMode,
        tableSize,
        gamesPerGroup,
        qualifiersPerGroup,
      } = req.body;
      if (title?.trim()) torneo.title = title.trim();
      if (typeof description === "string")
        torneo.description = description.trim();
      if (game?.trim()) torneo.game = game.trim();
      if (maxParticipants !== undefined) {
        const n = parseInt(maxParticipants);
        torneo.maxParticipants = Number.isFinite(n) ? Math.max(2, n) : null;
      }
      if (inscriptionMode && ["open", "admin_only"].includes(inscriptionMode)) {
        // Allow toggling inscription mode only while still in draft/registration.
        if (["draft", "registration"].includes(torneo.status)) {
          torneo.inscriptionMode = inscriptionMode;
        }
      }
      // Groups-format config editable only in draft (after that, groups are generated).
      if (torneo.format === "groups" && torneo.status === "draft") {
        if (tableSize !== undefined)
          torneo.tableSize = clamp(parseInt(tableSize), 2, 12);
        if (gamesPerGroup !== undefined)
          torneo.gamesPerGroup = clamp(parseInt(gamesPerGroup), 1, 12);
        if (qualifiersPerGroup !== undefined)
          torneo.qualifiersPerGroup = Math.max(1, parseInt(qualifiersPerGroup));
      }

      if (req.file) {
        if (torneo.image?.publicId) {
          try {
            await cloudinary.uploader.destroy(torneo.image.publicId);
          } catch {
            /* best-effort cleanup */
          }
        }
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: "turnocero/torneos",
          transformation: [{ width: 1200, crop: "limit" }],
        });
        torneo.image = { url: result.secure_url, publicId: result.public_id };
      }

      await torneo.save();
      const populated = await Torneo.findById(torneo._id)
        .populate("createdBy", USER_FIELDS)
        .populate("participants", USER_FIELDS);
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Error al editar el torneo" });
    }
  },
);

// DELETE /api/torneos/:id — admin only, only if draft or has no matches yet
router.delete("/:id", protect, requireAdmin, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id);
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });

    const matchCount = await TorneoMatch.countDocuments({ torneo: torneo._id });
    if (matchCount > 0 && torneo.status !== "draft") {
      return res.status(400).json({
        message:
          "No se puede eliminar: el torneo tiene partidos generados. Cambialo a borrador primero.",
      });
    }

    if (torneo.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(torneo.image.publicId);
      } catch {
        /* best-effort cleanup */
      }
    }
    await TorneoMatch.deleteMany({ torneo: torneo._id });
    await TorneoGame.deleteMany({ torneo: torneo._id });
    await TorneoGroup.deleteMany({ torneo: torneo._id });
    await torneo.deleteOne();

    res.json({ message: "Torneo eliminado" });
  } catch (err) {
    res.status(500).json({ message: "Error al eliminar el torneo" });
  }
});

// ─────────────────────────────────────────────────────────────────
// Inscripción (usuarios) y aprobación (admins)
// ─────────────────────────────────────────────────────────────────

// POST /api/torneos/:id/register — auth user creates a pending registration
router.post("/:id/register", protect, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id);
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    if (torneo.status !== "registration") {
      return res
        .status(400)
        .json({ message: "La inscripción no está abierta" });
    }
    const userId = req.user._id;
    if (torneo.participants.some((p) => String(p) === String(userId))) {
      return res.status(400).json({ message: "Ya estás inscripto" });
    }
    if (
      torneo.pendingRegistrations.some((r) => String(r.user) === String(userId))
    ) {
      return res
        .status(400)
        .json({ message: "Ya tenés una inscripción pendiente" });
    }
    if (
      torneo.maxParticipants &&
      torneo.participants.length >= torneo.maxParticipants
    ) {
      return res
        .status(400)
        .json({ message: "El torneo ya alcanzó el cupo máximo" });
    }
    torneo.pendingRegistrations.push({ user: userId, requestedAt: new Date() });
    // Allow re-applying after a previous rejection.
    torneo.rejectedRegistrations = torneo.rejectedRegistrations.filter(
      (id) => String(id) !== String(userId),
    );
    await torneo.save();
    res.json({
      message: "Inscripción enviada, esperá la aprobación del admin",
    });
  } catch (err) {
    res.status(500).json({ message: "Error al inscribirse" });
  }
});

// DELETE /api/torneos/:id/register — auth user cancels own pending registration
router.delete("/:id/register", protect, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id);
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    const userId = String(req.user._id);
    const before = torneo.pendingRegistrations.length;
    torneo.pendingRegistrations = torneo.pendingRegistrations.filter(
      (r) => String(r.user) !== userId,
    );
    if (torneo.pendingRegistrations.length === before) {
      return res
        .status(400)
        .json({ message: "No tenés una inscripción pendiente" });
    }
    await torneo.save();
    res.json({ message: "Inscripción cancelada" });
  } catch (err) {
    res.status(500).json({ message: "Error al cancelar la inscripción" });
  }
});

// POST /api/torneos/:id/participants/:userId — admin adds a user directly (admin_only mode)
router.post(
  "/:id/participants/:userId",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (torneo.status === "finished") {
        return res
          .status(400)
          .json({ message: "El torneo ya está finalizado" });
      }
      if (torneo.status === "in_progress") {
        return res
          .status(400)
          .json({
            message:
              "No se pueden agregar participantes con el torneo en curso",
          });
      }

      const { userId } = req.params;
      if (!isValidId(userId))
        return res.status(400).json({ message: "Usuario inválido" });

      const user = await User.findById(userId).select(
        "_id username displayName isBanned",
      );
      if (!user)
        return res.status(404).json({ message: "Usuario no encontrado" });
      if (user.isBanned)
        return res
          .status(400)
          .json({ message: "No se puede agregar un usuario suspendido" });

      if (torneo.participants.some((p) => String(p) === String(userId))) {
        return res
          .status(400)
          .json({ message: "El usuario ya es participante" });
      }
      if (
        torneo.maxParticipants &&
        torneo.participants.length >= torneo.maxParticipants
      ) {
        return res
          .status(400)
          .json({ message: "El torneo alcanzó el cupo máximo" });
      }

      // If there's a pending registration for this user, remove it (admin promoted directly).
      torneo.pendingRegistrations = torneo.pendingRegistrations.filter(
        (r) => String(r.user) !== String(userId),
      );
      torneo.rejectedRegistrations = torneo.rejectedRegistrations.filter(
        (id) => String(id) !== String(userId),
      );
      torneo.participants.push(userId);
      await torneo.save();

      const populated = await Torneo.findById(torneo._id)
        .populate("participants", USER_FIELDS)
        .populate("pendingRegistrations.user", USER_FIELDS);
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Error al agregar el participante" });
    }
  },
);

// POST /api/torneos/:id/registrations/:userId/accept — admin
router.post(
  "/:id/registrations/:userId/accept",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (torneo.status !== "registration") {
        return res
          .status(400)
          .json({ message: "La inscripción no está abierta" });
      }
      const { userId } = req.params;
      const idx = torneo.pendingRegistrations.findIndex(
        (r) => String(r.user) === String(userId),
      );
      if (idx < 0)
        return res
          .status(404)
          .json({ message: "No hay inscripción pendiente para ese usuario" });

      if (
        torneo.maxParticipants &&
        torneo.participants.length >= torneo.maxParticipants
      ) {
        return res
          .status(400)
          .json({ message: "El torneo ya alcanzó el cupo máximo" });
      }

      torneo.pendingRegistrations.splice(idx, 1);
      if (!torneo.participants.some((p) => String(p) === String(userId))) {
        torneo.participants.push(userId);
      }
      await torneo.save();

      await emitNotificationReq(
        req,
        userId,
        "tournament_accepted",
        { torneoId: String(torneo._id), torneoTitle: torneo.title },
        "torneo:registration-accepted",
      );

      const populated = await Torneo.findById(torneo._id)
        .populate("participants", USER_FIELDS)
        .populate("pendingRegistrations.user", USER_FIELDS);
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Error al aceptar la inscripción" });
    }
  },
);

// POST /api/torneos/:id/registrations/:userId/reject — admin
router.post(
  "/:id/registrations/:userId/reject",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      const { userId } = req.params;
      const idx = torneo.pendingRegistrations.findIndex(
        (r) => String(r.user) === String(userId),
      );
      if (idx < 0)
        return res
          .status(404)
          .json({ message: "No hay inscripción pendiente para ese usuario" });

      torneo.pendingRegistrations.splice(idx, 1);
      if (
        !torneo.rejectedRegistrations.some(
          (id) => String(id) === String(userId),
        )
      ) {
        torneo.rejectedRegistrations.push(userId);
      }
      await torneo.save();

      await emitNotificationReq(
        req,
        userId,
        "tournament_rejected",
        { torneoId: String(torneo._id), torneoTitle: torneo.title },
        "torneo:registration-rejected",
      );

      const populated = await Torneo.findById(torneo._id).populate(
        "pendingRegistrations.user",
        USER_FIELDS,
      );
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Error al rechazar la inscripción" });
    }
  },
);

// DELETE /api/torneos/:id/participants/:userId — admin removes a participant (only draft/registration)
router.delete(
  "/:id/participants/:userId",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (!["draft", "registration"].includes(torneo.status)) {
        return res
          .status(400)
          .json({
            message:
              "No se pueden remover participantes una vez iniciado el torneo",
          });
      }
      const before = torneo.participants.length;
      torneo.participants = torneo.participants.filter(
        (p) => String(p) !== String(req.params.userId),
      );
      if (torneo.participants.length === before) {
        return res
          .status(404)
          .json({ message: "Ese usuario no es participante" });
      }
      await torneo.save();
      const populated = await Torneo.findById(torneo._id).populate(
        "participants",
        USER_FIELDS,
      );
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Error al remover el participante" });
    }
  },
);

// PATCH /api/torneos/:id/seeds — admin reorders participants (allowed in draft/registration only)
router.patch("/:id/seeds", protect, requireAdmin, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id);
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    if (!["draft", "registration"].includes(torneo.status)) {
      return res
        .status(400)
        .json({
          message: "No se pueden reordenar seeds una vez iniciado el torneo",
        });
    }
    const { participantIds } = req.body;
    if (!Array.isArray(participantIds)) {
      return res
        .status(400)
        .json({ message: "participantIds debe ser un array" });
    }
    const current = new Set(torneo.participants.map((p) => String(p)));
    const incoming = new Set(participantIds.map(String));
    if (
      current.size !== incoming.size ||
      [...current].some((id) => !incoming.has(id))
    ) {
      return res
        .status(400)
        .json({
          message:
            "El orden enviado debe contener exactamente los mismos participantes",
        });
    }
    torneo.participants = participantIds;
    await torneo.save();
    const populated = await Torneo.findById(torneo._id).populate(
      "participants",
      USER_FIELDS,
    );
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Error al reordenar los seeds" });
  }
});

// ─────────────────────────────────────────────────────────────────
// Estado del torneo
// ─────────────────────────────────────────────────────────────────

// PATCH /api/torneos/:id/status — admin changes status; generates matches/groups on registration → in_progress
router.patch("/:id/status", protect, requireAdmin, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id);
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });

    const { status: next } = req.body;
    if (!["draft", "registration", "in_progress", "finished"].includes(next)) {
      return res.status(400).json({ message: "Estado inválido" });
    }
    const allowed = VALID_TRANSITIONS[torneo.status];
    if (!allowed.has(next)) {
      return res
        .status(400)
        .json({
          message: `Transición no permitida: ${torneo.status} → ${next}`,
        });
    }
    // Constraint: draft → in_progress only allowed for admin_only torneos.
    if (
      torneo.status === "draft" &&
      next === "in_progress" &&
      torneo.inscriptionMode !== "admin_only"
    ) {
      return res.status(400).json({
        message:
          'Para arrancar el torneo abrí inscripciones primero, o configurá el modo "Yo agrego participantes".',
      });
    }

    if (next === "in_progress") {
      if (torneo.participants.length < 2) {
        return res
          .status(400)
          .json({ message: "Se necesitan al menos 2 participantes" });
      }
      // Wipe any pre-existing match/group data (e.g., back-and-forth admin testing).
      await TorneoMatch.deleteMany({ torneo: torneo._id });
      await TorneoGame.deleteMany({ torneo: torneo._id });
      await TorneoGroup.deleteMany({ torneo: torneo._id });

      if (torneo.format === "groups") {
        const ids = torneo.participants.map((p) => p._id || p);
        await buildAndInsertGroupsForPhase(torneo, 1, ids);
        torneo.currentPhase = 1;
      } else {
        await buildAndInsertMatches(torneo);
      }
    }

    if (next === "finished") {
      if (torneo.format === "groups") {
        // For groups: winner is top-1 of the only group in the current phase
        // (final phase must have exactly 1 group).
        const finalGroups = await TorneoGroup.find({
          torneo: torneo._id,
          phase: torneo.currentPhase,
        });
        if (finalGroups.length !== 1) {
          return res.status(400).json({
            message:
              "Para finalizar un torneo de Grupos, la fase actual debe tener una sola mesa final.",
          });
        }
        const finalGroup = finalGroups[0];
        const finalGames = await TorneoGame.find({ group: finalGroup._id });
        const standings = computeGroupStandings(finalGames, finalGroup.players);
        torneo.winner = standings[0]?.user || null;
        torneo.runnerUp = standings[1]?.user || null;
      } else {
        const matches = await TorneoMatch.find({ torneo: torneo._id });
        if (torneo.format === "single_elim") {
          const finalRound = matches.reduce((m, x) => Math.max(m, x.round), 0);
          const final = matches.find((m) => m.round === finalRound);
          torneo.winner = final?.winner || null;
          torneo.runnerUp =
            final && final.winner
              ? String(final.playerA) === String(final.winner)
                ? final.playerB
                : final.playerA
              : null;
        } else {
          const standings = computeStandings(matches, torneo.participants);
          torneo.winner = standings[0]?.user || null;
          torneo.runnerUp = standings[1]?.user || null;
        }
      }
    }

    torneo.status = next;
    if (next === "draft") {
      // Going back to draft removes all match/group data and clears podium.
      await TorneoMatch.deleteMany({ torneo: torneo._id });
      await TorneoGame.deleteMany({ torneo: torneo._id });
      await TorneoGroup.deleteMany({ torneo: torneo._id });
      torneo.winner = null;
      torneo.runnerUp = null;
      torneo.currentPhase = 0;
    }
    await torneo.save();

    if (next === "in_progress" || next === "finished") {
      const notifType =
        next === "in_progress" ? "tournament_started" : "tournament_finished";
      const socketEvent =
        next === "in_progress" ? "torneo:started" : "torneo:finished";
      const participantIds = torneo.participants.map((p) =>
        (p._id || p).toString(),
      );
      await Promise.all(
        participantIds.map((userId) =>
          emitNotificationReq(
            req,
            userId,
            notifType,
            { torneoId: torneo._id.toString(), torneoTitle: torneo.title },
            socketEvent,
          ).catch(() => {}),
        ),
      );
    }

    const populated = await Torneo.findById(torneo._id)
      .populate("createdBy", USER_FIELDS)
      .populate("participants", USER_FIELDS)
      .populate("pendingRegistrations.user", USER_FIELDS)
      .populate("winner", USER_FIELDS)
      .populate("runnerUp", USER_FIELDS);
    res.json(populated);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Error al cambiar el estado" });
  }
});

// POST /api/torneos/:id/reset — admin wipes all match/group/game data and regenerates from current participants
router.post("/:id/reset", protect, requireAdmin, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id);
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    if (!["in_progress", "finished"].includes(torneo.status)) {
      return res
        .status(400)
        .json({ message: "Solo se puede reiniciar un torneo ya iniciado" });
    }
    if (torneo.participants.length < 2) {
      return res
        .status(400)
        .json({ message: "Se necesitan al menos 2 participantes" });
    }

    await TorneoMatch.deleteMany({ torneo: torneo._id });
    await TorneoGame.deleteMany({ torneo: torneo._id });
    await TorneoGroup.deleteMany({ torneo: torneo._id });
    torneo.winner = null;
    torneo.runnerUp = null;
    torneo.currentPhase = 0;

    if (torneo.format === "groups") {
      const ids = torneo.participants.map((p) => p._id || p);
      await buildAndInsertGroupsForPhase(torneo, 1, ids);
      torneo.currentPhase = 1;
    } else {
      await buildAndInsertMatches(torneo);
    }
    torneo.status = "in_progress";
    await torneo.save();

    const populated = await Torneo.findById(torneo._id)
      .populate("createdBy", USER_FIELDS)
      .populate("participants", USER_FIELDS)
      .populate("pendingRegistrations.user", USER_FIELDS)
      .populate("winner", USER_FIELDS)
      .populate("runnerUp", USER_FIELDS);
    res.json(populated);
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Error al reiniciar el torneo" });
  }
});

// ─────────────────────────────────────────────────────────────────
// Matches
// ─────────────────────────────────────────────────────────────────

// GET /api/torneos/:id/matches — admin only; populated playerA/B/winner
router.get("/:id/matches", protect, requireAdmin, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id).select("status").lean();
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    if (torneo.status === "draft" && !isAdmin(req)) {
      return res.status(404).json({ message: "Torneo no encontrado" });
    }
    const matches = await TorneoMatch.find({ torneo: req.params.id })
      .populate("playerA", USER_FIELDS)
      .populate("playerB", USER_FIELDS)
      .populate("winner", USER_FIELDS)
      .sort({ round: 1, matchIndex: 1 })
      .lean();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener los partidos" });
  }
});

// POST /api/torneos/:id/matches/:matchId/result — admin records winner or draw
router.post(
  "/:id/matches/:matchId/result",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (torneo.status !== "in_progress") {
        return res.status(400).json({ message: "El torneo no está en curso" });
      }
      const match = await TorneoMatch.findOne({
        _id: req.params.matchId,
        torneo: torneo._id,
      });
      if (!match)
        return res.status(404).json({ message: "Partido no encontrado" });
      if (match.status === "bye")
        return res
          .status(400)
          .json({ message: "Es un bye, no se carga resultado" });
      if (!match.playerA || !match.playerB) {
        return res
          .status(400)
          .json({ message: "Aún faltan jugadores en este partido" });
      }

      const { winnerId, draw } = req.body;

      if (draw) {
        if (torneo.format !== "league") {
          return res
            .status(400)
            .json({ message: "Solo se permite empate en formato liga" });
        }
        match.winner = null;
        match.isDraw = true;
      } else {
        if (!winnerId)
          return res.status(400).json({ message: "Falta winnerId" });
        const a = String(match.playerA);
        const b = String(match.playerB);
        if (String(winnerId) !== a && String(winnerId) !== b) {
          return res
            .status(400)
            .json({
              message: "El ganador debe ser uno de los jugadores del partido",
            });
        }
        match.winner = winnerId;
        match.isDraw = false;
      }

      match.status = "completed";
      match.playedAt = new Date();
      await match.save();

      // Single-elim: advance winner into nextMatch.
      let advancedTo = null;
      if (torneo.format === "single_elim" && match.nextMatch && match.winner) {
        const next = await TorneoMatch.findById(match.nextMatch);
        if (next) {
          if (match.isUpperSlot) next.playerA = match.winner;
          else next.playerB = match.winner;
          await next.save();
          advancedTo = next;
        }

        const winnerId = String(match.winner);
        const loserId =
          String(match.playerA) === winnerId
            ? String(match.playerB)
            : String(match.playerA);

        const finalRound = await getFinalRound(torneo._id);
        const isFinal = match.round === finalRound;

        // Notify winner (advanced) — only if there's another round to play.
        if (!isFinal) {
          await emitNotificationReq(
            req,
            winnerId,
            "tournament_advanced",
            {
              torneoId: String(torneo._id),
              torneoTitle: torneo.title,
              round: match.round,
            },
            "torneo:advanced",
          );
        }
        // Notify loser (eliminated).
        if (loserId && loserId !== "null") {
          await emitNotificationReq(
            req,
            loserId,
            "tournament_eliminated",
            {
              torneoId: String(torneo._id),
              torneoTitle: torneo.title,
              round: match.round,
            },
            "torneo:eliminated",
          );
        }
      }

      const populated = await TorneoMatch.findById(match._id)
        .populate("playerA", USER_FIELDS)
        .populate("playerB", USER_FIELDS)
        .populate("winner", USER_FIELDS)
        .lean();
      res.json({ match: populated, advancedTo });
    } catch (err) {
      res.status(500).json({ message: "Error al registrar el resultado" });
    }
  },
);

// DELETE /api/torneos/:id/matches/:matchId/result — admin undoes a result
router.delete(
  "/:id/matches/:matchId/result",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (torneo.status !== "in_progress") {
        return res.status(400).json({ message: "El torneo no está en curso" });
      }
      const match = await TorneoMatch.findOne({
        _id: req.params.matchId,
        torneo: torneo._id,
      });
      if (!match)
        return res.status(404).json({ message: "Partido no encontrado" });
      if (match.status !== "completed") {
        return res
          .status(400)
          .json({ message: "Este partido no tiene resultado cargado" });
      }

      const previousWinner = match.winner ? String(match.winner) : null;
      match.winner = null;
      match.isDraw = false;
      match.status = "pending";
      match.playedAt = null;
      await match.save();

      // For single_elim, cascade clear the previous winner from the downstream slot.
      if (
        torneo.format === "single_elim" &&
        match.nextMatch &&
        previousWinner
      ) {
        const child = await TorneoMatch.findById(match.nextMatch);
        if (child) {
          const childSlot = match.isUpperSlot ? "playerA" : "playerB";
          if (child[childSlot] && String(child[childSlot]) === previousWinner) {
            await cascadeClearWinner(child._id, childSlot);
          }
        }
      }

      const populated = await TorneoMatch.findById(match._id)
        .populate("playerA", USER_FIELDS)
        .populate("playerB", USER_FIELDS)
        .populate("winner", USER_FIELDS)
        .lean();
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Error al deshacer el resultado" });
    }
  },
);

// GET /api/torneos/:id/standings — admin only (computed standings for league)
router.get("/:id/standings", protect, requireAdmin, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id).lean();
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    if (torneo.status === "draft" && !isAdmin(req)) {
      return res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (torneo.format !== "league") {
      return res.json({ format: torneo.format, standings: [] });
    }
    const matches = await TorneoMatch.find({ torneo: torneo._id }).lean();
    const standings = computeStandings(matches, torneo.participants);
    res.json({ format: torneo.format, standings });
  } catch (err) {
    res.status(500).json({ message: "Error al calcular las posiciones" });
  }
});

// ─────────────────────────────────────────────────────────────────
// Groups (formato 'groups')
// ─────────────────────────────────────────────────────────────────

// GET /api/torneos/:id/groups — admin only; returns all groups for a phase + their games + standings
router.get("/:id/groups", protect, requireAdmin, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id).lean();
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    if (torneo.status === "draft" && !isAdmin(req)) {
      return res.status(404).json({ message: "Torneo no encontrado" });
    }
    if (torneo.format !== "groups") {
      return res.json({ phase: 0, totalPhases: 0, groups: [] });
    }
    const phase = parseInt(req.query.phase) || torneo.currentPhase || 1;
    const totalPhases = await TorneoGroup.distinct("phase", {
      torneo: torneo._id,
    });

    const groups = await TorneoGroup.find({ torneo: torneo._id, phase })
      .populate("players", USER_FIELDS)
      .populate("advancedPlayers", USER_FIELDS)
      .sort({ tableNumber: 1 })
      .lean();

    // Attach games + standings to each group
    const enriched = await Promise.all(
      groups.map(async (group) => {
        const games = await TorneoGame.find({ group: group._id })
          .populate("results.player", USER_FIELDS)
          .sort({ gameNumber: 1 })
          .lean();
        const standings = computeGroupStandings(games, group.players);
        return { ...group, games, standings };
      }),
    );

    res.json({
      phase,
      totalPhases: totalPhases.length,
      currentPhase: torneo.currentPhase,
      gamesPerGroup: torneo.gamesPerGroup,
      qualifiersPerGroup: torneo.qualifiersPerGroup,
      tableSize: torneo.tableSize,
      groups: enriched,
    });
  } catch (err) {
    res.status(500).json({ message: "Error al cargar los grupos" });
  }
});

// POST /api/torneos/:id/games/:gameId/result — admin records score for each player in a game
router.post(
  "/:id/games/:gameId/result",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (torneo.format !== "groups") {
        return res
          .status(400)
          .json({ message: "Este endpoint es solo para torneos por grupos" });
      }
      if (torneo.status !== "in_progress") {
        return res.status(400).json({ message: "El torneo no está en curso" });
      }

      const game = await TorneoGame.findOne({
        _id: req.params.gameId,
        torneo: torneo._id,
      });
      if (!game)
        return res.status(404).json({ message: "Partida no encontrada" });

      const { results } = req.body;
      if (!Array.isArray(results) || results.length === 0) {
        return res
          .status(400)
          .json({ message: "Falta el array de resultados" });
      }

      const group = await TorneoGroup.findById(game.group);
      if (!group)
        return res.status(404).json({ message: "Grupo no encontrado" });

      const validPlayerIds = new Set(group.players.map((id) => String(id)));
      const playerIdsSeen = new Set();
      const parsed = [];
      for (const r of results) {
        const playerId = String(r.playerId || r.player);
        if (!validPlayerIds.has(playerId)) {
          return res
            .status(400)
            .json({
              message: "Un resultado contiene un jugador que no es del grupo",
            });
        }
        if (playerIdsSeen.has(playerId)) {
          return res
            .status(400)
            .json({ message: "Hay jugadores duplicados en los resultados" });
        }
        playerIdsSeen.add(playerId);
        const score = Number(r.score);
        if (!Number.isFinite(score)) {
          return res
            .status(400)
            .json({ message: "Todos los scores deben ser números válidos" });
        }
        parsed.push({ player: playerId, score });
      }
      if (parsed.length !== group.players.length) {
        return res
          .status(400)
          .json({
            message: "Hay que cargar el score de todos los jugadores del grupo",
          });
      }

      // Derive positions: highest score = 1, ties get same position (1, 1, 3, 4 style).
      const sortedByScore = [...parsed].sort((a, b) => b.score - a.score);
      let pos = 0;
      let lastScore = null;
      sortedByScore.forEach((r, idx) => {
        if (r.score !== lastScore) {
          pos = idx + 1;
          lastScore = r.score;
        }
        r.position = pos;
      });

      game.results = parsed;
      game.status = "completed";
      game.playedAt = new Date();
      await game.save();

      // If all P games of this group are completed → mark group completed.
      // If this group is the ONLY one in its phase, it's the final mesa: skip
      // auto-assigning advancedPlayers (the admin should click "Finalizar torneo"
      // and the top-1 of the standings becomes the champion).
      const allGames = await TorneoGame.find({ group: group._id });
      if (allGames.every((g) => g.status === "completed")) {
        group.status = "completed";
        group.completedAt = new Date();
        const groupsInPhase = await TorneoGroup.countDocuments({
          torneo: torneo._id,
          phase: group.phase,
        });
        const isFinalTable = groupsInPhase === 1;
        if (!isFinalTable) {
          const standings = computeGroupStandings(allGames, group.players);
          group.advancedPlayers = standings
            .slice(0, torneo.qualifiersPerGroup)
            .map((s) => s.user);
        } else {
          group.advancedPlayers = [];
        }
        await group.save();
      } else if (group.status === "pending") {
        group.status = "in_progress";
        await group.save();
      }

      const populated = await TorneoGame.findById(game._id)
        .populate("results.player", USER_FIELDS)
        .lean();
      res.json({ game: populated, group: group.toObject() });
    } catch (err) {
      res.status(500).json({ message: "Error al registrar el resultado" });
    }
  },
);

// DELETE /api/torneos/:id/games/:gameId/result — admin undoes a game result
router.delete(
  "/:id/games/:gameId/result",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (torneo.format !== "groups") {
        return res
          .status(400)
          .json({ message: "Este endpoint es solo para torneos por grupos" });
      }
      if (torneo.status !== "in_progress") {
        return res.status(400).json({ message: "El torneo no está en curso" });
      }

      const game = await TorneoGame.findOne({
        _id: req.params.gameId,
        torneo: torneo._id,
      });
      if (!game)
        return res.status(404).json({ message: "Partida no encontrada" });

      const group = await TorneoGroup.findById(game.group);
      if (!group)
        return res.status(404).json({ message: "Grupo no encontrado" });

      // Can't undo if next phase is already generated past this group.
      const nextPhaseExists = await TorneoGroup.exists({
        torneo: torneo._id,
        phase: { $gt: group.phase },
      });
      if (nextPhaseExists) {
        return res
          .status(400)
          .json({
            message: "No se puede deshacer: ya se generó la siguiente fase",
          });
      }

      game.results = [];
      game.status = "pending";
      game.playedAt = null;
      await game.save();

      // Group goes back to in_progress; clear advancedPlayers.
      if (group.status === "completed") {
        group.status = "in_progress";
        group.completedAt = null;
        group.advancedPlayers = [];
        await group.save();
      }

      res.json({
        message: "Resultado deshecho",
        gameId: game._id,
        groupId: group._id,
      });
    } catch (err) {
      res.status(500).json({ message: "Error al deshacer el resultado" });
    }
  },
);

// PATCH /api/torneos/:id/groups/:groupId/advanced — admin edits the list of advanced players
router.patch(
  "/:id/groups/:groupId/advanced",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id);
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (torneo.format !== "groups") {
        return res
          .status(400)
          .json({ message: "Este endpoint es solo para torneos por grupos" });
      }

      const group = await TorneoGroup.findOne({
        _id: req.params.groupId,
        torneo: torneo._id,
      });
      if (!group)
        return res.status(404).json({ message: "Grupo no encontrado" });
      if (group.status !== "completed") {
        return res.status(400).json({ message: "El grupo todavía no terminó" });
      }
      const nextPhaseExists = await TorneoGroup.exists({
        torneo: torneo._id,
        phase: { $gt: group.phase },
      });
      if (nextPhaseExists) {
        return res
          .status(400)
          .json({
            message:
              "No se pueden editar los promovidos: ya se generó la siguiente fase",
          });
      }

      const { advancedPlayers } = req.body;
      if (!Array.isArray(advancedPlayers)) {
        return res
          .status(400)
          .json({ message: "advancedPlayers debe ser un array" });
      }

      const playerSet = new Set(group.players.map((id) => String(id)));
      for (const id of advancedPlayers) {
        if (!playerSet.has(String(id))) {
          return res
            .status(400)
            .json({ message: "Hay un usuario que no pertenece al grupo" });
        }
      }

      group.advancedPlayers = advancedPlayers;
      await group.save();

      const populated = await TorneoGroup.findById(group._id)
        .populate("advancedPlayers", USER_FIELDS)
        .lean();
      res.json(populated);
    } catch (err) {
      res.status(500).json({ message: "Error al actualizar los promovidos" });
    }
  },
);

// POST /api/torneos/:id/next-phase — admin generates the next phase from current-phase advancers
router.post("/:id/next-phase", protect, requireAdmin, async (req, res) => {
  try {
    const torneo = await Torneo.findById(req.params.id);
    if (!torneo)
      return res.status(404).json({ message: "Torneo no encontrado" });
    if (torneo.format !== "groups") {
      return res
        .status(400)
        .json({ message: "Este endpoint es solo para torneos por grupos" });
    }
    if (torneo.status !== "in_progress") {
      return res.status(400).json({ message: "El torneo no está en curso" });
    }

    const phase = torneo.currentPhase;
    const groups = await TorneoGroup.find({ torneo: torneo._id, phase });
    if (groups.length === 0) {
      return res
        .status(400)
        .json({ message: "No hay grupos en la fase actual" });
    }
    if (groups.some((g) => g.status !== "completed")) {
      return res
        .status(400)
        .json({ message: "Hay grupos sin terminar en la fase actual" });
    }

    const advancers = [];
    for (const g of groups) {
      if (!g.advancedPlayers || g.advancedPlayers.length === 0) {
        return res
          .status(400)
          .json({
            message: `El grupo de la mesa #${g.tableNumber} no tiene promovidos`,
          });
      }
      for (const p of g.advancedPlayers) advancers.push(p);
    }
    if (await TorneoGroup.exists({ torneo: torneo._id, phase: phase + 1 })) {
      return res.status(400).json({ message: "La siguiente fase ya existe" });
    }

    const requestedTableSize = req.body?.tableSize
      ? clamp(parseInt(req.body.tableSize), 2, 12)
      : null;
    const validation = validateNextPhase(
      advancers.length,
      requestedTableSize ?? torneo.tableSize,
    );

    let tableSizeToUse;
    if (validation.valid) {
      tableSizeToUse = validation.isFinal
        ? advancers.length
        : (requestedTableSize ?? torneo.tableSize);
    } else if (requestedTableSize && validation.suggestions.length === 0) {
      // user picked an override but it doesn't match — accept if it divides
      tableSizeToUse = requestedTableSize;
    } else if (requestedTableSize) {
      tableSizeToUse = requestedTableSize;
    } else {
      return res.status(400).json({
        message:
          validation.warnings.join(" ") ||
          "No es posible armar la siguiente fase con la configuración actual",
        suggestions: validation.suggestions,
      });
    }

    await buildAndInsertGroupsForPhase(
      torneo,
      phase + 1,
      advancers,
      tableSizeToUse,
    );
    torneo.currentPhase = phase + 1;
    await torneo.save();

    // Emit "advanced" notifications to each advancing user.
    for (const advUser of advancers) {
      await emitNotificationReq(
        req,
        advUser,
        "tournament_advanced",
        {
          torneoId: String(torneo._id),
          torneoTitle: torneo.title,
          round: phase,
          isPhase: true,
        },
        "torneo:advanced",
      );
    }

    res.json({
      message: "Fase siguiente generada",
      currentPhase: torneo.currentPhase,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Error al generar la siguiente fase" });
  }
});

// GET /api/torneos/:id/next-phase/preview — admin previews how next phase would lay out
router.get(
  "/:id/next-phase/preview",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const torneo = await Torneo.findById(req.params.id).lean();
      if (!torneo)
        return res.status(404).json({ message: "Torneo no encontrado" });
      if (torneo.format !== "groups")
        return res.json({ valid: false, warnings: ["No aplica"] });
      const groups = await TorneoGroup.find({
        torneo: torneo._id,
        phase: torneo.currentPhase,
      });
      const advancers = groups.flatMap((g) => g.advancedPlayers || []);
      const validation = validateNextPhase(advancers.length, torneo.tableSize);
      res.json({
        advancersCount: advancers.length,
        defaultTableSize: torneo.tableSize,
        ...validation,
      });
    } catch (err) {
      res.status(500).json({ message: "Error al calcular la vista previa" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function getFinalRound(torneoId) {
  const last = await TorneoMatch.findOne({ torneo: torneoId })
    .sort({ round: -1 })
    .select("round")
    .lean();
  return last?.round || 0;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

module.exports = router;
