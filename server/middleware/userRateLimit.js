// Rate limiter factory por usuario autenticado.
//
// Diferencia con express-rate-limit default (que usa IP): los endpoints
// caros que protegemos (BGG sync/mutations, Cloudinary uploads, BGG batch
// resolves) son authed; queremos limitar por USER, no por IP — varios
// users tras el mismo NAT (oficina, cafe) compartirían cuota.
//
// Fallback a `req.ip` para endpoints donde `req.user` puede no estar
// presente (p.ej. si se monta antes del `protect` middleware). En la
// práctica los call sites usan `protect, userRateLimit(...)`.
//
// Skip en test (NODE_ENV === 'test') para que la suite pueda spamear
// endpoints sin pegarse 429. Patrón ya usado por authLimiter via
// require.cache override en tests/setup.js, pero acá lo hacemos
// explícito por defensiva.

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

function userRateLimit({
  windowMs,
  max,
  message = "Demasiados pedidos, esperá un momento.",
}) {
  if (typeof windowMs !== "number" || typeof max !== "number") {
    throw new Error("userRateLimit: windowMs y max son requeridos");
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) =>
      req.user?._id?.toString() || `ip:${ipKeyGenerator(req, res)}`,
    skip: () => process.env.NODE_ENV === "test",
    message: { message },
  });
}

module.exports = userRateLimit;
