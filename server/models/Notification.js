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
  // Math Trade
  "mathtrade_results",
  // Comunidades
  "community_join_request", // a subadmins/admins — AGREGANTE
  "community_join_accepted", // al solicitante
  "community_join_rejected", // al solicitante
  "community_content_removed", // al autor cuando un subadmin baja su contenido
  // BG Watch — partida compartida
  "bgg_play_shared", // a un co-jugador usuario de TurnoCero cuando el autor carga una partida
  "bgg_play_accepted", // al autor cuando un co-jugador carga la partida que compartió
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
    // Math Trade-related
    mathtradeId: { type: String, default: null },
    mathtradeTitle: { type: String, default: "" },
    // Comunidades-related
    communityId: { type: String, default: null },
    communityName: { type: String, default: "" },
    communitySlug: { type: String, default: "" },
    // BG Watch — partida compartida (bgg_play_shared / bgg_play_accepted).
    // `playId` es el id de la partida original en BGG: entra en la clave de
    // upsert para que cada partida sea una notif distinta (sin él, varias
    // partidas del mismo autor al mismo destinatario se pisarían).
    playId: { type: String, default: null },
    // Marca que el destinatario YA cargó la partida compartida (como aparece o
    // con correcciones). Al cargarla la notif NO se borra: pasa a leída y sin
    // botones de acción, quedando como una notif común hasta que el usuario la
    // limpie. Solo aplica a `bgg_play_shared`.
    playLoaded: { type: Boolean, default: false },
    // `gameName` (declarado arriba para eventos) se reusa para el nombre del
    // juego de la partida compartida.
    // Snapshot embebido de la partida — la tarjeta de la bandeja es
    // autosuficiente (no refetch) y sobrevive aunque el autor edite/borre la
    // partida en BGG. Solo se popula en `bgg_play_shared`.
    playSnapshot: {
      type: {
        _id: false,
        playId: String,
        gameId: String,
        gameName: String,
        gameThumbnail: String,
        gameImage: String,
        date: String,
        duration: { type: Number, default: null },
        location: String,
        comments: String,
        incomplete: Boolean,
        nowinstats: Boolean,
        quantity: Number,
        players: {
          type: [
            {
              _id: false,
              name: String,
              username: String,
              position: mongoose.Schema.Types.Mixed,
              color: String,
              score: mongoose.Schema.Types.Mixed,
              win: Boolean,
              new: Boolean,
              rating: { type: Number, default: null },
            },
          ],
          default: [],
        },
      },
      default: null,
    },
    // Comunidad a la que pertenece el CONTENIDO de esta notificación (mesa,
    // evento, torneo, compartida, etc.). Distinto de `communityId`, que es el
    // SUJETO de las notifs `community_*`. Lo usa el scoping por subdominio
    // (tenant): en un subdominio de comunidad solo se muestran las notifs cuyo
    // `community` coincide (las personales — dm/amistad/admin-chat — pasan
    // siempre porque no pertenecen a ninguna comunidad). Null en tipos
    // personales y en notifs legacy previas a este campo.
    community: { type: String, default: null },
  },
  { timestamps: true },
);

// Compound index for fast upsert lookups
notificationSchema.index({ recipient: 1, type: 1, tableId: 1 });
notificationSchema.index({ recipient: 1, type: 1, fromUserId: 1 });
notificationSchema.index({ recipient: 1, type: 1, torneoId: 1 });
notificationSchema.index({ recipient: 1, type: 1, compartidaId: 1 });
notificationSchema.index({ recipient: 1, type: 1, eventoId: 1 });
notificationSchema.index({ recipient: 1, type: 1, mathtradeId: 1 });
notificationSchema.index({ recipient: 1, type: 1, communityId: 1 });
notificationSchema.index({ recipient: 1, type: 1, playId: 1 });
// Scoping por subdominio (tenant): listar las notifs de una comunidad puntual.
notificationSchema.index({ recipient: 1, community: 1, updatedAt: -1 });
// Auto-purge old notifications (90 days since last update). Lightweight retention policy.
notificationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
