const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const Idea = require("../models/Idea");
const { protect, requireAdmin, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { parsePagination } = require("../utils/paginate");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

router.use(requireSection("colabora"));

router.param("id", validateObjectId("id"));

// 3 envíos / 15 min por IP — el form es público y no queremos que un bot
// inunde el panel admin de spam. Skipeado en tests via express-rate-limit
// no-op (ver server/tests/setup.js).
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas ideas en poco tiempo, probá de nuevo más tarde." },
});

// POST /api/ideas — público, rate-limited.
// Si hay user logueado, `fromUser` se setea y `email` del body se ignora.
// Si no, `fromEmail` opcional para que el admin pueda responder.
router.post(
  "/",
  submitLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const content = String(req.body?.content ?? "").trim();
    if (content.length < 10 || content.length > 2000) {
      throw httpError(400, "La idea tiene que tener entre 10 y 2000 caracteres.");
    }

    const doc = {
      content,
      fromUser: req.user?._id || null,
      fromEmail: null,
    };

    if (!req.user) {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      if (email) {
        if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw httpError(400, "El email no parece válido.");
        }
        doc.fromEmail = email;
      }
    }

    await Idea.create(doc);
    res.status(201).json({ message: "¡Gracias! Te leemos." });
  }),
);

// GET /api/ideas — admin only. Query: ?status=new|reviewed|archived&page&limit.
// Si no se pasa status, devuelve todas.
router.get(
  "/",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const filter = {};
    if (req.query.status) {
      if (!Idea.STATUSES.includes(req.query.status)) {
        throw httpError(400, "Status inválido");
      }
      filter.status = req.query.status;
    }

    const [ideas, total, counts] = await Promise.all([
      Idea.find(filter)
        .populate("fromUser", "username displayName avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Idea.countDocuments(filter),
      Idea.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const countsByStatus = Idea.STATUSES.reduce((acc, s) => {
      acc[s] = 0;
      return acc;
    }, {});
    for (const row of counts) {
      if (row._id in countsByStatus) countsByStatus[row._id] = row.count;
    }

    res.json({
      ideas,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: countsByStatus,
    });
  }),
);

// PATCH /api/ideas/:id — admin only. Body: { status }.
router.patch(
  "/:id",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!Idea.STATUSES.includes(status)) {
      throw httpError(400, "Status inválido");
    }
    const idea = await Idea.findById(req.params.id);
    if (!idea) throw httpError(404, "Idea no encontrada");
    idea.status = status;
    await idea.save();
    const populated = await idea.populate(
      "fromUser",
      "username displayName avatar",
    );
    res.json(populated);
  }),
);

// DELETE /api/ideas/:id — admin only. Hard delete (archived viejas no aportan).
router.delete(
  "/:id",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const idea = await Idea.findById(req.params.id);
    if (!idea) throw httpError(404, "Idea no encontrada");
    await idea.deleteOne();
    res.json({ message: "Idea eliminada" });
  }),
);

module.exports = router;
