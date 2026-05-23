// Wrapper para route handlers async. Captura promise rejections (y throws
// síncronos dentro del cuerpo) y los pasa a Express via next(err), donde
// los recoge middleware/errorHandler.js.
//
// Sin esto, un `throw` o promise rejection en un handler async produce
// `UnhandledPromiseRejection` y Express deja la request colgada (timeout
// 30s + ECONNRESET). Con esto, cualquier error sale por la pipeline normal.
//
// Uso:
//
//   router.get('/foo', asyncHandler(async (req, res) => {
//     const doc = await Model.findById(req.params.id);
//     if (!doc) throw httpError(404, 'No encontrado');
//     res.json(doc);
//   }));
//
// Pattern + convención (tech-debt-audit.md P1.6).

function asyncHandler(fn) {
  return function asyncHandlerWrapper(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
