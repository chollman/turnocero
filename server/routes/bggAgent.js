const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const userRateLimit = require("../middleware/userRateLimit");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { handlePlayAgentMessage } = require("../services/bgg/playAgent/playAgentService");

// Agente de IA para cargar partidas de BG Watch. Solo arma un borrador que
// precarga el formulario; nunca guarda en BGG. Gateado por la sección
// `bgwatch` y por su propio flag `bgwatchAgent` (apagado por defecto).
//
// La cuota diaria (10 cargas) y el tope de mensajes por conversación viven en
// el servicio; este limiter solo corta ráfagas.

const router = express.Router();

const agentBurstLimiter = userRateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Demasiados mensajes al asistente, esperá un momento.",
});

router.use(protect, requireSection("bgwatch"), requireSection("bgwatchAgent"));

// POST /api/bgg/agente
// body: { message, conversationId?, timezone?, formContext? }
// → { conversationId, reply, draft, warnings, status, turnsLeft }
router.post(
  "/",
  agentBurstLimiter,
  asyncHandler(async (req, res) => {
    const { message, conversationId, timezone, formContext } = req.body || {};
    if (conversationId && !mongoose.isValidObjectId(conversationId)) {
      throw httpError(400, req.t("errors:playAgent.conversationNotFound"));
    }
    const result = await handlePlayAgentMessage({
      user: req.user,
      conversationId,
      message,
      locale: req.language,
      timezone: typeof timezone === "string" ? timezone.slice(0, 64) : undefined,
      formContext,
      t: req.t,
    });
    res.json(result);
  }),
);

module.exports = router;
