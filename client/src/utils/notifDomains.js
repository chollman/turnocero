// Registro central de dominios de notificación para la bandeja
// (`/notificaciones`). Mapea los tipos del backend (server/models/Notification.js)
// a 6 dominios con color de marca + icono, y arma el copy (title/body/cta) de
// cada fila. Antes esta lógica vivía embebida en un switch gigante dentro de
// Notifications.jsx — extraída acá para testearla una sola vez.

// type del backend → dominio de UI.
export const TYPE_DOMAIN = {
  // Mesas
  chat: "mesa",
  comment: "mesa",
  image: "mesa",
  join_request: "mesa",
  join_accepted: "mesa",
  join_rejected: "mesa",
  player_joined: "mesa",
  player_left: "mesa",
  spot_opened: "mesa",
  table_cancelled: "mesa",
  // Amigos / mensajes directos
  friend_request: "amigo",
  friend_accepted: "amigo",
  dm: "amigo",
  // Compartidas
  compartida_comment: "compartida",
  compartida_like: "compartida",
  // Torneos
  tournament_accepted: "torneo",
  tournament_rejected: "torneo",
  tournament_advanced: "torneo",
  tournament_eliminated: "torneo",
  tournament_started: "torneo",
  tournament_finished: "torneo",
  // Eventos
  evento_confirmed: "evento",
  evento_rejected: "evento",
  evento_cancelled: "evento",
  evento_updated: "evento",
  evento_reminder: "evento",
  evento_ludoteca_added: "evento",
  evento_mesa_created: "evento",
  // Admin chat
  admin_chat: "admin",
};

// Metadata por dominio. `colorVar` es un token de marca de index.css — se
// inyecta en cada fila como `--rowColor` y se usa para barra de no-leída,
// icono, pip y tintes. `icon` es la key dentro de NotifIcons.
// Preparado para sumar noticia/bgwatch/sistema cuando esos notifs existan.
export const DOMAIN_META = {
  mesa: { label: "Mesas", colorVar: "--amber", icon: "Dice" },
  evento: { label: "Eventos", colorVar: "--purple", icon: "Calendar" },
  torneo: { label: "Torneos", colorVar: "--orange", icon: "Trophy" },
  amigo: { label: "Amigos", colorVar: "--green", icon: "Users" },
  compartida: { label: "Compartidas", colorVar: "--red", icon: "Heart" },
  admin: { label: "Admin", colorVar: "--text-muted", icon: "Megaphone" },
};

export const getDomain = (type) => TYPE_DOMAIN[type] || "mesa";
export const getDomainMeta = (type) => DOMAIN_META[getDomain(type)];

// Tipos que el usuario puede resolver inline desde la bandeja (aceptar/rechazar).
export const ACTIONABLE_TYPES = new Set(["friend_request", "join_request"]);
export const isActionable = (n) => ACTIONABLE_TYPES.has(n?.type) && !n?.read;

// Tipos agregables → mostramos un badge numérico con `count` cuando > 1.
const COUNT_BADGE_TYPES = new Set([
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
  "evento_ludoteca_added",
  "evento_mesa_created",
]);

export const getCountBadge = (n) =>
  COUNT_BADGE_TYPES.has(n?.type) && (n?.count || 0) > 1 ? n.count : null;

// ── Buckets de tiempo (Hoy / Esta semana / Antes) ──────────────────────
export const NOTIF_BUCKETS = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "earlier", label: "Antes" },
];

export function notifBucket(date, now = Date.now()) {
  const d = new Date(date);
  const ts = d.getTime();
  if (isNaN(ts)) return "earlier";
  const sameDay = d.toDateString() === new Date(now).toDateString();
  if (sameDay) return "today";
  if ((now - ts) / 86400000 < 7) return "week";
  return "earlier";
}

// ── Ruta de navegación del recurso ─────────────────────────────────────
export function notifLink(n) {
  if (n.type === "admin_chat") return "/mensajes-admin";
  if (n.type === "dm") return `/mensajes/${n.fromUserId}`;
  if (n.compartidaId) return `/compartidas/${n.compartidaId}`;
  if (n.type?.startsWith("evento_")) {
    // Evento eliminado: el detalle tira 404 → mandamos a la lista.
    return n.eventoDeleted ? "/eventos" : `/eventos/${n.eventoId}`;
  }
  if (n.type?.startsWith("tournament_")) return `/torneos/${n.torneoId}`;
  if (n.fromUserId) return `/usuarios/${n.fromUserId}`;
  return `/mesas/${n.tableId}`;
}

// Nombre del recurso (para el `target` del topline: "· Catán").
export function notifTarget(n) {
  if (n.type === "admin_chat") return "Chat de admins";
  return (
    n.tableName ||
    n.torneoTitle ||
    n.compartidaTitle ||
    n.eventoTitle ||
    n.fromUsername ||
    null
  );
}

const trunc = (s, max = 60) => (s ? `${s}${s.length >= max ? "…" : ""}` : "");

// ── Copy por tipo: { title, body, cta } ─────────────────────────────────
// title = línea principal · body = subtexto · cta = label del botón ghost.
export function getNotifMeta(n) {
  switch (n.type) {
    case "join_request":
      return {
        title:
          n.count > 1
            ? `${n.count} personas quieren unirse a tu mesa`
            : `${n.lastRequesterUsername} quiere unirse a tu mesa`,
        body: n.tableName ? `Mesa de ${n.tableName}` : "",
        cta: "Ver solicitudes",
      };
    case "join_accepted":
      return {
        title: "¡Te aceptaron en la mesa!",
        body: `Ya sos parte de la mesa de ${n.tableName}`,
        cta: "Ver mesa",
      };
    case "join_rejected":
      return {
        title: "Solicitud rechazada",
        body: `Tu solicitud para ${n.tableName} fue rechazada`,
        cta: "Ver mesas",
      };
    case "player_joined":
      return {
        title:
          n.count > 1
            ? `${n.count} jugadores nuevos en tu mesa`
            : `${n.lastJoinerUsername} se unió a tu mesa`,
        body: n.tableName ? `Mesa de ${n.tableName}` : "",
        cta: "Ver mesa",
      };
    case "player_left":
      return {
        title:
          n.count > 1
            ? `${n.count} jugadores dejaron tu mesa`
            : `${n.lastLeaverUsername} dejó tu mesa`,
        body: n.tableName ? `Mesa de ${n.tableName}` : "",
        cta: "Ver mesa",
      };
    case "spot_opened":
      return {
        title: "¡Se liberó un lugar!",
        body: `Hay lugar en ${n.tableName}`,
        cta: "Ver mesa",
      };
    case "table_cancelled":
      return {
        title: "Mesa cancelada",
        body: `Se canceló ${n.tableName}`,
        cta: null,
      };
    case "chat":
      return {
        title:
          n.count > 1
            ? `${n.count} mensajes nuevos en el chat`
            : "Mensaje nuevo en el chat",
        body: `${n.lastSenderUsername}: ${trunc(n.lastMessagePreview)}`,
        cta: "Abrir chat",
      };
    case "comment": {
      // Copy neutral: el destinatario puede ser el host O alguien que también
      // comentó el hilo (respuestas), así que no decimos "tu mesa".
      const dondeM = n.tableName ? `la mesa de ${n.tableName}` : "una mesa";
      return {
        title:
          n.count > 1
            ? `${n.count} comentarios nuevos en ${dondeM}`
            : `${n.lastCommenterUsername} comentó ${dondeM}`,
        body: trunc(n.lastCommentPreview),
        cta: "Ver mesa",
      };
    }
    case "image":
      return {
        title:
          n.count > 1 ? `${n.count} fotos nuevas` : "Foto nueva en la mesa",
        body: `${n.lastUploaderUsername} subió ${n.count > 1 ? "fotos" : "una foto"}`,
        cta: "Ver mesa",
      };
    case "friend_request":
      return {
        title: `${n.fromUsername} te envió una solicitud de amistad`,
        body: "",
        cta: "Ver perfil",
      };
    case "friend_accepted":
      return {
        title: `${n.fromUsername} aceptó tu solicitud`,
        body: "Ahora son amigos",
        cta: "Ver perfil",
      };
    case "dm":
      return {
        title:
          n.count > 1
            ? `${n.count} mensajes nuevos de ${n.fromUsername}`
            : `${n.fromUsername} te escribió`,
        body: trunc(n.lastMessagePreview),
        cta: "Responder",
      };
    case "admin_chat":
      return {
        title:
          n.count > 1
            ? `${n.count} mensajes nuevos en el chat de admins`
            : "Mensaje nuevo en el chat de admins",
        body: `${n.lastSenderUsername}: ${trunc(n.lastMessagePreview)}`,
        cta: "Abrir chat",
      };
    case "compartida_comment": {
      // Copy neutral: el destinatario puede ser el autor del post O alguien
      // que también comentó el hilo, así que no decimos "tu compartida".
      const dondeC = n.compartidaTitle
        ? `«${n.compartidaTitle}»`
        : "una compartida";
      return {
        title:
          n.count > 1
            ? `${n.count} comentarios nuevos en ${dondeC}`
            : `${n.lastCommenterUsername} comentó ${dondeC}`,
        body: trunc(n.lastCommentPreview),
        cta: "Responder",
      };
    }
    case "compartida_like":
      return {
        title:
          n.count > 1
            ? `A ${n.lastSenderUsername} y ${n.count - 1} más les gustó tu compartida`
            : `A ${n.lastSenderUsername} le gustó tu compartida`,
        body: n.compartidaTitle ? `“${n.compartidaTitle}”` : "",
        cta: "Ver compartida",
      };
    case "tournament_accepted":
      return {
        title: "¡Inscripción aprobada!",
        body: `Estás dentro de ${n.torneoTitle || "el torneo"}`,
        cta: "Ver torneo",
      };
    case "tournament_rejected":
      return {
        title: "Inscripción rechazada",
        body: `Tu inscripción al torneo fue rechazada`,
        cta: "Ver torneo",
      };
    case "tournament_advanced": {
      const label = n.isPhase ? "fase" : "ronda";
      const nextNum = n.round != null ? n.round + 1 : null;
      return {
        title: `¡Pasaste de ${label}!`,
        body: `Avanzaste a la ${nextNum != null ? `${label} ${nextNum}` : `siguiente ${label}`}`,
        cta: "Ver torneo",
      };
    }
    case "tournament_eliminated":
      return {
        title: "Quedaste fuera del torneo",
        body: "Suerte la próxima 🎲",
        cta: "Ver torneo",
      };
    case "tournament_started":
      return {
        title: "¡Empezó el torneo!",
        body: `${n.torneoTitle || "El torneo"} ya está en juego`,
        cta: "Ver torneo",
      };
    case "tournament_finished":
      return {
        title: "Torneo finalizado",
        body: `Terminó ${n.torneoTitle || "el torneo"}`,
        cta: "Ver torneo",
      };
    case "evento_confirmed":
      return {
        title: "¡Inscripción confirmada!",
        body: `Estás dentro de ${n.eventoTitle}`,
        cta: "Ver evento",
      };
    case "evento_rejected":
      return {
        title: n.permanentlyRejected
          ? "Inscripción rechazada (permanente)"
          : "Inscripción rechazada",
        body: n.permanentlyRejected
          ? `No podrás volver a inscribirte a ${n.eventoTitle}`
          : `Tu inscripción a ${n.eventoTitle} fue rechazada`,
        cta: n.permanentlyRejected ? null : "Ver evento",
      };
    case "evento_cancelled":
      return {
        title: n.eventoDeleted ? "Evento eliminado" : "Evento cancelado",
        body: n.eventoDeleted
          ? `${n.eventoTitle} ya no está disponible`
          : `Se canceló ${n.eventoTitle}`,
        cta: n.eventoDeleted ? "Ver eventos" : "Ver evento",
      };
    case "evento_updated": {
      const fields = Array.isArray(n.changedFields) ? n.changedFields : [];
      const labels = fields.map((f) =>
        f === "eventDate"
          ? "nueva fecha"
          : f === "location"
            ? "nueva ubicación"
            : f,
      );
      const detail = labels.length > 0 ? labels.join(" + ") : "cambios";
      return {
        title: "Cambios en el evento",
        body: `${n.eventoTitle}: ${detail}`,
        cta: "Ver evento",
      };
    }
    case "evento_reminder":
      return {
        title: `${n.eventoTitle} es mañana`,
        body: "Recordatorio del evento",
        cta: "Ver evento",
      };
    case "evento_ludoteca_added": {
      const who = n.addedByUsername || "alguien";
      const game = n.gameName ? `“${n.gameName}”` : "un juego";
      return {
        title:
          n.count > 1
            ? `${n.count} juegos nuevos en la ludoteca`
            : `${who} sumó un juego a la ludoteca`,
        body: `${who} sumó ${game} a ${n.eventoTitle}`,
        cta: "Ver evento",
      };
    }
    case "evento_mesa_created": {
      const who = n.hostUsername || "alguien";
      const game = n.gameName ? `“${n.gameName}”` : "una partida";
      return {
        title:
          n.count > 1
            ? `${n.count} mesas nuevas en el evento`
            : `${who} armó una mesa en el evento`,
        body: `${who} armó ${game} en ${n.eventoTitle}`,
        cta: "Ver evento",
      };
    }
    default:
      return {
        title: "Notificación nueva",
        body: trunc(n.lastMessagePreview),
        cta: null,
      };
  }
}
