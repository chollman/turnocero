const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const userRateLimit = require("../middleware/userRateLimit");
const { searchTutorials } = require("../services/youtube/youtubeSearch");
const { resolveVideo } = require("../services/youtube/youtubeVideo");

const router = express.Router();

// Sin auth — mesas públicas son visibles sin login. userRateLimit cae a
// `ip:<addr>` cuando no hay req.user, así que esto rate-limitea por IP
// para visitantes anónimos. 60 req/min/IP es generoso para uso humano
// (cada TableDetail dispara 1 call) y corta abuso scripteado.
const tutorialsLimiter = userRateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: "Demasiados pedidos, esperá un momento.",
});

/**
 * GET /api/youtube/como-se-juega?juego=<nombre>
 *
 * Devuelve los primeros 3 resultados de YouTube para "Como se juega <nombre>".
 * Cacheado server-side 7 días en Mongo + 5 min de browser cache.
 *
 * El servicio nunca tira — si falta la key, YouTube responde error, o la
 * quota se agotó, devuelve `{ items: [] }`. La sección del frontend se
 * auto-oculta con items vacíos.
 */
router.get(
  "/como-se-juega",
  tutorialsLimiter,
  asyncHandler(async (req, res) => {
    const juego = (req.query.juego || "").toString();
    const result = await searchTutorials(juego);
    res.set("Cache-Control", "public, max-age=300"); // 5 min browser cache
    res.json(result);
  }),
);

/**
 * GET /api/youtube/video/:videoId
 *
 * Devuelve metadata de un video específico (modo "manual" de la sección
 * "Andá preparado"). Cacheado server-side 30 días + 10 min de browser cache.
 *
 * Tira 400 si el videoId tiene formato inválido. Cualquier otro fallo
 * (sin key, network, quota, video privado) devuelve un fallback con
 * thumbnail directo de i.ytimg.com y campos vacíos.
 */
router.get(
  "/video/:videoId",
  tutorialsLimiter,
  asyncHandler(async (req, res) => {
    const result = await resolveVideo(req.params.videoId);
    res.set("Cache-Control", "public, max-age=600"); // 10 min browser cache
    res.json(result);
  }),
);

module.exports = router;
