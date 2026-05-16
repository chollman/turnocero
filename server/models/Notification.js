const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, required: true },
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
