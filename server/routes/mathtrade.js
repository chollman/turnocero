const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const multer = require("../config/multer");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");
const MathTrade = require("../models/MathTrade");
const MathTradeItem = require("../models/MathTradeItem");
const { protect, requireAdmin, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { parsePagination } = require("../utils/paginate");
const { escapeRegex } = require("../utils/regex");
const { clamp } = require("../utils/clamp");
const { emitNotificationReq } = require("../utils/emitNotification");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { resolveGamesBatch } = require("../services/bgg/bggResolve");
const {
  VALID_TRANSITIONS,
  runMatching,
  previewMatching,
  clearResults,
  getResults,
} = require("../services/mathTradeService");

router.use(requireSection("mathtrade"));

router.param("id", validateObjectId("id"));
router.param("itemId", validateObjectId("itemId"));

const USER_FIELDS = "username displayName nombre apellido avatar";
const STATUSES = [
  "draft",
  "open",
  "locked",
  "results",
  "finished",
  "cancelled",
];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const isAdmin = (req) => !!req.user?.isAdmin;

// Oculta drafts a los no-admin.
function visibleStatusFilter(req) {
  if (isAdmin(req)) return {};
  return { status: { $ne: "draft" } };
}

// Resultados visibles solo en results/finished (o para admin).
function resultsVisible(mt, req) {
  return isAdmin(req) || ["results", "finished"].includes(mt.status);
}

// Toma el body de un ítem (offered game + want list) y arma los campos con
// snapshot BGG (nombre + thumbnail) resueltos en un solo batch. Tolerante:
// si BGG no resuelve un id, guarda el id igual (es lo único que el matcher
// necesita) con nombre/thumbnail vacíos.
async function snapshotItemFields(body) {
  const offeredId = Number(body.bggGameId);
  if (!Number.isFinite(offeredId) || offeredId <= 0) {
    throw httpError(400, "Juego ofrecido inválido");
  }
  const rawWants = Array.isArray(body.wants) ? body.wants : [];
  const wantIds = rawWants
    .map((w) => Number(w?.bggGameId))
    .filter((n) => Number.isFinite(n) && n > 0);

  const games = await resolveGamesBatch([offeredId, ...wantIds]);
  const offered = games.get(offeredId);

  const wants = rawWants
    .map((w, idx) => {
      const gid = Number(w?.bggGameId);
      if (!Number.isFinite(gid) || gid <= 0) return null;
      if (gid === offeredId) return null; // no tiene sentido querer lo que ofrecés
      const g = games.get(gid);
      const rank = Number(w?.rank);
      return {
        bggGameId: gid,
        gameName: g?.name || "",
        thumbnail: g?.thumbnail || "",
        rank: Number.isFinite(rank) && rank >= 1 ? rank : idx + 1,
      };
    })
    .filter(Boolean);

  return {
    bggGameId: offeredId,
    gameName: offered?.name || "",
    thumbnail: offered?.thumbnail || "",
    wants,
    notes: String(body.notes || "").slice(0, 500),
  };
}

// ─────────────────────────────────────────────────────────────────
// CRUD del evento
// ─────────────────────────────────────────────────────────────────

// GET /api/mathtrade — lista paginada (?status, ?q)
router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 12,
      maxLimit: 20,
    });

    const filter = { ...visibleStatusFilter(req) };
    if (req.query.status) {
      const requested = String(req.query.status);
      if (requested === "draft" && !isAdmin(req)) {
        throw httpError(403, "Acceso restringido");
      }
      filter.status = requested;
    }
    if (req.query.q) {
      filter.title = new RegExp(escapeRegex(String(req.query.q)), "i");
    }

    const [trades, total] = await Promise.all([
      MathTrade.find(filter)
        .populate("createdBy", USER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MathTrade.countDocuments(filter),
    ]);

    // itemCount liviano sin traer los ítems.
    const ids = trades.map((t) => t._id);
    const counts = ids.length
      ? await MathTradeItem.aggregate([
          { $match: { mathtrade: { $in: ids } } },
          { $group: { _id: "$mathtrade", count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json({
      mathtrades: trades.map((t) => ({
        ...t,
        itemCount: countMap.get(String(t._id)) || 0,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }),
);

// POST /api/mathtrade — admin, multipart con imagen opcional
router.post(
  "/",
  protect,
  requireAdmin,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    const { title, description, submissionDeadline, mode, maxChainLength } =
      req.body;
    if (!title?.trim()) throw httpError(400, "Falta el título");
    if (mode && !["max", "bounded", "auto"].includes(mode)) {
      throw httpError(400, "Modo de matching inválido");
    }

    let image;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "turnocero/mathtrade",
        transformation: [{ width: 1200, crop: "limit" }],
      });
      image = { url: result.secure_url, publicId: result.public_id };
    }

    const deadline = submissionDeadline ? new Date(submissionDeadline) : null;

    const mt = await MathTrade.create({
      title: title.trim(),
      description: description?.trim() || "",
      submissionDeadline:
        deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
      matching: {
        mode: mode || "max",
        maxChainLength: maxChainLength
          ? clamp(parseInt(maxChainLength), 2, 12)
          : 4,
      },
      image,
      createdBy: req.user._id,
    });

    const populated = await MathTrade.findById(mt._id).populate(
      "createdBy",
      USER_FIELDS,
    );
    res.status(201).json(populated);
  }),
);

// GET /api/mathtrade/:id — detalle (lectura pública; draft oculto a no-admin)
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id)
      .populate("createdBy", USER_FIELDS)
      .lean();
    if (!mt) throw httpError(404, "Math trade no encontrado");
    if (mt.status === "draft" && !isAdmin(req)) {
      throw httpError(404, "Math trade no encontrado");
    }
    res.json(mt);
  }),
);

// PUT /api/mathtrade/:id — admin, editable en draft/open
router.put(
  "/:id",
  protect,
  requireAdmin,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id);
    if (!mt) throw httpError(404, "Math trade no encontrado");

    const { title, description, submissionDeadline, mode, maxChainLength } =
      req.body;
    if (title?.trim()) mt.title = title.trim();
    if (typeof description === "string") mt.description = description.trim();
    if (submissionDeadline !== undefined) {
      const d = submissionDeadline ? new Date(submissionDeadline) : null;
      mt.submissionDeadline = d && !Number.isNaN(d.getTime()) ? d : null;
    }
    if (mode && ["max", "bounded", "auto"].includes(mode))
      mt.matching.mode = mode;
    if (maxChainLength !== undefined) {
      mt.matching.maxChainLength = clamp(parseInt(maxChainLength), 2, 12);
    }

    if (req.file) {
      if (mt.image?.publicId) {
        try {
          await cloudinary.uploader.destroy(mt.image.publicId);
        } catch {
          /* best-effort */
        }
      }
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "turnocero/mathtrade",
        transformation: [{ width: 1200, crop: "limit" }],
      });
      mt.image = { url: result.secure_url, publicId: result.public_id };
    }

    await mt.save();
    const populated = await MathTrade.findById(mt._id).populate(
      "createdBy",
      USER_FIELDS,
    );
    res.json(populated);
  }),
);

// DELETE /api/mathtrade/:id — admin; bloquea si hay ítems y no es draft
router.delete(
  "/:id",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id);
    if (!mt) throw httpError(404, "Math trade no encontrado");

    const itemCount = await MathTradeItem.countDocuments({ mathtrade: mt._id });
    if (itemCount > 0 && mt.status !== "draft") {
      throw httpError(
        400,
        "No se puede eliminar: ya hay ítems cargados. Pasalo a borrador primero.",
      );
    }

    if (mt.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(mt.image.publicId);
      } catch {
        /* best-effort */
      }
    }
    await MathTradeItem.deleteMany({ mathtrade: mt._id });
    await mt.deleteOne();
    res.json({ message: "Math trade eliminado" });
  }),
);

// PATCH /api/mathtrade/:id/status — admin, transiciones validadas
router.patch(
  "/:id/status",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id);
    if (!mt) throw httpError(404, "Math trade no encontrado");

    const next = req.body.status;
    if (!STATUSES.includes(next)) throw httpError(400, "Estado inválido");
    if (!VALID_TRANSITIONS[mt.status].has(next)) {
      throw httpError(400, `Transición no permitida: ${mt.status} → ${next}`);
    }

    const wasResults = mt.status === "results";
    mt.status = next;
    await mt.save();

    if (next === "results") {
      // Corre el matching si todavía no se corrió, y publica.
      if (!mt.lastRunAt) await runMatching(mt._id);
      await MathTrade.findByIdAndUpdate(mt._id, { $set: { published: true } });

      // Notifica a cada dueño que cargó ítems (matcheado o no).
      const owners = await MathTradeItem.find({
        mathtrade: mt._id,
      }).distinct("owner");
      await Promise.all(
        owners.map((ownerId) =>
          emitNotificationReq(
            req,
            String(ownerId),
            "mathtrade_results",
            {
              mathtradeId: mt._id.toString(),
              mathtradeTitle: mt.title,
            },
            "mathtrade:results",
          ).catch(() => {}),
        ),
      );
    } else if (
      next === "draft" ||
      next === "open" ||
      next === "cancelled" ||
      (next === "locked" && wasResults)
    ) {
      // Volver atrás (o cancelar) limpia los resultados.
      await clearResults(mt._id);
    }

    const populated = await MathTrade.findById(mt._id).populate(
      "createdBy",
      USER_FIELDS,
    );
    res.json(populated);
  }),
);

// ─────────────────────────────────────────────────────────────────
// Ítems ofrecidos + want lists
// ─────────────────────────────────────────────────────────────────

// GET /api/mathtrade/:id/items — lista de ítems (lectura pública)
router.get(
  "/:id/items",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id).lean();
    if (!mt) throw httpError(404, "Math trade no encontrado");
    if (mt.status === "draft" && !isAdmin(req)) {
      throw httpError(404, "Math trade no encontrado");
    }
    const items = await MathTradeItem.find({ mathtrade: req.params.id })
      .populate("owner", USER_FIELDS)
      .sort({ createdAt: 1 })
      .lean();
    res.json(items);
  }),
);

// GET /api/mathtrade/:id/my-items — ítems del usuario actual
router.get(
  "/:id/my-items",
  protect,
  asyncHandler(async (req, res) => {
    const items = await MathTradeItem.find({
      mathtrade: req.params.id,
      owner: req.user._id,
    })
      .sort({ createdAt: 1 })
      .lean();
    res.json(items);
  }),
);

// POST /api/mathtrade/:id/items — auth, solo en 'open' antes del deadline
router.post(
  "/:id/items",
  protect,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id);
    if (!mt) throw httpError(404, "Math trade no encontrado");
    if (mt.status !== "open") {
      throw httpError(400, "La carga de ítems no está abierta");
    }
    if (mt.submissionDeadline && Date.now() > mt.submissionDeadline.getTime()) {
      throw httpError(400, "Se cerró el plazo de carga");
    }

    const fields = await snapshotItemFields(req.body);
    const item = await MathTradeItem.create({
      mathtrade: mt._id,
      owner: req.user._id,
      ...fields,
    });
    res.status(201).json(item);
  }),
);

// PUT /api/mathtrade/:id/items/:itemId — auth (dueño), solo en 'open'
router.put(
  "/:id/items/:itemId",
  protect,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id);
    if (!mt) throw httpError(404, "Math trade no encontrado");
    if (mt.status !== "open") {
      throw httpError(400, "La carga de ítems no está abierta");
    }
    const item = await MathTradeItem.findOne({
      _id: req.params.itemId,
      mathtrade: mt._id,
    });
    if (!item) throw httpError(404, "Ítem no encontrado");
    if (String(item.owner) !== String(req.user._id)) {
      throw httpError(403, "No es tu ítem");
    }

    const fields = await snapshotItemFields(req.body);
    item.bggGameId = fields.bggGameId;
    item.gameName = fields.gameName;
    item.thumbnail = fields.thumbnail;
    item.wants = fields.wants;
    item.notes = fields.notes;
    await item.save();
    res.json(item);
  }),
);

// DELETE /api/mathtrade/:id/items/:itemId — auth (dueño o admin), solo en 'open'
router.delete(
  "/:id/items/:itemId",
  protect,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id);
    if (!mt) throw httpError(404, "Math trade no encontrado");
    if (mt.status !== "open") {
      throw httpError(400, "La carga de ítems no está abierta");
    }
    const item = await MathTradeItem.findOne({
      _id: req.params.itemId,
      mathtrade: mt._id,
    });
    if (!item) throw httpError(404, "Ítem no encontrado");
    if (String(item.owner) !== String(req.user._id) && !isAdmin(req)) {
      throw httpError(403, "No es tu ítem");
    }
    await item.deleteOne();
    res.json({ message: "Ítem eliminado" });
  }),
);

// ─────────────────────────────────────────────────────────────────
// Matching (admin)
// ─────────────────────────────────────────────────────────────────

// POST /api/mathtrade/:id/run-matching — admin, status 'locked'
router.post(
  "/:id/run-matching",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id).lean();
    if (!mt) throw httpError(404, "Math trade no encontrado");
    if (mt.status !== "locked") {
      throw httpError(400, "Cerrá la inscripción (lock) antes de matchear");
    }
    const { mode, maxChainLength } = req.body;
    const summary = await runMatching(mt._id, { mode, maxChainLength });
    res.json({ summary });
  }),
);

// POST /api/mathtrade/:id/run-matching/preview — admin, sin persistir
router.post(
  "/:id/run-matching/preview",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id).lean();
    if (!mt) throw httpError(404, "Math trade no encontrado");
    const { mode, maxChainLength } = req.body;
    const preview = await previewMatching(mt._id, { mode, maxChainLength });
    res.json(preview);
  }),
);

// GET /api/mathtrade/:id/results — ciclos publicados (results/finished o admin)
router.get(
  "/:id/results",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const mt = await MathTrade.findById(req.params.id).lean();
    if (!mt) throw httpError(404, "Math trade no encontrado");
    if (!resultsVisible(mt, req)) {
      throw httpError(403, "Los resultados todavía no se publicaron");
    }
    const cycles = await getResults(mt._id);
    res.json({ summary: mt.summary, cycles });
  }),
);

module.exports = router;
