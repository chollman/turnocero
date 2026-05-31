const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  // Mesa
  "chat",
  "comment",
  "image",
  "join_request",
  "join_accepted",
  "join_rejected",
  "player_joined",
  "player_left",
  "spot_opened",
  "table_cancelled",
  // Amigos / mensajes
  "friend_request",
  "friend_accepted",
  "dm",
  "admin_chat",
  // Compartidas
  "compartida_comment",
  "compartida_like",
  // Torneos
  "tournament_accepted",
  "tournament_rejected",
  "tournament_advanced",
  "tournament_eliminated",
  "tournament_started",
  "tournament_finished",
  // Eventos
  "evento_confirmed",
  "evento_rejected",
  "evento_cancelled",
  "evento_updated",
  "evento_reminder",
  // Eventos — sub-recursos (ludoteca y mesas del evento). Aggregating:
  // un usuario que agrega 3 juegos seguidos genera UNA notif con count=3.
  "evento_ludoteca_added",
  "evento_mesa_created",
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES },
    read: { type: Boolean, default: false },
    count: { type: Number, default: 1 },
    // Actores que dispararon la notif (más reciente primero, dedupeado por
    // userId, tope 8). Sólo se popula en tipos AGGREGATING cuando el call
    // site pasa `actor`. Habilita avatares apilados en la bandeja y, para
    // `join_request`, el userId del solicitante para la acción inline del host.
    actors: {
      type: [
        {
          _id: false,
          userId: { type: String },
          username: { type: String, default: "" },
        },
      ],
      default: [],
    },
    // Table-related
    tableId: { type: String, default: null },
    tableName: { type: String, default: "" },
    // Friend-related
    fromUserId: { type: String, default: null },
    fromUsername: { type: String, default: "" },
    // Type-specific payload
    lastSenderUsername: String,
    lastMessagePreview: String,
    lastRequesterUsername: String,
    lastJoinerUsername: String,
    lastLeaverUsername: String,
    lastCommenterUsername: String,
    lastCommentPreview: String,
    lastUploaderUsername: String,
    // Torneo-related
    torneoId: { type: String, default: null },
    torneoTitle: { type: String, default: "" },
    round: { type: Number, default: null },
    isPhase: { type: Boolean, default: false },
    // Compartida-related
    compartidaId: { type: String, default: null },
    compartidaTitle: { type: String, default: "" },
    // Evento-related
    eventoId: { type: String, default: null },
    eventoTitle: { type: String, default: "" },
    eventoDate: { type: Date, default: null },
    permanentlyRejected: { type: Boolean, default: false },
    // Lista de campos que cambiaron en una edición de evento (para evento_updated).
    // Strings tipo "eventDate" o "location".
    changedFields: { type: [String], default: undefined },
    // Flag para evento_cancelled cuando el evento fue ELIMINADO (no solo cancelado).
    // El cliente lo usa para que el deep-link de la notif no rompa en 404
    // — en su lugar lleva a la lista /eventos y rotula la card como "Eliminado".
    eventoDeleted: { type: Boolean, default: false },
    // Para evento_ludoteca_added: el nombre del último juego agregado y quién.
    gameName: { type: String, default: "" },
    addedByUsername: { type: String, default: "" },
    // Para evento_mesa_created: el id de la mesa creada + host. `gameName`
    // se reusa del campo de arriba (es el mismo metadata).
    eventoTableId: { type: String, default: null },
    hostUsername: { type: String, default: "" },
  },
  { timestamps: true },
);

// Compound index for fast upsert lookups
notificationSchema.index({ recipient: 1, type: 1, tableId: 1 });
notificationSchema.index({ recipient: 1, type: 1, fromUserId: 1 });
notificationSchema.index({ recipient: 1, type: 1, torneoId: 1 });
notificationSchema.index({ recipient: 1, type: 1, compartidaId: 1 });
notificationSchema.index({ recipient: 1, type: 1, eventoId: 1 });
// Auto-purge old notifications (90 days since last update). Lightweight retention policy.
notificationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
