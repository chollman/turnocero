const saveNotification = require("./saveNotification");

/**
 * Persist a notification and emit a Socket.IO event to the recipient's room.
 *
 * Contract: every socket event emitted for a persisted notification MUST go
 * through this helper. The emitted payload always includes:
 *   - `notifId`: the Notification document's _id (string)
 *   - `count`:   the absolute post-upsert count (server is the source of truth)
 *   - `timestamp`: the doc's updatedAt
 *
 * The client uses these to dedupe (mergeNotifs by notifId) and to set its
 * counter directly from `count` instead of incrementing locally — eliminating
 * client/server drift and the double-count class of bugs.
 *
 * @param {Object}   opts
 * @param {Object}   opts.io           Socket.IO server instance (required)
 * @param {string}   opts.recipientId  User id to notify
 * @param {string}   opts.type         Notification type (NOTIFICATION_TYPES enum)
 * @param {Object}   opts.fields       Fields persisted on the Notification doc
 * @param {string}   opts.socketEvent  Socket event name to emit (e.g. 'chat:notification')
 * @param {Object}   [opts.extra={}]   Extra payload fields to include in the emit (not persisted)
 * @param {string}   [opts.room]       Override room (defaults to `user:<recipientId>`)
 * @returns {Promise<Object|null>}     The persisted Notification doc, or null if section disabled / save failed
 */
async function emitNotification({
  io,
  recipientId,
  type,
  fields = {},
  socketEvent,
  extra = {},
  room,
}) {
  // Aceptar tanto ObjectId/string/mongoose-doc — el room hash necesita un
  // string id. Si pasan un doc populado, sacamos _id.toString().
  const recipientIdStr = recipientId?._id
    ? recipientId._id.toString()
    : (recipientId?.toString?.() ?? String(recipientId));

  const notif = await saveNotification(recipientIdStr, type, fields);
  if (!notif) return null; // section disabled, save failed, etc.
  if (!io || !socketEvent) return notif;

  // `actor` (singular) sólo alimenta el array `actors` del doc — no se emite
  // suelto. En su lugar mandamos el `actors` autoritativo post-upsert para
  // que el cliente pinte los avatares apilados en tiempo real.
  const { actor: _actor, ...emitFields } = fields;
  const targetRoom = room || `user:${recipientIdStr}`;
  io.to(targetRoom).emit(socketEvent, {
    ...emitFields,
    ...extra,
    notifId: notif._id.toString(),
    count: notif.count,
    actors: notif.actors,
    timestamp: notif.updatedAt,
  });
  return notif;
}

/**
 * Convenience wrapper for routes — pulls `io` from `req.app.get('io')`.
 */
function emitNotificationReq(
  req,
  recipientId,
  type,
  fields,
  socketEvent,
  extra,
) {
  return emitNotification({
    io: req.app.get("io"),
    recipientId,
    type,
    fields,
    socketEvent,
    extra,
  });
}

module.exports = emitNotification;
module.exports.emitNotificationReq = emitNotificationReq;
