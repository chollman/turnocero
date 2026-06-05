// Catálogo centralizado de paths de la API TurnoCero. Fuente única de
// verdad — cualquier cambio de URL del server se refleja acá y los call
// sites lo heredan sin tener que grep-replace.
//
// Convención: namespace por dominio. Paths fijos como string constants;
// paths con params como funciones que devuelven el path.
//
// Uso:
//   import { API } from "@/api/endpoints";
//   axios.get(API.tables.LIST);
//   axios.get(API.bgg.PARTIDAS("claudio"));
//   axios.patch(API.notifications.READ, { tableId: "t1" });
//
// Si necesitás query strings los armás afuera con URLSearchParams o
// pasás `{ params }` a axios — no embebemos query en los builders para
// que sigan siendo lookup-tables puras.
//
// Cualquier param dinámico que vaya en el path se pasa por
// encodeURIComponent — los bggUsername pueden tener caracteres especiales
// y los IDs pueden venir de input no sanitizado.

const enc = encodeURIComponent;

export const API = {
  // ── Auth ─────────────────────────────────────────────────────────────
  auth: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
    PROFILE: "/api/auth/profile",
    AVATAR: "/api/auth/avatar",
    VERIFY_EMAIL: "/api/auth/verify-email",
    RESEND_VERIFICATION: "/api/auth/resend-verification",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
    OAUTH_GOOGLE: "/api/auth/oauth/google",
    OAUTH_FACEBOOK: "/api/auth/oauth/facebook",
    BGG_CONNECT: "/api/auth/bgg-connect",
    BGG_CONNECTION: "/api/auth/bgg-connection",
  },

  // ── BGG (BG Watch) ───────────────────────────────────────────────────
  bgg: {
    SEARCH: "/api/bgg/search",
    GAME: (id) => `/api/bgg/game/${enc(id)}`,
    COLECCION: (bggUsername) => `/api/bgg/coleccion/${enc(bggUsername)}`,
    PARTIDAS: (bggUsername) => `/api/bgg/partidas/${enc(bggUsername)}`,
    PARTIDA_DETAIL: (playId) => `/api/bgg/partidas/${enc(playId)}`,
    PARTIDA: (bggUsername, playId) =>
      `/api/bgg/partida/${enc(bggUsername)}/${enc(playId)}`,
    PARTIDAS_LIST: "/api/bgg/partidas",
    JUEGOS_JUGADOS: (bggUsername) =>
      `/api/bgg/juegos-jugados/${enc(bggUsername)}`,
    MIS_JUEGOS: (bggUsername) => `/api/bgg/mis-juegos/${enc(bggUsername)}`,
    MIS_UBICACIONES: (bggUsername) =>
      `/api/bgg/mis-ubicaciones/${enc(bggUsername)}`,
    MIS_JUGADORES: (bggUsername) =>
      `/api/bgg/mis-jugadores/${enc(bggUsername)}`,
    JUGADO: (bggUsername, gameId) =>
      `/api/bgg/jugado/${enc(bggUsername)}/${enc(gameId)}`,
    SYNC: "/api/bgg/sync",
    OG: (bggUsername) => `/api/bgg/og/${enc(bggUsername)}`,
  },

  // ── Tables ───────────────────────────────────────────────────────────
  tables: {
    LIST: "/api/tables",
    SHOWCASE: "/api/tables/showcase",
    MINE: "/api/tables/mine",
    MY_FEED: "/api/tables/me/feed",
    TOP_GAMES: "/api/tables/top-games",
    DETAIL: (id) => `/api/tables/${enc(id)}`,
    JOIN: (id) => `/api/tables/${enc(id)}/join`,
    REQUEST: (id) => `/api/tables/${enc(id)}/request`,
    LEAVE: (id) => `/api/tables/${enc(id)}/leave`,
    FOLLOW: (id) => `/api/tables/${enc(id)}/follow`,
    REQUEST_ACCEPT: (id, userId) =>
      `/api/tables/${enc(id)}/requests/${enc(userId)}/accept`,
    REQUEST_REJECT: (id, userId) =>
      `/api/tables/${enc(id)}/requests/${enc(userId)}/reject`,
    MESSAGES: (id) => `/api/tables/${enc(id)}/messages`,
    COMMENTS: (id) => `/api/tables/${enc(id)}/comments`,
    COMMENT_DETAIL: (id, commentId) =>
      `/api/tables/${enc(id)}/comments/${enc(commentId)}`,
    IMAGES: (id) => `/api/tables/${enc(id)}/images`,
    IMAGE_DETAIL: (id, imageId) =>
      `/api/tables/${enc(id)}/images/${enc(imageId)}`,
    RATINGS: (id) => `/api/tables/${enc(id)}/ratings`,
  },

  // ── Compartidas ──────────────────────────────────────────────────────
  compartidas: {
    LIST: "/api/compartidas",
    DETAIL: (id) => `/api/compartidas/${enc(id)}`,
    OG: (id) => `/api/compartidas/${enc(id)}/og`,
    LIKE: (id) => `/api/compartidas/${enc(id)}/like`,
    IMAGES: (id) => `/api/compartidas/${enc(id)}/images`,
    INLINE_IMAGE: "/api/compartidas/inline-image",
    IMAGE_DETAIL: (id, imgId) =>
      `/api/compartidas/${enc(id)}/images/${enc(imgId)}`,
    COMMENTS: (id) => `/api/compartidas/${enc(id)}/comments`,
    COMMENT_DETAIL: (id, cid) =>
      `/api/compartidas/${enc(id)}/comments/${enc(cid)}`,
  },

  // ── Noticias ─────────────────────────────────────────────────────────
  noticias: {
    LIST: "/api/noticias",
    DETAIL: (id) => `/api/noticias/${enc(id)}`,
  },

  // ── Torneos ──────────────────────────────────────────────────────────
  torneos: {
    LIST: "/api/torneos",
    DETAIL: (id) => `/api/torneos/${enc(id)}`,
    REGISTER: (id) => `/api/torneos/${enc(id)}/register`,
    REGISTRATION_ACCEPT: (id, userId) =>
      `/api/torneos/${enc(id)}/registrations/${enc(userId)}/accept`,
    REGISTRATION_REJECT: (id, userId) =>
      `/api/torneos/${enc(id)}/registrations/${enc(userId)}/reject`,
    PARTICIPANT: (id, userId) =>
      `/api/torneos/${enc(id)}/participants/${enc(userId)}`,
    SEEDS: (id) => `/api/torneos/${enc(id)}/seeds`,
    STATUS: (id) => `/api/torneos/${enc(id)}/status`,
    MATCHES: (id) => `/api/torneos/${enc(id)}/matches`,
    MATCH_RESULT: (id, matchId) =>
      `/api/torneos/${enc(id)}/matches/${enc(matchId)}/result`,
    STANDINGS: (id) => `/api/torneos/${enc(id)}/standings`,
    GROUPS: (id) => `/api/torneos/${enc(id)}/groups`,
    GROUP_ADVANCED: (id, groupId) =>
      `/api/torneos/${enc(id)}/groups/${enc(groupId)}/advanced`,
    GAME_RESULT: (id, gameId) =>
      `/api/torneos/${enc(id)}/games/${enc(gameId)}/result`,
    NEXT_PHASE: (id) => `/api/torneos/${enc(id)}/next-phase`,
    NEXT_PHASE_PREVIEW: (id) => `/api/torneos/${enc(id)}/next-phase/preview`,
    RESET: (id) => `/api/torneos/${enc(id)}/reset`,
  },

  // ── Math Trade ───────────────────────────────────────────────────────
  mathtrade: {
    LIST: "/api/mathtrade",
    DETAIL: (id) => `/api/mathtrade/${enc(id)}`,
    STATUS: (id) => `/api/mathtrade/${enc(id)}/status`,
    ITEMS: (id) => `/api/mathtrade/${enc(id)}/items`,
    MY_ITEMS: (id) => `/api/mathtrade/${enc(id)}/my-items`,
    ITEM: (id, itemId) => `/api/mathtrade/${enc(id)}/items/${enc(itemId)}`,
    RUN_MATCHING: (id) => `/api/mathtrade/${enc(id)}/run-matching`,
    RUN_MATCHING_PREVIEW: (id) =>
      `/api/mathtrade/${enc(id)}/run-matching/preview`,
    RESULTS: (id) => `/api/mathtrade/${enc(id)}/results`,
  },

  // ── Eventos ──────────────────────────────────────────────────────────
  eventos: {
    LIST: "/api/eventos",
    MINE: "/api/eventos/mine",
    DETAIL: (id) => `/api/eventos/${enc(id)}`,
    INSCRIBIRSE: (id) => `/api/eventos/${enc(id)}/inscribirse`,
    INSCRIPCIONES: (id) => `/api/eventos/${enc(id)}/inscripciones`,
    INSCRIPCION_CONFIRMAR: (id, userId) =>
      `/api/eventos/${enc(id)}/inscripciones/${enc(userId)}/confirmar`,
    INSCRIPCION_RECHAZAR: (id, userId) =>
      `/api/eventos/${enc(id)}/inscripciones/${enc(userId)}/rechazar`,
    INSCRIPCION_REVERTIR: (id, userId) =>
      `/api/eventos/${enc(id)}/inscripciones/${enc(userId)}/revertir`,
    MESAS: (id) => `/api/eventos/${enc(id)}/mesas`,
    LUDOTECA: (id) => `/api/eventos/${enc(id)}/ludoteca`,
    LUDOTECA_ITEM: (id, itemId) =>
      `/api/eventos/${enc(id)}/ludoteca/${enc(itemId)}`,
  },

  // ── Calendario (vista unificada read-only) ───────────────────────────
  calendario: {
    LIST: "/api/calendario",
  },

  // ── Comunidades ──────────────────────────────────────────────────────
  comunidades: {
    LIST: "/api/comunidades",
    MIAS: "/api/comunidades/mias",
    PREFERENCIAS: "/api/comunidades/preferencias",
    DETAIL: (slug) => `/api/comunidades/${enc(slug)}`,
    JOIN: (slug) => `/api/comunidades/${enc(slug)}/join`,
    LEAVE: (slug) => `/api/comunidades/${enc(slug)}/leave`,
    REASSIGN_TO_BASE: (slug) =>
      `/api/comunidades/${enc(slug)}/reasignar-a-base`,
    SKIN: (slug) => `/api/comunidades/${enc(slug)}/skin`,
    LOGO: (slug) => `/api/comunidades/${enc(slug)}/logo`,
    SOLICITUDES: (slug) => `/api/comunidades/${enc(slug)}/solicitudes`,
    SOLICITUD_ACCEPT: (slug, userId) =>
      `/api/comunidades/${enc(slug)}/solicitudes/${enc(userId)}/aceptar`,
    SOLICITUD_REJECT: (slug, userId) =>
      `/api/comunidades/${enc(slug)}/solicitudes/${enc(userId)}/rechazar`,
    MIEMBROS: (slug) => `/api/comunidades/${enc(slug)}/miembros`,
    MIEMBRO: (slug, userId) =>
      `/api/comunidades/${enc(slug)}/miembros/${enc(userId)}`,
    SUBADMIN: (slug, userId) =>
      `/api/comunidades/${enc(slug)}/subadmins/${enc(userId)}`,
  },

  // ── Friends ──────────────────────────────────────────────────────────
  friends: {
    REQUEST: (id) => `/api/friends/${enc(id)}/request`,
    ACCEPT: (id) => `/api/friends/${enc(id)}/accept`,
    REJECT: (id) => `/api/friends/${enc(id)}/reject`,
    UNFRIEND: (id) => `/api/friends/${enc(id)}`,
  },

  // ── Notifications ────────────────────────────────────────────────────
  notifications: {
    LIST: "/api/notifications",
    READ: "/api/notifications/read",
    CLEAR: "/api/notifications",
    DISMISS: (id) => `/api/notifications/${enc(id)}`,
  },

  // ── Direct messages ──────────────────────────────────────────────────
  dm: {
    CONVERSATIONS: "/api/dm",
    HISTORY: (userId) => `/api/dm/${enc(userId)}`,
    SEND: (userId) => `/api/dm/${enc(userId)}`,
    READ: (userId) => `/api/dm/${enc(userId)}/read`,
  },

  // ── Admin chat ───────────────────────────────────────────────────────
  adminChat: {
    LIST: "/api/admin-chat",
    SEND: "/api/admin-chat",
    READ: "/api/admin-chat/read",
  },

  // ── Site config (sección toggles) ────────────────────────────────────
  siteConfig: "/api/site-config",

  // ── Users ────────────────────────────────────────────────────────────
  users: {
    LIST: "/api/users",
    DETAIL: (id) => `/api/users/${enc(id)}`,
    BY_BGG_USERNAMES: "/api/users/by-bgg-usernames",
    JUGADORES: "/api/users/jugadores",
  },

  // ── Admin DB explorer + user moderation ─────────────────────────────
  admin: {
    COLLECTIONS: "/api/admin/collections",
    COLLECTION_DETAIL: (name) => `/api/admin/collections/${enc(name)}`,
    USER_BAN: (userId) => `/api/admin/users/${enc(userId)}/ban`,
    USER_DELETE: (userId) => `/api/admin/users/${enc(userId)}`,
    USER_TOGGLE_ADMIN: (userId) => `/api/admin/users/${enc(userId)}/admin`,
  },

  // ── Geocoding ────────────────────────────────────────────────────────
  geocode: "/api/geocode",

  // ── YouTube (tutoriales "Como se juega") ─────────────────────────────
  youtube: {
    COMO_SE_JUEGA: "/api/youtube/como-se-juega",
    VIDEO: (id) => `/api/youtube/video/${enc(id)}`,
  },

  // ── Ideas (Colabora) ─────────────────────────────────────────────────
  ideas: {
    LIST: "/api/ideas",
    DETAIL: (id) => `/api/ideas/${enc(id)}`,
  },

  // ── Health ───────────────────────────────────────────────────────────
  health: "/api/health",
};
