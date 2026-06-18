// Allowlist curado de tipos de notificación que disparan un Web Push al OS.
//
// No todos los 34 tipos ameritan interrumpir al usuario en el teléfono. Acá
// dejamos solo los de alto valor: cosas personales/directas, time-sensitive o
// cambios de estado SOBRE el usuario, más las de BG Watch. Los likes, fotos y
// comentarios genéricos quedan SOLO in-app (siguen llegando por Socket.IO a la
// bandeja, pero no pushean) para evitar fatiga de notificaciones.
//
// Es un Set para un check O(1) de una línea en utils/emitNotification.js.
// Tunear esta lista es el único cambio necesario para sumar/sacar un tipo.
const PUSHABLE_TYPES = new Set([
  // Directas / personales
  "dm",
  "chat",
  "admin_chat",
  // Mesas — solicitudes y cambios de estado relevantes
  "join_request",
  "join_accepted",
  "spot_opened",
  "table_cancelled",
  // Amigos
  "friend_request",
  "friend_accepted",
  // Torneos — todos son cambios de estado sobre el participante
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
  // Math Trade
  "mathtrade_results",
  // Comunidades
  "community_join_request",
  "community_join_accepted",
  "community_join_rejected",
  "community_content_removed",
  // BG Watch
  "bgg_play_shared",
  "bgg_play_accepted",
]);

module.exports = { PUSHABLE_TYPES };
