const {
  createUsageContext,
  runWithUsageContext,
  flushReads,
} = require("../services/bgg/bggUsage");

// Abre un contexto de uso (AsyncLocalStorage) por request para que `fetchBgg`
// pueda contabilizar las llamadas salientes a BGG y atribuirlas al usuario
// autenticado. Al terminar la respuesta vuelca el contador a Mongo en un
// único upsert (no escribe nada si el request no tocó BGG). El userId se lee
// recién en `finish`, cuando `protect`/`optionalAuth` ya corrieron.
module.exports = function bggUsageContext(req, res, next) {
  const ctx = createUsageContext();
  res.on("finish", () => {
    flushReads(ctx, req.user?._id || null);
  });
  runWithUsageContext(ctx, () => next());
};
