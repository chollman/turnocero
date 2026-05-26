/* global React */
// Shared helpers + mock data for the Reimagined Mesas prototype.

const MesasNOW = new Date('2026-05-19T14:00:00');

const MesasMESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const MesasMESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MesasDIAS_CORTO = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const MesasDIAS_LARGO = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function mesasParseDate(s) { return s ? new Date(s) : null; }
function mesasDateParts(s) {
  const d = mesasParseDate(s);
  if (!d) return null;
  return {
    day: d.getDate(),
    month: MesasMESES_CORTO[d.getMonth()],
    monthLong: MesasMESES_LARGO[d.getMonth()],
    year: d.getFullYear(),
    weekday: MesasDIAS_CORTO[d.getDay()],
    weekdayLong: MesasDIAS_LARGO[d.getDay()],
    time: d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    iso: d,
  };
}

function mesasCountdown(s, now = MesasNOW.getTime()) {
  const d = mesasParseDate(s);
  if (!d) return { text: '', tone: 'past' };
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  if (diff < 0) {
    if (days >= 1) return { text: `hace ${days} día${days>1?'s':''}`, tone: 'past' };
    if (hours >= 1) return { text: `hace ${hours}h`, tone: 'past' };
    return { text: 'finalizada', tone: 'past' };
  }
  if (minutes < 60) return { text: `en ${minutes} min`, tone: 'urgent' };
  if (hours < 24) return { text: `en ${hours}h`, tone: 'urgent' };
  if (days <= 3) return { text: `en ${days} día${days>1?'s':''}`, tone: 'urgent' };
  if (days <= 14) return { text: `en ${days} días`, tone: 'soon' };
  return { text: `en ${days} días`, tone: 'normal' };
}

function mesasHorizon(s, now = MesasNOW.getTime()) {
  const d = mesasParseDate(s);
  if (!d) return 'past';
  const diff = d.getTime() - now;
  if (diff < 0) return 'past';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'thisWeek';
  return 'later';
}

const MESAS_HORIZONS = [
  { key: 'today',    label: 'Hoy',           sub: 'a punto de empezar' },
  { key: 'tomorrow', label: 'Mañana',        sub: '24 horas' },
  { key: 'thisWeek', label: 'Esta semana',   sub: 'próximos 7 días' },
  { key: 'later',    label: 'Próximamente',  sub: 'más adelante' },
];

// Icons — extend tc-shared.Icon-like set for mesas
const MesaIcon = {
  Pin:       (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Users:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Clock:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Lock:      (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Globe:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>,
  Dice:      (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/></svg>,
  Arrow:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  ArrowLeft: (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Plus:      (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Check:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:         (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Edit:      (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>,
  Search:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Grid:      (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/></svg>,
  List:      (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="2" width="13" height="2" rx="1"/><rect x="1" y="6.5" width="13" height="2" rx="1"/><rect x="1" y="11" width="13" height="2" rx="1"/></svg>,
  Send:      (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Crown:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="currentColor"><path d="M2 7l4 12h12l4-12-6 4-4-9-4 9-6-4z"/></svg>,
  Chair:     (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v8h12V4M6 12v8M18 12v8M4 12h16"/></svg>,
};

// ──── Mesa MOCK DATA ─────────────────────────────────────────
// Each mesa: id, game, date, location, maxPlayers (extra seats beyond host),
// players (other than host), host, privacy, description, rules, seed (for mosaic),
// rated, chat preview, etc.

const MESAS = [
  {
    _id: 'm1',
    game: 'Terraforming Mars',
    gameSeed: 7,
    date: '2026-05-19T19:30:00',                       // Hoy
    location: 'Café Rivas · Palermo',
    maxPlayers: 4,                                     // 4 jugadores totales (host + 3)
    privacy: 'public',
    description: 'Partida tranqui, llevo expansiones (Prelude + Venus). Bienvenidos novatos, explico reglas.',
    rules: 'Llevar algo para picar. Empezamos puntual 19:30 y la idea es terminar 23h. Sin alianzas.',
    tags: ['Estrategia', 'Largo', '120-180min'],
    host: { name: 'Martina V.', handle: 'martina_v', initial: 'M', color: '#1888ef', rating: 4.8, games: 23 },
    players: [
      { name: 'Tomás K.', handle: 'tomik', initial: 'T', color: '#f5a623' },
      { name: 'Vale P.', handle: 'valep',  initial: 'V', color: '#00aeff' },
    ],
    pending: [
      { name: 'Pancho M.', handle: 'panchom', initial: 'P', color: '#b48cff', message: 'Si queda lugar me copo!' },
    ],
    userState: 'idle', // idle | joined | hosting | pending | full
    chat: [
      { from: { name: 'Tomás K.', initial: 'T', color: '#f5a623' }, text: '¿Llevo algo de tomar?', time: '11:42' },
      { from: { name: 'Martina V.', initial: 'M', color: '#1888ef' }, text: 'Dale, cerveza o gaseosa. Yo pongo galletitas.', time: '11:45' },
    ],
  },
  {
    _id: 'm2',
    game: 'Catan',
    gameSeed: 2,
    date: '2026-05-20T21:00:00',                       // Mañana
    location: 'Casa de Fede · Caballito',
    maxPlayers: 4,
    privacy: 'public',
    description: 'La revancha de la última partida (ganó Fede por suerte de dados). Esta vez sin alianzas, palabra.',
    rules: 'Llevar 1 bebida o snack. Empezamos 21h sí o sí.',
    tags: ['Clásico', 'Medio', '60-90min'],
    host: { name: 'Fede O.', handle: 'fede.ok', initial: 'F', color: '#00d984', rating: 4.6, games: 41 },
    players: [
      { name: 'Martina V.', handle: 'martina_v', initial: 'M', color: '#1888ef' },
      { name: 'Vos',         handle: 'voslohaces', initial: 'V', color: '#00aeff', isYou: true },
      { name: 'Sofi D.',     handle: 'sofi.dice', initial: 'S', color: '#b48cff' },
    ],
    pending: [],
    userState: 'joined',
    chat: [
      { from: { name: 'Fede O.', initial: 'F', color: '#00d984' }, text: 'Empezamos puntual 21hs?', time: 'ayer 22:15' },
      { from: { name: 'Vos', initial: 'V', color: '#00aeff', isYou: true }, text: 'Dale, llevo cervezas', time: 'ayer 22:18' },
      { from: { name: 'Martina V.', initial: 'M', color: '#1888ef' }, text: 'Yo llego un toque tarde, esperénme', time: 'hoy 09:01' },
    ],
  },
  {
    _id: 'm3',
    game: 'Wingspan',
    gameSeed: 4,
    date: '2026-05-21T20:00:00',                       // Esta semana
    location: 'Bar Notable · Almagro',
    maxPlayers: 4,
    privacy: 'public',
    description: 'Mesa abierta de Wingspan. Apto principiantes, explico reglas para quien no jugó.',
    tags: ['Engine builder', 'Medio', '70min'],
    host: { name: 'Vos', handle: 'voslohaces', initial: 'V', color: '#1888ef', rating: 4.7, games: 12 },
    players: [
      { name: 'Cami R.', handle: 'cami.r', initial: 'C', color: '#f5a623' },
    ],
    pending: [
      { name: 'Leo M.', handle: 'leo.meeple', initial: 'L', color: '#b48cff', message: 'Nunca jugué pero me copa!' },
      { name: 'Iri M.', handle: 'iri.m',      initial: 'I', color: '#f31d77', message: '' },
    ],
    userState: 'hosting',
    chat: [],
  },
  {
    _id: 'm4',
    game: 'Gloomhaven',
    gameSeed: 11,
    date: '2026-05-24T16:00:00',
    location: 'Club Newton · San Telmo',
    maxPlayers: 4,
    privacy: 'private',
    description: 'Campaña en curso — escenario 14. Buscamos un guerrero para reemplazar a Joaco.',
    tags: ['Campaña', 'Coop', '240min+'],
    host: { name: 'Sofi D.', handle: 'sofi.dice', initial: 'S', color: '#b48cff', rating: 4.9, games: 18 },
    players: [
      { name: 'Diego G.', handle: 'diegog', initial: 'D', color: '#00d984' },
      { name: 'Lucía D.', handle: 'lud',    initial: 'L', color: '#f31d77' },
    ],
    pending: [],
    userState: 'pending',
    chat: [],
  },
  {
    _id: 'm5',
    game: 'Root',
    gameSeed: 8,
    date: '2026-05-22T19:00:00',
    location: 'Tribunales',
    maxPlayers: 4,
    privacy: 'public',
    description: '',
    tags: ['Asimétrico', 'Conflicto', '90-120min'],
    host: { name: 'Leo M.', handle: 'leo.meeple', initial: 'L', color: '#00aeff', rating: 4.5, games: 9 },
    players: [
      { name: 'A', initial: 'A', color: '#f5a623' },
      { name: 'B', initial: 'B', color: '#b48cff' },
      { name: 'C', initial: 'C', color: '#00d984' },
    ],
    pending: [],
    userState: 'full',
    chat: [],
  },
  {
    _id: 'm6',
    game: 'Spirit Island',
    gameSeed: 5,
    date: '2026-05-23T17:00:00',
    location: 'Villa Crespo',
    maxPlayers: 3,
    privacy: 'public',
    description: 'Difficulty 4. Que sepan jugar al menos básico.',
    tags: ['Coop', 'Difícil', '120min'],
    host: { name: 'Cami R.', handle: 'cami.r', initial: 'C', color: '#f5a623', rating: 4.7, games: 15 },
    players: [],
    pending: [],
    userState: 'idle',
    chat: [],
  },
  {
    _id: 'm7',
    game: 'Brass: Birmingham',
    gameSeed: 13,
    date: '2026-06-02T20:00:00',
    location: 'Casa de Pancho · Caballito',
    maxPlayers: 4,
    privacy: 'public',
    description: 'Eurogame pesado para gente que ya jugó algo de Brass o quiera meterse de lleno.',
    tags: ['Eurogame', 'Pesado', '120min+'],
    host: { name: 'Pancho M.', handle: 'panchom', initial: 'P', color: '#b48cff', rating: 4.8, games: 31 },
    players: [
      { name: 'Joaco R.', initial: 'J', color: '#1888ef' },
    ],
    pending: [],
    userState: 'idle',
    chat: [],
  },
];

// ─── Geometric mosaic generator (mimics GameTile from the real app) ──
function MesaTile({ seed = 0, game = '', size = '100%', subtle = false }) {
  // Build a deterministic mosaic of triangles + circles from seed.
  const palette = [
    ['#1888ef', '#0076d1', '#00aeff'],
    ['#b48cff', '#7a4dff', '#d4baff'],
    ['#f5a623', '#d48800', '#ffcd6b'],
    ['#00d984', '#00a565', '#5dffbe'],
    ['#f31d77', '#b50054', '#ff6cb0'],
    ['#00aeff', '#1888ef', '#9ad3ff'],
  ];
  const colors = palette[seed % palette.length];
  // Generate pseudo-random shapes from seed
  const shapes = [];
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const cols = 6, rows = 4;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const r = rand();
      const colorIdx = Math.floor(rand() * 3);
      const cellX = (x / cols) * 100;
      const cellY = (y / rows) * 100;
      const w = 100 / cols;
      const h = 100 / rows;
      if (r > 0.7) {
        shapes.push(<polygon key={`t-${x}-${y}`} points={`${cellX},${cellY+h} ${cellX+w/2},${cellY} ${cellX+w},${cellY+h}`} fill={colors[colorIdx]} opacity={0.7 + rand()*0.3}/>);
      } else if (r > 0.45) {
        shapes.push(<circle key={`c-${x}-${y}`} cx={cellX+w/2} cy={cellY+h/2} r={Math.min(w,h)*0.35} fill={colors[colorIdx]} opacity={0.6 + rand()*0.35}/>);
      } else if (r > 0.25) {
        shapes.push(<rect key={`r-${x}-${y}`} x={cellX+w*0.15} y={cellY+h*0.15} width={w*0.7} height={h*0.7} fill={colors[colorIdx]} opacity={0.5 + rand()*0.4} rx={2}/>);
      }
    }
  }
  return (
    <svg viewBox="0 0 100 67" preserveAspectRatio="xMidYMid slice" width={size} height={size} style={{ display: 'block', opacity: subtle ? 0.35 : 1 }}>
      <defs>
        <linearGradient id={`mg-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors[1]}/>
          <stop offset="100%" stopColor="#0a0d15"/>
        </linearGradient>
      </defs>
      <rect width="100" height="67" fill={`url(#mg-${seed})`}/>
      {shapes}
      <rect width="100" height="67" fill="url(#mg-${seed})" opacity="0.18"/>
    </svg>
  );
}

Object.assign(window, {
  MesaIcon, MesaTile, MESAS, MesasNOW,
  mesasDateParts, mesasCountdown, mesasHorizon,
  MESAS_HORIZONS, MesasMESES_LARGO, MesasMESES_CORTO,
});
