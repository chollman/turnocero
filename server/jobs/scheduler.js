const cron = require("node-cron");
const eventoReminders = require("./eventoReminders");
const closePastEventos = require("./closePastEventos");
const logger = require("../utils/logger");

/**
 * Registra y arranca todos los cron jobs de la app.
 *
 * Llamado desde `server.js` después de la conexión a Mongo y antes de listen.
 * NO se llama desde `app.js` para que los tests (que requieren app, no server)
 * no arranquen jobs en background.
 *
 * @param {object} [opts]
 * @param {object} [opts.io]  Instancia de Socket.IO para emitir desde jobs si
 *                            hace falta. Opcional. Por ahora no se usa pero
 *                            queda como hook para futuros jobs.
 */
function startSchedulers({ io } = {}) {
  // Recordatorios 24h antes de eventos — corre cada hora al minuto 0.
  // Pasamos `io` para que el job emita el `evento:notification` en tiempo
  // real (cierre del gap del cron — antes solo persistía).
  cron.schedule("0 * * * *", async () => {
    try {
      const result = await eventoReminders.runOnce({ io });
      if (result.notifsCreated > 0) {
        logger.info("[eventoReminders] tick", result);
      }
    } catch (err) {
      logger.error("[eventoReminders] tick failed", { error: err.message });
    }
  });

  // Sweep diario: cierra eventos cuyo eventDate ya pasó y siguen 'open'.
  // El handler lazy en routes/eventos.js sigue activo como fallback (cubre
  // el caso "el cron no corrió pero el user abre la página"); este cron
  // descomprime el feed para no hacer el barrido en cada request. 02:30 AM
  // local es buena hora — feed prácticamente sin tráfico.
  cron.schedule("30 2 * * *", async () => {
    try {
      const result = await closePastEventos.runOnce();
      if (result.closed > 0) {
        logger.info("[closePastEventos] tick", result);
      }
    } catch (err) {
      logger.error("[closePastEventos] tick failed", { error: err.message });
    }
  });

  // Marcador defensivo: el cron arranca al cargarse. Si en el futuro suman más
  // jobs, agregarlos acá manteniendo el mismo patrón (try/catch + logger.info
  // solo cuando hicieron trabajo).
  logger.info("[scheduler] cron jobs started");
}

module.exports = { startSchedulers };
