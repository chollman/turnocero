const Evento = require("../models/Evento");
const logger = require("../utils/logger");

/**
 * Job: cierra automáticamente eventos cuyo `eventDate` ya pasó y siguen en
 * estado 'open'. Antes esto se hacía lazy en cada GET /api/eventos[/(:id)]
 * (ver `closePastOpenEvents` en routes/eventos.js), lo que acumula carga
 * si el feed se hittea mucho.
 *
 * Idempotente: si no quedan eventos viejos abiertos, no hace nada.
 *
 * NO emite broadcasts vía socket — el flow lazy existente sigue activo y
 * cubre el caso "usuario abre la página y necesita ver el cambio". Este
 * cron es solo para mantener el estado consistente en background.
 *
 * @returns {Promise<{ closed: number }>}
 */
async function runOnce() {
  try {
    const result = await Evento.updateMany(
      { status: "open", eventDate: { $ne: null, $lt: new Date() } },
      { $set: { status: "closed" } },
    );
    return { closed: result.modifiedCount || 0 };
  } catch (err) {
    logger.error("[closePastEventos] updateMany failed", {
      error: err.message,
    });
    return { closed: 0 };
  }
}

module.exports = { runOnce };
