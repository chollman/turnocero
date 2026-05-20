/* global React */
// Shared helpers + icons + mock data for the Reimagined Eventos prototype.

const { useState, useMemo, useEffect } = React;

// ─── Date helpers ──────────────────────────────────────────────
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const DIAS_LARGO  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_CORTO  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];

function parseDate(s) { return s ? new Date(s) : null; }

function dateParts(s) {
  const d = parseDate(s);
  if (!d) return null;
  return {
    day: d.getDate(),
    month: MESES_CORTO[d.getMonth()],
    monthLong: MESES_LARGO[d.getMonth()],
    year: d.getFullYear(),
    weekday: DIAS_CORTO[d.getDay()],
    weekdayLong: DIAS_LARGO[d.getDay()],
    time: d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    monthKey: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
    isoDate: d,
  };
}

function countdown(s, now = Date.now()) {
  const d = parseDate(s);
  if (!d) return { text: '', tone: 'past' };
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);

  if (diff < 0) {
    if (days >= 2) return { text: `hace ${days} días`, tone: 'past' };
    if (hours >= 1) return { text: `hace ${hours}h`, tone: 'past' };
    return { text: 'finalizado', tone: 'past' };
  }
  if (minutes < 60) return { text: `en ${minutes} min`, tone: 'urgent' };
  if (hours < 24) return { text: `en ${hours}h`, tone: 'urgent' };
  if (days <= 3) return { text: `en ${days} día${days > 1 ? 's' : ''}`, tone: 'urgent' };
  if (days <= 14) return { text: `en ${days} días`, tone: 'soon' };
  if (days <= 60) return { text: `en ${days} días`, tone: 'normal' };
  const weeks = Math.round(days / 7);
  if (weeks <= 12) return { text: `en ${weeks} semanas`, tone: 'normal' };
  const months = Math.round(days / 30);
  return { text: `en ${months} meses`, tone: 'normal' };
}

function formatFee(fee) {
  if (!fee || fee === 0) return 'Gratis';
  return `$${fee.toLocaleString('es-AR')}`;
}

function formatDateLong(s) {
  const p = dateParts(s);
  if (!p) return '';
  return `${p.weekdayLong} ${p.day} de ${p.monthLong}, ${p.year} · ${p.time}`;
}

// ─── Icons ─────────────────────────────────────────────────────
const Icon = {
  Pin: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  ),
  Calendar: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  Users: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  Clock: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  Money: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  ),
  Arrow: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  ),
  ArrowLeft: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
  ),
  Plus: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  Grid: () => (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/></svg>
  ),
  List: () => (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="2" width="13" height="2" rx="1"/><rect x="1" y="6.5" width="13" height="2" rx="1"/><rect x="1" y="11" width="13" height="2" rx="1"/></svg>
  ),
  Image: ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
  ),
  Check: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
  X: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  Edit: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  ),
  Trash: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
  ),
  Doc: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  ),
  Eye: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  External: ({ size = 11 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  ),
};

// ─── Mock data ────────────────────────────────────────────────
const NOW = new Date('2026-05-19T14:00:00');

const MOCK_EVENTS = [
  {
    _id: 'e1',
    title: 'Torneo Catán · Otoño 2026',
    description: 'Tercera edición del clásico torneo de Catán. Tres rondas suizas + final a cuatro. Premios para el podio, sorteo entre participantes y mesa libre después del trofeo.',
    conditions: 'Cupo confirmado al recibir el comprobante. Llegar 15 minutos antes del inicio. No se admiten reemplazos una vez sorteadas las mesas.',
    transferDetails: 'Alias: turnocero.eventos\nCBU: 0000003100001234567890\nTitular: Turnocero SRL\nIncluí tu @ usuario en la referencia.',
    eventDate: '2026-06-13T17:00:00',
    location: 'Bar La Torre, Av. Corrientes 4500, Palermo',
    fee: 3500,
    maxParticipants: 24,
    participants: 17,
    status: 'open',
    hostName: 'Cami Rossi',
    hostHandle: 'camir',
    hostInitial: 'C',
    hostColor: '#f5a623',
    hostSub: '8 eventos organizados · Comunidad desde 2023',
    image: null,
    isHost: false,
    userRegistration: null,
    confirmedRegs: [
      { name: 'Mateo F.',  initial: 'M', color: '#1888ef' },
      { name: 'Lucía D.',  initial: 'L', color: '#f31d77' },
      { name: 'Diego G.',  initial: 'D', color: '#00d984' },
      { name: 'Sofía B.',  initial: 'S', color: '#b48cff' },
      { name: 'Tomás K.',  initial: 'T', color: '#f5a623' },
      { name: 'Vale P.',   initial: 'V', color: '#00aeff' },
      { name: 'Joaco R.',  initial: 'J', color: '#1888ef' },
      { name: 'Iri M.',    initial: 'I', color: '#f31d77' },
    ],
    pendingRegs: [
      { name: 'Nico Aldama', handle: 'nicoald', initial: 'N', color: '#1888ef', submittedAt: '2026-05-18T22:14:00', comprobanteType: 'img' },
      { name: 'Romina Vega', handle: 'romi.v',  initial: 'R', color: '#b48cff', submittedAt: '2026-05-19T09:42:00', comprobanteType: 'pdf' },
      { name: 'Pablo Suárez',handle: 'pablos',  initial: 'P', color: '#f5a623', submittedAt: '2026-05-19T11:08:00', comprobanteType: 'img' },
    ],
    rejectedRegs: [
      { name: 'Test Demo', handle: 'tdemo', initial: 'T', color: '#5a6178', submittedAt: '2026-05-15T18:00:00', reviewedAt: '2026-05-16T10:00:00', notes: 'Comprobante ilegible' },
    ],
  },
  {
    _id: 'e2',
    title: 'Encuentro mensual de Wargames',
    description: 'Junta abierta para jugar wargames de cualquier escala. Traé tu juego o sumate a una mesa armada.',
    conditions: 'Entrada libre y gratuita. Cualquiera puede sumarse.',
    eventDate: '2026-05-30T15:00:00',
    location: 'Club Estrategia, Belgrano',
    fee: 0,
    maxParticipants: null,
    participants: 42,
    status: 'open',
    hostName: 'Comunidad TC',
    hostHandle: 'turnocero',
    hostInitial: 'TC',
    hostColor: '#00d984',
    hostSub: 'Cuenta oficial · Eventos comunitarios',
    image: null,
    isHost: false,
    userRegistration: 'confirmed',
  },
  {
    _id: 'e3',
    title: 'Liga Wingspan · Fecha 4',
    description: 'Cuarta fecha de la liga oficial 2026. Solo para inscriptos en la liga anual.',
    conditions: 'Reservado a participantes con liga anual activa.',
    eventDate: '2026-06-07T14:00:00',
    location: 'Casa Cultural Boedo',
    fee: 1500,
    maxParticipants: 16,
    participants: 8,
    status: 'open',
    hostName: 'Vos',
    hostHandle: 'voslohaces',
    hostInitial: 'V',
    hostColor: '#1888ef',
    image: null,
    isHost: true,
    userRegistration: null,
  },
  {
    _id: 'e4',
    title: 'Noche de Eurogames pesados',
    description: 'Brass, Gaia Project, Terra Mystica, Ark Nova. Cupo limitado.',
    conditions: 'Reservar lugar con anticipación. Sin reembolso una vez confirmado.',
    eventDate: '2026-06-21T19:30:00',
    location: 'Casa de Pancho, Caballito',
    fee: 2000,
    maxParticipants: 12,
    participants: 12,
    status: 'open',
    hostName: 'Pancho M.',
    hostHandle: 'panchom',
    hostInitial: 'P',
    hostColor: '#b48cff',
    image: null,
    isHost: false,
    userRegistration: null,
  },
  {
    _id: 'e5',
    title: 'Open Magic Commander',
    description: 'Cuatro rondas, formato relajado. Apto para todos los niveles. Inscripción + pizza incluida.',
    eventDate: '2026-07-05T13:00:00',
    location: 'Mago Local Games',
    fee: 5000,
    maxParticipants: 32,
    participants: 6,
    status: 'open',
    hostName: 'Magic LG',
    hostInitial: 'MG',
    hostColor: '#f31d77',
    image: null,
    isHost: false,
    userRegistration: 'pending',
  },
  {
    _id: 'e6',
    title: 'Demo abierta · Heat Pedal to the Metal',
    description: 'Demos del juego del año. Tres mesas paralelas a lo largo de la tarde.',
    eventDate: '2026-05-25T16:00:00',
    location: 'Stand Turnocero · Expo Lúdica',
    fee: 0,
    maxParticipants: 18,
    participants: 11,
    status: 'closed',
    hostName: 'Equipo TC',
    hostInitial: 'TC',
    hostColor: '#00aeff',
    image: null,
    isHost: false,
    userRegistration: null,
  },
  {
    _id: 'e7',
    title: 'Sesión de prueba · 7 Wonders Duel',
    description: 'Borrador interno antes de publicar la fecha oficial.',
    eventDate: '2026-08-10T18:00:00',
    location: 'Por confirmar',
    fee: 0,
    maxParticipants: null,
    participants: 0,
    status: 'draft',
    hostName: 'Vos',
    hostHandle: 'voslohaces',
    hostInitial: 'V',
    hostColor: '#1888ef',
    image: null,
    isHost: true,
    userRegistration: null,
  },
  {
    _id: 'e8',
    title: 'Torneo de Carcassonne',
    description: 'Cancelado por falta de cupo mínimo. Los inscriptos recibieron reembolso.',
    eventDate: '2026-05-18T16:00:00',
    location: 'Bar La Torre, Palermo',
    fee: 2500,
    maxParticipants: 20,
    participants: 4,
    status: 'cancelled',
    hostName: 'Cami Rossi',
    hostHandle: 'camir',
    hostInitial: 'C',
    hostColor: '#f5a623',
    image: null,
    isHost: false,
    userRegistration: null,
  },
];

// ─── Avatar primitive ─────────────────────────────────────────
function Avatar({ user, size = 'sm', square = false }) {
  const cls = ['avatar', size, square && 'square'].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ background: user.color || 'var(--accent)' }}>
      {user.initial}
    </div>
  );
}

Object.assign(window, {
  Icon, Avatar,
  MOCK_EVENTS, NOW,
  dateParts, countdown, formatFee, formatDateLong,
  MESES_LARGO, MESES_CORTO,
});
