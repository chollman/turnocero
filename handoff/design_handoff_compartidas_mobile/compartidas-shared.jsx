/* global React */
const { useState, useMemo, useEffect, useRef } = React;

// ─── Helpers ───────────────────────────────────────────────────
const NOW = new Date("2026-05-19T14:00:00");

function timeAgo(s, now = NOW.getTime()) {
  const d = new Date(s);
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} días`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function formatTableDate(s) {
  const d = new Date(s);
  return d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// ─── Icons ─────────────────────────────────────────────────────
const Icon = {
  Heart: ({ filled, size = 16 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  Comment: ({ size = 16 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Image: ({ size = 16 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  Dice: ({ size = 16 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="16" cy="8" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
    </svg>
  ),
  Pin: ({ size = 13 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Lock: ({ size = 12 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Users: ({ size = 12 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Globe: ({ size = 12 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Dots: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  ),
  Send: ({ size = 14 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Wa: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.862L.057 23.886a.5.5 0 0 0 .612.612l6.05-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.51-5.166-1.396l-.37-.22-3.827.934.952-3.782-.243-.388A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  ),
  Tg: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.08 13.63l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.931z" />
    </svg>
  ),
  X: ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  Link: ({ size = 13 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  Check: ({ size = 13 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  ArrowLeft: ({ size = 12 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Close: ({ size = 14 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// ─── Mock posts ────────────────────────────────────────────────
const USERS = {
  cami: {
    initial: "C",
    color: "#f5a623",
    name: "Cami Rossi",
    handle: "camir",
    bgwatch: true,
  },
  pancho: {
    initial: "P",
    color: "#b48cff",
    name: "Pancho Méndez",
    handle: "panchom",
    bgwatch: true,
  },
  vale: {
    initial: "V",
    color: "#00aeff",
    name: "Vale Pereyra",
    handle: "valep",
    bgwatch: false,
  },
  tomi: {
    initial: "T",
    color: "#1888ef",
    name: "Tomás Kibel",
    handle: "tomik",
    bgwatch: true,
  },
  luci: {
    initial: "L",
    color: "#f31d77",
    name: "Lucía Duarte",
    handle: "luci.d",
    bgwatch: false,
  },
  joaco: {
    initial: "J",
    color: "#00d984",
    name: "Joaco Russo",
    handle: "joacor",
    bgwatch: true,
  },
  vos: {
    initial: "V",
    color: "#0076d1",
    name: "Vos",
    handle: "voslohaces",
    bgwatch: true,
  },
};

const MOCK_POSTS = [
  {
    _id: "p1",
    featured: true,
    author: USERS.cami,
    createdAt: "2026-05-18T22:30:00",
    title: "El día que tiré 18 dados y no salió ni un triple",
    body: "Cuatro horas de Catán, tres negociaciones rotas y un robo a la vista al borde de un seis-seis-seis. Terminamos comiendo pizza mientras Pancho explicaba por qué la madera vale más que la oveja. No le creemos, pero gracias.",
    privacy: "public",
    images: [{ caption: "el momento exacto" }, { caption: "la pizza" }],
    linkedTable: {
      game: "Catán",
      gameInitial: "CT",
      date: "2026-05-18T19:00:00",
      location: "Bar La Torre",
      status: "open",
      seats: 2,
    },
    likes: 24,
    comments: [
      {
        author: USERS.pancho,
        content: "la madera no se discute",
        createdAt: "2026-05-18T22:45:00",
      },
      {
        author: USERS.vale,
        content: "¿hay revancha el sábado?",
        createdAt: "2026-05-18T23:10:00",
      },
      { author: USERS.tomi, content: "😂", createdAt: "2026-05-19T08:01:00" },
    ],
    iLiked: true,
    pullQuote:
      "Cuatro horas de Catán, tres negociaciones rotas y un robo a la vista.",
  },
  {
    _id: "p2",
    author: USERS.pancho,
    createdAt: "2026-05-18T15:12:00",
    title: "",
    body: "Sesión de Brass: Birmingham con los pesos pesados. Tres horas y media, ganó Vale por dos puntos. Necesitamos urgente más mesas como esta.",
    privacy: "public",
    images: [
      { caption: "Birmingham 1850" },
      { caption: "punto final" },
      { caption: "" },
      { caption: "la mesa después" },
    ],
    linkedTable: null,
    likes: 11,
    comments: [
      {
        author: USERS.joaco,
        content: "esto es porno",
        createdAt: "2026-05-18T16:30:00",
      },
    ],
    iLiked: false,
  },
  {
    _id: "p3",
    author: USERS.vale,
    createdAt: "2026-05-18T20:08:00",
    title: "",
    body: "¡Ganamos Spirit Island en dificultad 6! 🌋 Vasija de Lágrimas + Trueno Estrepitoso, combo brutal. Casi perdemos en el turno 4 pero el invasor se olvidó de explorar Australia (??).",
    privacy: "friends",
    images: [],
    linkedTable: null,
    likes: 17,
    comments: [
      {
        author: USERS.cami,
        content: "jugamos esa combo en Junio?",
        createdAt: "2026-05-19T09:20:00",
      },
      {
        author: USERS.luci,
        content: "@vale enseñanos",
        createdAt: "2026-05-19T10:00:00",
      },
    ],
    iLiked: true,
  },
  {
    _id: "p4",
    author: USERS.tomi,
    createdAt: "2026-05-17T23:55:00",
    title: "Reseña corta: Sky Team",
    body: "Dos jugadores, dos horas, un cigarrillo nervioso. Sky Team es la mejor cooperativa que jugué este año. Cada partida es una negociación contra el reloj y vos mismo. Recomendado al 100%.",
    privacy: "public",
    images: [{ caption: "aterrizando en Tokyo" }],
    linkedTable: {
      game: "Sky Team",
      gameInitial: "SK",
      date: "2026-06-02T20:00:00",
      location: "Casa Cultural Boedo",
      status: "open",
      seats: 1,
    },
    likes: 8,
    comments: [],
    iLiked: false,
  },
  {
    _id: "p5",
    author: USERS.joaco,
    createdAt: "2026-05-17T18:22:00",
    title: "",
    body: "mini torneo de Carcassonne entre tres familias. el árbitro fue mi sobrino de 9 años. veredicto: gente más justa nunca existió.",
    privacy: "public",
    images: [{ caption: "el árbitro" }, { caption: "final tight" }],
    linkedTable: null,
    likes: 31,
    comments: [
      {
        author: USERS.cami,
        content: "😂😂😂",
        createdAt: "2026-05-17T19:00:00",
      },
      {
        author: USERS.pancho,
        content: "al sobrino sumalo a la próxima",
        createdAt: "2026-05-17T19:30:00",
      },
    ],
    iLiked: false,
  },
  {
    _id: "p6",
    author: USERS.luci,
    createdAt: "2026-05-16T20:10:00",
    title: "",
    body: "Llegué a 100 partidas registradas en BG Watch este año 🎉 La más jugada: Wingspan (14 partidas). La que más perdí: Brass. La que más gané: Splendor. ¡Vamos por otras 100!",
    privacy: "public",
    images: [],
    linkedTable: null,
    likes: 19,
    comments: [
      {
        author: USERS.tomi,
        content: "felicitaciones! 🍻",
        createdAt: "2026-05-16T20:20:00",
      },
    ],
    iLiked: true,
  },
];

// ─── Sidebar mock data ────────────────────────────────────────
const UPCOMING_TABLES = [
  {
    _id: "t1",
    game: "Wingspan",
    gameInitial: "WS",
    date: "2026-05-21T19:00:00",
    seats: 2,
    status: "open",
  },
  {
    _id: "t2",
    game: "Brass: Birmingham",
    gameInitial: "BB",
    date: "2026-05-23T15:00:00",
    seats: 0,
    status: "full",
  },
  {
    _id: "t3",
    game: "Ark Nova",
    gameInitial: "AN",
    date: "2026-05-25T18:00:00",
    seats: 1,
    status: "open",
  },
];

const TOP_GAMES = [
  { game: "Wingspan", count: 14 },
  { game: "Brass: Birmingham", count: 11 },
  { game: "Catán", count: 9 },
  { game: "Spirit Island", count: 7 },
  { game: "Ark Nova", count: 6 },
];

const BGWATCH_USER = {
  total: 100,
  thisMonth: 12,
  topGame: "Wingspan",
  username: "luci.d",
};

const PULL_QUOTE = {
  text: "Lo mejor del juego de mesa no es ganar — es discutir treinta minutos por qué la madera vale más que la oveja.",
  author: USERS.pancho,
  context: "Catán · 2026-05-18",
};

// ─── Avatar primitive ──────────────────────────────────────────
function Avatar({ user, size = "sm" }) {
  return (
    <div
      className={`avatar ${size}`}
      style={{ background: user.color || "var(--accent)" }}
    >
      {user.initial}
    </div>
  );
}

// ─── Polaroid primitive (placeholder image) ────────────────────
function Polaroid({
  caption,
  aspect = "square",
  tape = false,
  tapePos = "left",
}) {
  const aspectCls =
    aspect === "landscape"
      ? "polaroidPhotoLandscape"
      : aspect === "tall"
        ? "polaroidPhotoTall"
        : "";
  return (
    <div className="polaroid">
      {tape && <span className={`polaroidTape ${tapePos}`} />}
      <div className={`polaroidPhoto polaroidFallback ${aspectCls}`}>foto</div>
      {caption && <span className="polaroidCaption">{caption}</span>}
    </div>
  );
}

Object.assign(window, {
  Icon,
  Avatar,
  Polaroid,
  USERS,
  MOCK_POSTS,
  UPCOMING_TABLES,
  TOP_GAMES,
  BGWATCH_USER,
  PULL_QUOTE,
  NOW,
  timeAgo,
  formatTableDate,
});
