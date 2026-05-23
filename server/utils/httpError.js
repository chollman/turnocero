// Helper para crear errores HTTP con `status` adherido. middleware/errorHandler.js
// lee err.status para decidir el HTTP response code; sin esto, cae al 500 default.
//
// Uso:
//
//   throw httpError(404, 'Noticia no encontrada');
//   throw httpError(400, 'ID inválido');
//   throw httpError(502, 'Error de Google Geocoding: REQUEST_DENIED');
//
// El mensaje también se expone al cliente como `{ message }`, INCLUSO en 5xx.
// El flag `isExplicit` lo distingue de errores no-intencionales (bug, DB down,
// libs externas que tiran): el errorHandler oculta el message de esos 5xx por
// defensiva contra info-leak, pero el de un httpError sí pasa porque el caller
// lo construyó deliberadamente como user-facing.
//
// No incluyas info sensible (PII, internals, paths) — los mensajes
// específicos se exponen al cliente.

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.isExplicit = true;
  return err;
}

module.exports = httpError;
