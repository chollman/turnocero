const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { optionalAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const shortlinkService = require("../services/shortlinkService");

// Limite por IP para la creación. Anónimos pueden compartir contenido público,
// así que no podemos limitar por user. El dedup por {type, ref} + el chequeo de
// existencia ya acotan el abuso a "un código por recurso real"; esto frena el
// spam de minteo. Skip en test para no pegarse 429 spameando la suite.
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { message: "Demasiados pedidos, esperá un momento." },
});

// POST /api/shortlinks — get-or-create un short link para un recurso compartible.
// Body: { type: 'compartida'|'evento'|'noticia'|'bgwatch', ref }.
router.post(
  "/",
  createLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { type, ref } = req.body || {};

    if (!shortlinkService.pathFor(type, "x"))
      throw httpError(400, "Tipo de recurso inválido");

    // Los recursos con documento usan ObjectId; bgwatch usa el bggUsername.
    if (type !== "bgwatch" && !mongoose.Types.ObjectId.isValid(ref))
      throw httpError(400, "Recurso inválido");

    const link = await shortlinkService.getOrCreate({
      type,
      ref: String(ref),
      createdBy: req.user?._id || null,
    });

    res.status(201).json({
      code: link.code,
      path: shortlinkService.pathFor(link.type, link.ref),
    });
  }),
);

// GET /api/shortlinks/:code — resuelve el destino (y cuenta el click). Público.
// Lo consumen el SPA `<ShortLinkRedirect>` y el middleware de previews.
router.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const resolved = await shortlinkService.resolve(req.params.code);
    if (!resolved) throw httpError(404, "Link no encontrado");
    res.json(resolved);
  }),
);

module.exports = router;
