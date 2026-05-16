const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  // Mesa
  'chat', 'comment', 'image',
  'join_request', 'join_accepted', 'join_rejected',
  'spot_opened', 'table_cancelled',
  // Amigos / mensajes
  'friend_request', 'friend_accepted',
  'dm', 'admin_chat',
  // Compartidas
  'compartida_comment', 'compartida_like',
  // Torneos
  'tournament_accepted', 'tournament_rejected',
  'tournament_advanced', 'tournament_eliminated',
  'tournament_started', 'tournament_finished',
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    read: { type: Boolean, default: false },
    count: { type: Number, default: 1 },
    // Table-related
    tableId: { type: String, default: null },
    tableName: { type: String, default: '' },
    // Friend-related
    fromUserId: { type: String, default: null },
    fromUsername: { type: String, default: '' },
    // Type-specific payload
    lastSenderUsername: String,
    lastMessagePreview: String,
    lastRequesterUsername: String,
    lastCommenterUsername: String,
    lastCommentPreview: String,
    lastUploaderUsername: String,
    // Torneo-related
    torneoId: { type: String, default: null },
    torneoTitle: { type: String, default: '' },
    round: { type: Number, default: null },
    // Compartida-related
    compartidaId: { type: String, default: null },
    compartidaTitle: { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound index for fast upsert lookups
notificationSchema.index({ recipient: 1, type: 1, tableId: 1 });
notificationSchema.index({ recipient: 1, type: 1, fromUserId: 1 });
notificationSchema.index({ recipient: 1, type: 1, torneoId: 1 });
notificationSchema.index({ recipient: 1, type: 1, compartidaId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
