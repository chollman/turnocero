// Helpers de Socket.IO emit usados desde routers. Antes vivían como
// funciones locales en `routes/eventos.js` (líneas ~43-69) — un patrón
// que estaba apareciendo replicado, ad-hoc, en `tables.js`, `torneos.js`
// y otros. Centralizar evita drift entre implementaciones.
//
// Todos los helpers son **best-effort**: nunca propagan errores ni rompen
// el request — un emit que falla no debería tirar el flujo HTTP.

const cookie = require("cookie");

// Extrae el JWT del handshake del socket. Primero `auth.token` (fast-path del
// apex, viene de localStorage); si no, cae a la cookie httpOnly `token`
// (first-party bajo turnocero.app, viaja en el handshake de los subdominios de
// comunidad donde el cliente no tiene token local) → habilita el SSO de
// real-time entre subdominios. Devuelve `null` si no hay ninguno.
function resolveHandshakeToken(handshake) {
  const fromAuth = handshake?.auth?.token;
  if (fromAuth) return fromAuth;
  const cookieHeader = handshake?.headers?.cookie;
  if (!cookieHeader) return null;
  try {
    return cookie.parse(cookieHeader).token || null;
  } catch {
    return null;
  }
}

function getIo(req) {
  try {
    return req?.app?.get?.("io") ?? null;
  } catch {
    return null;
  }
}

function emitToUser(req, userId, eventName, payload) {
  if (!userId || !eventName) return;
  const io = getIo(req);
  if (!io) return;
  try {
    io.to(`user:${userId.toString()}`).emit(eventName, payload);
  } catch {
    /* swallow */
  }
}

function emitToTableRoom(req, tableId, eventName, payload) {
  if (!tableId || !eventName) return;
  const io = getIo(req);
  if (!io) return;
  try {
    io.to(`table:${tableId.toString()}`).emit(eventName, payload);
  } catch {
    /* swallow */
  }
}

function emitToEventoRoom(req, eventoId, eventName, payload) {
  if (!eventoId || !eventName) return;
  const io = getIo(req);
  if (!io) return;
  try {
    io.to(`evento:${eventoId.toString()}`).emit(eventName, payload);
  } catch {
    /* swallow */
  }
}

// Broadcast a la lista pública /eventos. Sólo se debería usar para
// eventos no-draft para no leakear publicaciones internas.
function emitToEventosList(req, eventName, payload) {
  if (!eventName) return;
  const io = getIo(req);
  if (!io) return;
  try {
    io.to("eventos:list").emit(eventName, payload);
  } catch {
    /* swallow */
  }
}

function emitToAdminRoom(req, eventName, payload) {
  if (!eventName) return;
  const io = getIo(req);
  if (!io) return;
  try {
    io.to("admin:room").emit(eventName, payload);
  } catch {
    /* swallow */
  }
}

module.exports = {
  resolveHandshakeToken,
  emitToUser,
  emitToTableRoom,
  emitToEventoRoom,
  emitToEventosList,
  emitToAdminRoom,
};
