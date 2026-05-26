// Middleware central de manejo de errores. Capta cualquier error que llegue
// vía next(err) — incluidos los que tira asyncHandler — y devuelve la
// respuesta normalizada `{ message }` con el HTTP status code adecuado.
//
// Convención del proyecto: todos los responses de error tienen forma
// `{ message: '<string en castellano>' }`. Status codes:
//   400 — validación / bad request
//   401 — unauthenticated
//   403 — forbidden
//   404 — not found
//   500 — server error (default)
//
// Cómo se decide el status:
//   1. err.status (lo que setea utils/httpError.js, bggAuth, bggMutations, etc.)
//   2. err.statusCode (alguna libs lo usan)
//   3. Mongoose CastError → 400 (id mal formado que pasó nuestra validación)
//   4. Mongoose ValidationError → 400
//   5. default → 500
//
// Para errores 5xx (no esperados), logueamos con stack via server logger
// para diagnóstico. Para 4xx (esperados, throw intencional del business
// logic) no spameamos los logs.

const logger = require("../utils/logger");

function statusFor(err) {
  if (typeof err.status === "number") return err.status;
  if (typeof err.statusCode === "number") return err.statusCode;
  if (err.name === "CastError") return 400;
  if (err.name === "ValidationError") return 400;
  return 500;
}

function messageFor(err, status) {
  // 4xx intencional → exponer message tal cual.
  if (status >= 400 && status < 500 && err.message) return err.message;
  // 5xx explícitos (creados con utils/httpError — el caller los construyó
  // deliberadamente como user-facing, ej. "Error de Google Geocoding: ...")
  // → también exponer.
  if (err.isExplicit && err.message) return err.message;
  // 5xx no esperados (bug, DB down, libs externas) → mensaje genérico para
  // no leakear detalles internos (paths fs, secrets en stack traces, etc.).
  return "Error interno del servidor";
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = statusFor(err);
  const message = messageFor(err, status);

  if (status >= 500) {
    logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`, {
      stack: err.stack,
    });
  }

  res.status(status).json({ message });
}

module.exports = errorHandler;
