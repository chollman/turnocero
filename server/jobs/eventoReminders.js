const Evento = require('../models/Evento');
const saveNotification = require('../utils/saveNotification');
const logger = require('../utils/logger');

/**
 * Job: recordatorio 24h antes del evento.
 *
 * Cada corrida busca eventos con `eventDate` en una ventana de [now+23h, now+25h]
 * y status `open` o `closed`. Para cada uno, crea una notificación `evento_reminder`
 * a cada inscripción `confirmed`.
 *
 * Idempotencia: `saveNotification` usa upsert por `(recipient, type, eventoId)`,
 * así que correr el job dos veces para el mismo evento NO duplica notifs ni
 * incrementa contadores (es de tipo no-aggregating).
 *
 * Diseñado para correrse cada hora; con la ventana de 2h hay margen de tolerancia
 * para que un evento siempre caiga en al menos una corrida aunque el cron se atrase.
 *
 * @param {object} [opts]
 * @param {Date}   [opts.now]  Inyectable para tests; default = new Date().
 * @returns {Promise<{ scanned: number, notifsCreated: number }>}
 */
async function runOnce({ now = new Date() } = {}) {
  // Ventana [now + 23h, now + 25h]: el cron corre cada hora, así que con una
  // ventana de 2h cubrimos casos donde el cron se atrasa ~1h sin perder eventos.
  const HOUR_MS = 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() + 23 * HOUR_MS);
  const windowEnd   = new Date(now.getTime() + 25 * HOUR_MS);

  const eventos = await Evento.find({
    eventDate: { $gte: windowStart, $lte: windowEnd },
    status: { $in: ['open', 'closed'] },
  });

  let notifsCreated = 0;
  for (const evento of eventos) {
    for (const reg of evento.registrations || []) {
      if (reg.status !== 'confirmed') continue;
      try {
        const result = await saveNotification(reg.user, 'evento_reminder', {
          eventoId: evento._id.toString(),
          eventoTitle: evento.title,
          eventoDate: evento.eventDate,
        });
        // saveNotification devuelve null cuando la sección está OFF y el user
        // no es admin. No contamos esos casos.
        if (result) notifsCreated += 1;
      } catch (err) {
        logger.error('[eventoReminders] saveNotification failed', {
          recipientId: reg.user?.toString(),
          eventoId: evento._id.toString(),
          error: err.message,
        });
      }
    }
  }

  return { scanned: eventos.length, notifsCreated };
}

module.exports = { runOnce };
