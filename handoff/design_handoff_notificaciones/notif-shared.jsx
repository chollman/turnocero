/* global React */
// Shared helpers + mock data for the Reimagined Notificaciones prototype.

const NotifNOW = new Date('2026-05-30T14:00:00');

function notifTimeAgo(s, now = NotifNOW.getTime()) {
  const d = new Date(s);
  const diff = now - d.getTime();
  const min = Math.round(diff / 60000);
  const hr = Math.round(diff / 3600000);
  const day = Math.round(diff / 86400000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (hr < 24) return `hace ${hr} h`;
  if (day === 1) return 'ayer';
  if (day < 7) return `hace ${day} días`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `hace ${wk} sem`;
  const mo = Math.round(day / 30);
  return `hace ${mo} mes${mo > 1 ? 'es' : ''}`;
}

function notifBucket(s, now = NotifNOW.getTime()) {
  const d = new Date(s);
  const diff = now - d.getTime();
  const day = diff / 86400000;
  const sameDay = new Date(s).toDateString() === new Date(now).toDateString();
  if (sameDay) return 'today';
  if (day < 7) return 'week';
  return 'earlier';
}

const NOTIF_BUCKETS = [
  { key: 'today',   label: 'Hoy' },
  { key: 'week',    label: 'Esta semana' },
  { key: 'earlier', label: 'Antes' },
];

// ─── Icons ─────────────────────────────────────────────────────
const NIcon = {
  Bell:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Dice:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/></svg>,
  Calendar: (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Trophy:   (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Users:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Heart:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Comment:  (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  News:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M2 15h8M2 19h8M2 11h4"/></svg>,
  Chart:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Megaphone:(p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
  Check:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:        (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Arrow:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Dot:      (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>,
  DoubleCheck: (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 13 7 18 16 7"/><polyline points="11 16 13 18 22 7"/></svg>,
  Gear:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Inbox:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
};

// ─── Notification type registry ────────────────────────────────
// Each domain has a color + icon + filter label.
const NOTIF_TYPES = {
  mesa:       { label: 'Mesas',       color: '#1888ef', icon: 'Dice' },
  evento:     { label: 'Eventos',     color: '#00aeff', icon: 'Calendar' },
  torneo:     { label: 'Torneos',     color: '#f5a623', icon: 'Trophy' },
  amigo:      { label: 'Amigos',      color: '#00d984', icon: 'Users' },
  compartida: { label: 'Compartidas', color: '#f31d77', icon: 'Heart' },
  noticia:    { label: 'Noticias',    color: '#b48cff', icon: 'News' },
  bgwatch:    { label: 'BG Watch',    color: '#00d984', icon: 'Chart' },
  sistema:    { label: 'Sistema',     color: '#5a6178', icon: 'Megaphone' },
};

// Filter groups for the chip row
const NOTIF_FILTERS = [
  { value: 'all',         label: 'Todas' },
  { value: 'unread',      label: 'Sin leer' },
  { value: 'actionable',  label: 'Requieren acción' },
  { value: 'mesa',        label: 'Mesas' },
  { value: 'evento',      label: 'Eventos' },
  { value: 'torneo',      label: 'Torneos' },
  { value: 'amigo',       label: 'Amigos' },
  { value: 'compartida',  label: 'Compartidas' },
  { value: 'sistema',     label: 'Sistema' },
];

// ─── Mock notifications ────────────────────────────────────────
// action: null | 'mesa_request' | 'friend_request' | 'evento_pending'
// actors: list of people involved (for grouped/stacked notifications)
const NOTIFS = [
  {
    id: 'n1',
    type: 'mesa',
    action: 'mesa_request',
    unread: true,
    date: '2026-05-30T13:48:00',
    actors: [{ name: 'Lucía D.', handle: 'lud', initial: 'L', color: '#f31d77' }],
    target: 'Catán · Otoño',
    title: 'Lucía D. quiere unirse a tu mesa',
    body: '"¡Me encanta Catán! ¿Queda lugar para el sábado?"',
  },
  {
    id: 'n2',
    type: 'amigo',
    action: 'friend_request',
    unread: true,
    date: '2026-05-30T13:10:00',
    actors: [{ name: 'Joaco R.', handle: 'joaco.r', initial: 'J', color: '#1888ef' }],
    target: null,
    title: 'Joaco R. te envió una solicitud de amistad',
    body: '12 amigos en común · juega Wingspan, Brass, Root',
  },
  {
    id: 'n3',
    type: 'mesa',
    action: null,
    unread: true,
    date: '2026-05-30T11:30:00',
    actors: [{ name: 'Martina V.', handle: 'martina_v', initial: 'M', color: '#1888ef' }],
    target: 'Terraforming Mars',
    title: 'Martina V. confirmó tu lugar',
    body: 'Ya sos parte de la mesa · hoy 19:30 · Café Rivas, Palermo',
    cta: 'Ver mesa',
  },
  {
    id: 'n4',
    type: 'compartida',
    action: null,
    unread: true,
    grouped: true,
    date: '2026-05-30T10:15:00',
    actors: [
      { name: 'Cami R.', initial: 'C', color: '#f5a623' },
      { name: 'Pancho M.', initial: 'P', color: '#b48cff' },
      { name: 'Vale P.', initial: 'V', color: '#00aeff' },
      { name: 'Sofi D.', initial: 'S', color: '#b48cff' },
    ],
    extraCount: 5,
    target: 'tu compartida',
    title: 'A Cami, Pancho y 7 más les gustó tu compartida',
    body: '"18 dados, ni un triple" · sobre tu partida de Catán',
    cta: 'Ver compartida',
  },
  {
    id: 'n5',
    type: 'mesa',
    action: null,
    unread: true,
    date: '2026-05-30T09:05:00',
    grouped: true,
    actors: [
      { name: 'Fede O.', initial: 'F', color: '#00d984' },
      { name: 'Sofi D.', initial: 'S', color: '#b48cff' },
    ],
    extraCount: 0,
    target: 'Catán · Otoño',
    title: '3 mensajes nuevos en el chat de la mesa',
    body: 'Fede O.: "¿Llevo algo de tomar?" · Sofi D.: "Yo llevo cervezas"',
    cta: 'Abrir chat',
    badge: 3,
  },
  {
    id: 'n6',
    type: 'evento',
    action: null,
    unread: false,
    date: '2026-05-29T18:00:00',
    actors: [{ name: 'Cami Rossi', handle: 'camir', initial: 'C', color: '#f5a623' }],
    target: 'Torneo Catán · Otoño 2026',
    title: 'Tu inscripción fue aprobada',
    body: 'Cami Rossi confirmó tu comprobante · sábado 13 jun · 17:00 hs',
    cta: 'Ver evento',
  },
  {
    id: 'n7',
    type: 'evento',
    action: 'evento_pending',
    unread: false,
    date: '2026-05-29T15:30:00',
    grouped: true,
    actors: [
      { name: 'Nico A.', initial: 'N', color: '#1888ef' },
      { name: 'Romina V.', initial: 'R', color: '#b48cff' },
      { name: 'Pablo S.', initial: 'P', color: '#f5a623' },
    ],
    extraCount: 0,
    target: 'Liga Wingspan · Fecha 4',
    title: '3 inscripciones esperan tu revisión',
    body: 'Sos host de este evento · 3 comprobantes pendientes de aprobar',
    cta: 'Revisar inscripciones',
    badge: 3,
  },
  {
    id: 'n8',
    type: 'torneo',
    action: null,
    unread: false,
    date: '2026-05-29T12:00:00',
    actors: [{ name: 'Liga TC', initial: 'TC', color: '#f5a623' }],
    target: 'Liga Mensual · Mayo',
    title: 'Se publicó la ronda 3',
    body: 'Te toca contra Diego G. · mesa 4 · resultado antes del 2 jun',
    cta: 'Ver bracket',
  },
  {
    id: 'n9',
    type: 'amigo',
    action: null,
    unread: false,
    date: '2026-05-28T20:00:00',
    actors: [{ name: 'Iri M.', handle: 'iri.m', initial: 'I', color: '#f31d77' }],
    target: null,
    title: 'Iri M. aceptó tu solicitud de amistad',
    body: 'Ahora son amigos · mirá su colección y partidas',
    cta: 'Ver perfil',
  },
  {
    id: 'n10',
    type: 'compartida',
    action: null,
    unread: false,
    date: '2026-05-28T17:20:00',
    actors: [{ name: 'Pancho M.', handle: 'panchom', initial: 'P', color: '#b48cff' }],
    target: 'tu compartida',
    title: 'Pancho M. comentó tu compartida',
    body: '"jajaja el árbitro de 9 años, lo mejor. La próxima sumalo"',
    cta: 'Responder',
  },
  {
    id: 'n11',
    type: 'bgwatch',
    action: null,
    unread: false,
    date: '2026-05-27T09:00:00',
    actors: [{ name: 'BG Watch', initial: '◆', color: '#00d984' }],
    target: null,
    title: '¡Llegaste a 100 partidas este año!',
    body: 'Wingspan es tu juego más jugado · 12 partidas este mes',
    cta: 'Ver estadísticas',
    system: true,
  },
  {
    id: 'n12',
    type: 'noticia',
    action: null,
    unread: false,
    date: '2026-05-26T11:00:00',
    actors: [{ name: 'Equipo TC', initial: 'TC', color: '#b48cff' }],
    target: null,
    title: 'Nueva nota · "Los 10 eurogames del 2026"',
    body: 'Publicada en Noticias · 6 min de lectura',
    cta: 'Leer nota',
    system: true,
  },
  {
    id: 'n13',
    type: 'sistema',
    action: null,
    unread: false,
    date: '2026-05-25T08:30:00',
    actors: [{ name: 'TurnoCero', initial: '◆', color: '#5a6178' }],
    target: null,
    title: 'Mantenimiento programado · domingo 2-4 AM',
    body: 'La plataforma puede estar intermitente durante esa ventana',
    system: true,
  },
];

// ─── Notification preference rows (for side panel) ─────────────
const NOTIF_PREFS = [
  { type: 'mesa',       push: true,  email: true  },
  { type: 'evento',     push: true,  email: true  },
  { type: 'torneo',     push: true,  email: false },
  { type: 'amigo',      push: true,  email: false },
  { type: 'compartida', push: false, email: false },
  { type: 'noticia',    push: false, email: true  },
];

Object.assign(window, {
  NIcon, NOTIF_TYPES, NOTIF_FILTERS, NOTIFS, NotifNOW,
  NOTIF_BUCKETS, NOTIF_PREFS,
  notifTimeAgo, notifBucket,
});
