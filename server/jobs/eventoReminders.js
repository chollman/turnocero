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
  // Ventana amplia [now, now + 25h] combinada con `reminderSentAt == null`:
  // si el cron se atrasa más de 1h, los eventos que caen entre las 23h-25h
  // anteriores siguen siendo candidatos hasta que el job se ejecute. Cuando
  // se notifica, marcamos `reminderSentAt` para garantizar que cada evento
  // recibe el reminder UNA sola vez aunque haya re-runs o ventanas solapadas.
  const HOUR_MS = 60 * 60 * 1000;
  const windowEnd = new Date(now.getTime() + 25 * HOUR_MS);

  const eventos = await Evento.find({
    eventDate: { $gte: now, $lte: windowEnd },
    status: { $in: ['open', 'closed'] },
    $or: [{ reminderSentAt: null }, { reminderSentAt: { $exists: false } }],
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
        // no es admin. No contamos esos casos pero igual marcamos el evento
        // como notificado (no vamos a reintentar).
        if (result) notifsCreated += 1;
      } catch (err) {
        logger.error('[eventoReminders] saveNotification failed', {
          recipientId: reg.user?.toString(),
          eventoId: evento._id.toString(),
          error: err.message,
        });
      }
    }
    // Aún si no hubo ningún confirmed, marcamos para no reintentar mañana
    // — no hay nadie a quien notificar. Esto sirve también como "checked".
    evento.reminderSentAt = now;
    try {
      await evento.save();
    } catch (err) {
      logger.error('[eventoReminders] save reminderSentAt failed', {
        eventoId: evento._id.toString(),
        error: err.message,
      });
    }
  }

  return { scanned: eventos.length, notifsCreated };
}

module.exports = { runOnce };
