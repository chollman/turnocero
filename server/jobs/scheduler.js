const cron = require('node-cron');
const eventoReminders = require('./eventoReminders');
const logger = require('../utils/logger');

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
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await eventoReminders.runOnce();
      if (result.notifsCreated > 0) {
        logger.info('[eventoReminders] tick', result);
      }
    } catch (err) {
      logger.error('[eventoReminders] tick failed', { error: err.message });
    }
  });

  // Marcador defensivo: el cron arranca al cargarse. Si en el futuro suman más
  // jobs, agregarlos acá manteniendo el mismo patrón (try/catch + logger.info
  // solo cuando hicieron trabajo).
  logger.info('[scheduler] cron jobs started');
}

module.exports = { startSchedulers };
