// Configuración de Web Push (VAPID). Sigue el patrón de config/cloudinary.js:
// configura la lib al cargar el módulo y expone un getter del estado.
//
// `vapidConfigured` es una FUNCIÓN (no una const) a propósito: en tests las
// VAPID keys no están seteadas, así devuelve `false` y todo el path de push
// (services/pushService.js) es un no-op — manteniendo verdes los tests que
// pasan por emitNotification sin tener que stubear nada.

const webpush = require("web-push");
const logger = require("../utils/logger");

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:hola@turnocero.app";

let configured = false;

if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  } catch (err) {
    logger.error("web-push VAPID config failed", { error: err.message });
  }
} else if (process.env.NODE_ENV !== "test") {
  logger.warn("VAPID keys no seteadas — Web Push deshabilitado");
}

function vapidConfigured() {
  return configured;
}

module.exports = { webpush, vapidConfigured };
