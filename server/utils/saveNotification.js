const Notification = require('../models/Notification');
const User = require('../models/User');
const { isSectionEnabled } = require('./siteConfig');

// These types accumulate count across multiple events for the same target
const AGGREGATING = new Set([
  'chat', 'comment', 'image', 'join_request',
  'dm', 'admin_chat',
  'compartida_comment', 'compartida_like',
]);

// Mapea tipo de notificación → sección controlada por SiteConfig.
// Si una sección está OFF, no se persisten nuevas notificaciones de esos tipos.
// admin_chat no se mapea porque es intrínsecamente admin-only.
const TYPE_TO_SECTION = {
  chat:                  'mesas',
  comment:               'mesas',
  image:                 'mesas',
  join_request:          'mesas',
  join_accepted:         'mesas',
  join_rejected:         'mesas',
  spot_opened:           'mesas',
  table_cancelled:       'mesas',
  friend_request:        'amigos',
  friend_accepted:       'amigos',
  dm:                    'dms',
  compartida_comment:    'compartidas',
  compartida_like:       'compartidas',
  tournament_accepted:   'torneos',
  tournament_rejected:   'torneos',
  tournament_advanced:   'torneos',
  tournament_eliminated: 'torneos',
  tournament_started:    'torneos',
  tournament_finished:   'torneos',
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
    // Admins reciben notificaciones aunque la sección esté OFF (ven todo).
    try {
      const recipient = await User.findById(recipientId).select('isAdmin');
      if (!recipient?.isAdmin) return null;
    } catch {
      return null;
    }
  }

  try {
    const filter = { recipient: recipientId, type };
    if (fields.tableId)      filter.tableId      = fields.tableId;
    if (fields.fromUserId)   filter.fromUserId   = fields.fromUserId;
    if (fields.torneoId)     filter.torneoId     = fields.torneoId;
    if (fields.compartidaId) filter.compartidaId = fields.compartidaId;

    if (AGGREGATING.has(type)) {
      const { tableName, ...updateFields } = fields;
      return await Notification.findOneAndUpdate(
        filter,
        {
          $inc: { count: 1 },
          $set: { read: false, ...updateFields },
          $setOnInsert: { tableName: tableName || '' },
        },
        { upsert: true, new: true }
      );
    }

    return await Notification.findOneAndUpdate(
      filter,
      { $set: { read: false, count: 1, ...fields } },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`[saveNotification] failed for recipient=${recipientId} type=${type}:`, err.message);
    return null;
  }
}

module.exports = saveNotification;
