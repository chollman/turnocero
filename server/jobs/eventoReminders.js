const Evento = require("../models/Evento");
const User = require("../models/User");
const emitNotification = require("../utils/emitNotification");
const logger = require("../utils/logger");

const HOUR_MS = 60 * 60 * 1000;

/**
 * Job: recordatorios pre-evento. Soporta dos ventanas configurables por usuario
 * (User.eventoReminderHours):
 *   - 24h antes (default histórico)
 *   - 2h antes
 *   - 0 = opt-out (no recibe)
 *
 * Idempotencia:
 *   - `Evento.reminderSentAt` marca la ventana 24h ya disparada.
 *   - `Evento.reminder2hSentAt` marca la ventana 2h.
 *   - `saveNotification` upsertea por `(recipient, type, eventoId)` — incluso
 *     si ambas ventanas notifican al mismo user, solo queda 1 notif persistida.
 *
 * Diseñado para correrse cada hora; ventanas amplias para tolerar atrasos.
 *
 * @param {object} [opts]
 * @param {Date}   [opts.now]  Inyectable para tests; default = new Date().
 * @param {object} [opts.io]   Instancia de Socket.IO para emitir el reminder
 *                             en tiempo real al recipient. Opcional — si falta,
 *                             la notif igual se persiste y el user la verá al
 *                             próximo GET /api/notifications (degraded mode).
 * @returns {Promise<{ scanned24: number, scanned2: number, notifsCreated: number }>}
 */
async function runOnce({ now = new Date(), io = null } = {}) {
  let notifsCreated = 0;

  // Helper: notifica confirmed regs filtrando por user.eventoReminderHours.
  // Carga las preferencias en batch para no hacer N queries al userset.
  async function notifyForWindow(eventos, targetHours) {
    if (eventos.length === 0) return;
    const userIds = new Set();
    for (const ev of eventos) {
      for (const reg of ev.registrations || []) {
        if (reg.status === "confirmed" && reg.user) {
          userIds.add(reg.user.toString());
        }
      }
    }
    if (userIds.size === 0) return;
    const users = await User.find({ _id: { $in: [...userIds] } }).select(
      "_id eventoReminderHours",
    );
    const prefByUserId = new Map(
      users.map((u) => [
        u._id.toString(),
        // Default 24 cuando el field es null/undefined (users históricos sin
        // el campo seteado mantienen el comportamiento previo).
        u.eventoReminderHours ?? 24,
      ]),
    );

    for (const evento of eventos) {
      for (const reg of evento.registrations || []) {
        if (reg.status !== "confirmed" || !reg.user) continue;
        const pref = prefByUserId.get(reg.user.toString());
        if (pref !== targetHours) continue;
        try {
          // emitNotification persiste + emite con notifId/count (contrato
          // unificado). Sin `io` solo persiste — el user verá el reminder
          // al próximo GET /api/notifications.
          const result = await emitNotification({
            io,
            recipientId: reg.user,
            type: "evento_reminder",
            fields: {
              eventoId: evento._id.toString(),
              eventoTitle: evento.title,
              eventoDate: evento.eventDate,
            },
            socketEvent: "evento:notification",
            extra: { type: "evento_reminder" },
          });
          if (result) notifsCreated += 1;
        } catch (err) {
          logger.error("[eventoReminders] emitNotification failed", {
            recipientId: reg.user?.toString(),
            eventoId: evento._id.toString(),
            error: err.message,
          });
        }
      }
    }
  }

  // ── Ventana 24h: eventos en [now, now+25h], reminderSentAt null ─────────
  const window24End = new Date(now.getTime() + 25 * HOUR_MS);
  const eventos24 = await Evento.find({
    eventDate: { $gte: now, $lte: window24End },
    status: { $in: ["open", "closed"] },
    $or: [{ reminderSentAt: null }, { reminderSentAt: { $exists: false } }],
  });
  await notifyForWindow(eventos24, 24);
  for (const ev of eventos24) {
    ev.reminderSentAt = now;
    try {
      await ev.save();
    } catch (err) {
      logger.error("[eventoReminders] save reminderSentAt failed", {
        eventoId: ev._id.toString(),
        error: err.message,
      });
    }
  }

  // ── Ventana 2h: eventos en [now, now+3h], reminder2hSentAt null ─────────
  // Ventana ligeramente más amplia que [+1h, +3h] para tolerar cron atrasado.
  const window2End = new Date(now.getTime() + 3 * HOUR_MS);
  const eventos2 = await Evento.find({
    eventDate: { $gte: now, $lte: window2End },
    status: { $in: ["open", "closed"] },
    $or: [{ reminder2hSentAt: null }, { reminder2hSentAt: { $exists: false } }],
  });
  await notifyForWindow(eventos2, 2);
  for (const ev of eventos2) {
    ev.reminder2hSentAt = now;
    try {
      await ev.save();
    } catch (err) {
      logger.error("[eventoReminders] save reminder2hSentAt failed", {
        eventoId: ev._id.toString(),
        error: err.message,
      });
    }
  }

  return {
    scanned: eventos24.length,
    scanned24: eventos24.length,
    scanned2: eventos2.length,
    notifsCreated,
  };
}

module.exports = { runOnce };
