// Helpers de Socket.IO emit usados desde routers. Antes vivían como
// funciones locales en `routes/eventos.js` (líneas ~43-69) — un patrón
// que estaba apareciendo replicado, ad-hoc, en `tables.js`, `torneos.js`
// y otros. Centralizar evita drift entre implementaciones.
//
// Todos los helpers son **best-effort**: nunca propagan errores ni rompen
// el request — un emit que falla no debería tirar el flujo HTTP.

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
  emitToUser,
  emitToTableRoom,
  emitToEventoRoom,
  emitToEventosList,
  emitToAdminRoom,
};
