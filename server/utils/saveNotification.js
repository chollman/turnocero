const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { isSectionEnabled } = require("./siteConfig");
const logger = require("./logger");

// Mapea el id-field presente en una notif → el modelo scopeado del que sacar la
// comunidad del contenido. El primer match gana.
const ID_FIELD_TO_MODEL = [
  ["tableId", "Table"],
  ["torneoId", "Torneo"],
  ["eventoId", "Evento"],
  ["compartidaId", "Compartida"],
  ["mathtradeId", "MathTrade"],
];

// Resuelve la comunidad del CONTENIDO de la notif (para el scoping por
// subdominio). Orden:
//   1) Si el caller ya la pasó en `fields.community` → usarla (evita el lookup).
//   2) community_* → la comunidad ES el sujeto (`communityId`).
//   3) Resto de tipos de contenido → lookup lean por el id-field.
//   4) Tipos personales (dm, amistad, admin-chat) sin id-field → null.
// Usa `mongoose.model(name)` perezoso para no crear ciclos de require.
async function resolveContentCommunity(fields) {
  if (fields.community) return String(fields.community);
  if (fields.communityId) return String(fields.communityId);
  for (const [idField, modelName] of ID_FIELD_TO_MODEL) {
    if (!fields[idField]) continue;
    try {
      const Model = mongoose.model(modelName);
      const doc = await Model.findById(fields[idField])
        .select("community")
        .lean();
      return doc?.community ? String(doc.community) : null;
    } catch {
      return null;
    }
  }
  return null;
}

// These types accumulate count across multiple events for the same target
const AGGREGATING = new Set([
  "chat",
  "comment",
  "image",
  "join_request",
  "player_joined",
  "player_left",
  "dm",
  "admin_chat",
  "compartida_comment",
  "compartida_like",
  // Cuando varios users agregan juegos / crean mesas en el mismo evento,
  // los inscriptos reciben UNA notif con count incrementado por evento.
  "evento_ludoteca_added",
  "evento_mesa_created",
  // Varias solicitudes de unión a la misma comunidad → UNA notif al subadmin
  // con count + actores apilados.
  "community_join_request",
]);

// Mapea tipo de notificación → sección controlada por SiteConfig.
// Si una sección está OFF, no se persisten nuevas notificaciones de esos tipos.
// admin_chat no se mapea porque es intrínsecamente admin-only.
const TYPE_TO_SECTION = {
  chat: "mesas",
  comment: "mesas",
  image: "mesas",
  join_request: "mesas",
  join_accepted: "mesas",
  join_rejected: "mesas",
  player_joined: "mesas",
  player_left: "mesas",
  spot_opened: "mesas",
  table_cancelled: "mesas",
  friend_request: "amigos",
  friend_accepted: "amigos",
  dm: "dms",
  compartida_comment: "compartidas",
  compartida_like: "compartidas",
  tournament_accepted: "torneos",
  tournament_rejected: "torneos",
  tournament_advanced: "torneos",
  tournament_eliminated: "torneos",
  tournament_started: "torneos",
  tournament_finished: "torneos",
  // Eventos
  evento_confirmed: "eventos",
  evento_rejected: "eventos",
  evento_cancelled: "eventos",
  evento_updated: "eventos",
  evento_reminder: "eventos",
  evento_ludoteca_added: "eventos",
  evento_mesa_created: "eventos",
  // Math Trade
  mathtrade_results: "mathtrade",
  // Comunidades
  community_join_request: "comunidades",
  community_join_accepted: "comunidades",
  community_join_rejected: "comunidades",
  community_content_removed: "comunidades",
};

/**
 * Upsert a notification for a recipient.
 * @param {string|ObjectId} recipientId
 * @param {string} type  — notification type key
 * @param {object} fields — all data fields (tableId, tableName, fromUserId, payload…)
 */
async function saveNotification(recipientId, type, fields) {
  const section = TYPE_TO_SECTION[type];
  if (section && !isSectionEnabled(section)) {
    // Admins reciben notificaciones aunque la sección esté OFF (ven todas).
    try {
      const recipient = await User.findById(recipientId).select("isAdmin");
      if (!recipient?.isAdmin) return null;
    } catch {
      return null;
    }
  }

  try {
    // Resolver la comunidad del contenido (scoping por subdominio) y persistirla
    // como un campo más. No entra en la clave de upsert: es constante para un
    // mismo (recipient, type, resourceId), así que se re-setea idempotente.
    const community = await resolveContentCommunity(fields);
    fields = { ...fields, community };

    const filter = { recipient: recipientId, type };
    if (fields.tableId) filter.tableId = fields.tableId;
    if (fields.fromUserId) filter.fromUserId = fields.fromUserId;
    if (fields.torneoId) filter.torneoId = fields.torneoId;
    if (fields.compartidaId) filter.compartidaId = fields.compartidaId;
    if (fields.eventoId) filter.eventoId = fields.eventoId;
    if (fields.mathtradeId) filter.mathtradeId = fields.mathtradeId;
    if (fields.communityId) filter.communityId = fields.communityId;

    if (AGGREGATING.has(type)) {
      // `actor` no se persiste como campo plano — alimenta el array `actors`.
      const { tableName, actor, ...updateFields } = fields;
      // Update con aggregation pipeline (no `$inc`/`$setOnInsert`): permite
      // mantener `actors` dedupeado-por-userId + cap 8 en una sola operación
      // atómica. `count` sigue siendo fuente de verdad del server.
      const setStage = {
        read: false,
        count: { $add: [{ $ifNull: ["$count", 0] }, 1] },
        // tableName se setea sólo en insert (se preserva el existente).
        tableName: { $ifNull: ["$tableName", tableName || ""] },
        ...updateFields,
      };
      if (actor && actor.userId) {
        const actorId = String(actor.userId);
        setStage.actors = {
          $slice: [
            {
              $concatArrays: [
                [{ userId: actorId, username: actor.username || "" }],
                {
                  $filter: {
                    input: { $ifNull: ["$actors", []] },
                    as: "a",
                    cond: { $ne: ["$$a.userId", actorId] },
                  },
                },
              ],
            },
            8,
          ],
        };
      }
      return await Notification.findOneAndUpdate(filter, [{ $set: setStage }], {
        upsert: true,
        new: true,
      });
    }

    return await Notification.findOneAndUpdate(
      filter,
      { $set: { read: false, count: 1, ...fields } },
      { upsert: true, new: true },
    );
  } catch (err) {
    logger.error("saveNotification failed", {
      recipientId: String(recipientId),
      type,
      error: err.message,
    });
    return null;
  }
}

module.exports = saveNotification;
