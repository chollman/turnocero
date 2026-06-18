// Envío de Web Push a todos los dispositivos suscriptos de un usuario.
//
// Best-effort por contrato: NUNCA throwea hacia el caller (emitNotification lo
// llama fire-and-forget). Si las VAPID keys no están configuradas o el usuario
// no tiene suscripciones, es un no-op barato.
//
// Limpieza de suscripciones muertas: cuando el push service responde 404/410
// (Gone) la suscripción ya no sirve (el browser la rotó/desinstaló) → la
// borramos para que la tabla no acumule basura.

// Referenciamos el config por el objeto del módulo (no destructuring) para que
// los tests puedan mutar `webpushConfig.vapidConfigured` / `webpushConfig.webpush`
// — mismo patrón mutate-exports que usa tests/setup.js para cloudinary/email.
const webpushConfig = require("../config/webpush");
const PushSubscription = require("../models/PushSubscription");
const logger = require("../utils/logger");

async function sendToUser(userId, payload) {
  if (!webpushConfig.vapidConfigured()) return { sent: 0, pruned: 0 };

  const subs = await PushSubscription.find({ user: userId }).lean();
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  const dead = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpushConfig.webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          body,
          { TTL: 60 }, // una alerta OS es time-sensitive: no la encolamos stale
        );
        sent += 1;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(s.endpoint);
        } else {
          logger.warn("web push send failed", {
            status: err?.statusCode,
            error: err?.message,
          });
        }
      }
    }),
  );

  let pruned = 0;
  if (dead.length > 0) {
    try {
      const res = await PushSubscription.deleteMany({
        endpoint: { $in: dead },
      });
      pruned = res.deletedCount || 0;
    } catch (err) {
      logger.warn("pruning dead push subs failed", { error: err.message });
    }
  }

  return { sent, pruned };
}

module.exports = { sendToUser };
