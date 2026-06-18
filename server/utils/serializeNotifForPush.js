// Serializa un doc Notification al payload mínimo que viaja en el Web Push.
//
// La gracia: el payload tiene EXACTAMENTE el shape de Notification que el
// cliente ya consume, así el service worker reusa getNotifMeta()/notifLink()
// de client/src/utils/notifDomains.js para armar el copy — única fuente de
// verdad, cero duplicación del texto de las 34 notifs.
//
// Whitelisteamos solo los campos que esas dos funciones leen (+ notifId para
// dedupe/tag y count para el "N mensajes nuevos"). Excluimos a propósito
// `playSnapshot` (puede ser grande) y `community` (scoping de tenant, que el
// SW no usa) para mantener el payload bien por debajo del límite de ~4KB de
// Web Push.

const FIELDS = [
  "type",
  "count",
  "read",
  // Mesas
  "tableId",
  "tableName",
  // Usuarios (DM / amistad / autores)
  "fromUserId",
  "fromUsername",
  // Torneos
  "torneoId",
  "torneoTitle",
  "round",
  "isPhase",
  // Compartidas
  "compartidaId",
  "compartidaTitle",
  // Eventos
  "eventoId",
  "eventoTitle",
  "eventoDeleted",
  "permanentlyRejected",
  "changedFields",
  // Math Trade
  "mathtradeId",
  "mathtradeTitle",
  // Comunidades
  "communityId",
  "communityName",
  "communitySlug",
  // BG Watch / ludoteca
  "gameName",
  "addedByUsername",
  "hostUsername",
  // Previews de mensajes / actores recientes
  "lastSenderUsername",
  "lastMessagePreview",
  "lastRequesterUsername",
  "lastJoinerUsername",
  "lastLeaverUsername",
  "lastCommenterUsername",
  "lastCommentPreview",
  "lastUploaderUsername",
];

function serializeNotifForPush(notif) {
  const n = notif?.toObject ? notif.toObject() : notif || {};
  const out = {};
  if (n._id != null) out.notifId = String(n._id);
  for (const f of FIELDS) {
    if (n[f] !== undefined && n[f] !== null) out[f] = n[f];
  }
  // Solo community_join_request lee actors[0].username — recortamos a 3 y
  // dejamos solo el username para no inflar el payload.
  if (Array.isArray(n.actors) && n.actors.length > 0) {
    out.actors = n.actors.slice(0, 3).map((a) => ({ username: a?.username || "" }));
  }
  return out;
}

module.exports = serializeNotifForPush;
