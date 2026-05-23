// Helper para crear errores HTTP con `status` adherido. middleware/errorHandler.js
// lee err.status para decidir el HTTP response code; sin esto, cae al 500 default.
//
// Uso:
//
//   throw httpError(404, 'Noticia no encontrada');
//   throw httpError(400, 'ID inválido');
//
// El mensaje también se expone al cliente como `{ message }`. No incluyas
// info sensible (PII, internals) — es user-facing.

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = httpError;
