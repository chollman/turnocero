const Notification = require('../models/Notification');

// These types accumulate count across multiple events for the same target
const AGGREGATING = new Set(['chat', 'comment', 'image', 'join_request', 'dm', 'admin_chat']);

/**
 * Upsert a notification for a recipient.
 * @param {string|ObjectId} recipientId
 * @param {string} type  — notification type key
 * @param {object} fields — all data fields (tableId, tableName, fromUserId, payload…)
 */
async function saveNotification(recipientId, type, fields) {
  const filter = { recipient: recipientId, type };
  if (fields.tableId)    filter.tableId    = fields.tableId;
  if (fields.fromUserId) filter.fromUserId = fields.fromUserId;
  if (fields.torneoId)   filter.torneoId   = fields.torneoId;

  if (AGGREGATING.has(type)) {
    const { tableName, ...updateFields } = fields;
    return Notification.findOneAndUpdate(
      filter,
      {
        $inc: { count: 1 },
        $set: { read: false, ...updateFields },
        $setOnInsert: { tableName: tableName || '' },
      },
      { upsert: true, new: true }
    );
  }

  return Notification.findOneAndUpdate(
    filter,
    { $set: { read: false, count: 1, ...fields } },
    { upsert: true, new: true }
  );
}

module.exports = saveNotification;
