/* global React, ReactDOM */
const { useState } = React;

// ─── Icons ─────────────────────────────────────────────────────
const EI = {
  Plus:  (p={}) => <svg width={p.size||15} height={p.size||15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Search:(p={}) => <svg width={p.size||15} height={p.size||15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Clear: (p={}) => <svg width={p.size||15} height={p.size||15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Compass:(p={}) => <svg width={p.size||15} height={p.size||15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  Bell:  (p={}) => <svg width={p.size||15} height={p.size||15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

// ─── Illustrations (lenguaje de juego de mesa) ─────────────────
function meeple(x, y, s, fill, op = 1) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} opacity={op}
    d="M5 0a2.4 2.4 0 0 1 2.1 3.6c1.4.5 2.4 1.5 2.9 2.9l.4 1.2c.2.6-.2 1.1-.8 1.1H7.9c.3.7.5 1.6.6 2.7.05.5-.35.9-.85.9H2.35c-.5 0-.9-.4-.85-.9.1-1.1.3-2 .6-2.7H1.4c-.6 0-1-.5-.8-1.1l.4-1.2c.5-1.4 1.5-2.4 2.9-2.9A2.4 2.4 0 0 1 5 0z"
    fill={fill}/>;
}

// 1. MESAS — mesa felteada vacía con sillas libres
function ArtMesa() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="esFelt" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#1d3a2a"/><stop offset="60%" stopColor="#15281e"/><stop offset="100%" stopColor="#0e1a14"/>
        </radialGradient>
      </defs>
      <ellipse cx="75" cy="64" rx="50" ry="34" fill="#2a1f15"/>
      <ellipse cx="75" cy="60" rx="50" ry="34" fill="url(#esFelt)" stroke="rgba(24,136,239,0.3)" strokeWidth="0.8"/>
      <ellipse cx="75" cy="60" rx="40" ry="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.7" strokeDasharray="2 2"/>
      {/* dado central tenue */}
      <g transform="translate(75 60)" opacity="0.5">
        <rect x="-7" y="-7" width="14" height="14" rx="2" fill="none" stroke="rgba(24,136,239,0.5)" strokeWidth="1"/>
        <circle cx="-3" cy="-3" r="1.1" fill="rgba(24,136,239,0.7)"/><circle cx="3" cy="3" r="1.1" fill="rgba(24,136,239,0.7)"/>
      </g>
      {/* sillas vacías punteadas alrededor */}
      {[[75,18],[123,42],[123,82],[75,104],[27,82],[27,42]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="9" fill="none" stroke="rgba(168,180,204,0.4)" strokeWidth="1.4" strokeDasharray="2.5 2.5"/>
      ))}
    </svg>
  );
}

// 2. EVENTOS — ticket / calendario con perforación
function ArtEvento() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <defs><filter id="esShadowE"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.4"/></filter></defs>
      <g filter="url(#esShadowE)" transform="rotate(-5 75 60)">
        <rect x="34" y="30" width="82" height="60" rx="8" fill="#151c28" stroke="#2a3a55" strokeWidth="1.5"/>
        {/* top band */}
        <rect x="34" y="30" width="82" height="20" rx="8" fill="#1d2532"/>
        <rect x="34" y="42" width="82" height="8" fill="#1d2532"/>
        <line x1="34" y1="50" x2="116" y2="50" stroke="#2a3a55" strokeWidth="1" strokeDasharray="3 3"/>
        {/* perforations */}
        <circle cx="34" cy="50" r="4" fill="#0a0d15"/><circle cx="116" cy="50" r="4" fill="#0a0d15"/>
        {/* big date */}
        <text x="75" y="74" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="22" fontWeight="800" fill="#00aeff" letterSpacing="-0.04em">??</text>
        <text x="75" y="84" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill="#5a6178" letterSpacing="0.2em">SIN FECHA</text>
        {/* eyebrow dots on band */}
        <circle cx="46" cy="40" r="2" fill="#f5a623"/><rect x="52" y="38" width="28" height="4" rx="2" fill="#2a3a55"/>
      </g>
    </svg>
  );
}

// 3. TORNEOS — bracket vacío + trofeo
function ArtTorneo() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      {/* bracket lines */}
      <g stroke="rgba(168,180,204,0.35)" strokeWidth="1.4" fill="none" strokeDasharray="2.5 2.5">
        <path d="M20 30 H40 V50 H56"/><path d="M20 70 H40 V50"/>
        <path d="M130 30 H110 V50 H94"/><path d="M130 70 H110 V50"/>
      </g>
      {/* empty slots */}
      {[[20,30],[20,70],[130,30],[130,70]].map(([x,y],i)=>(
        <rect key={i} x={x-14} y={y-7} width="28" height="14" rx="3" fill="#151c28" stroke="#2a3a55" strokeWidth="1"/>
      ))}
      {/* trophy center */}
      <g transform="translate(75 56)">
        <path d="M-10 -14 h20 v6 a10 10 0 0 1 -20 0 z" fill="#f5a623"/>
        <path d="M-10 -12 h-5 a5 5 0 0 0 5 7 z M10 -12 h5 a5 5 0 0 1 -5 7 z" fill="none" stroke="#f5a623" strokeWidth="1.6"/>
        <rect x="-2.5" y="-4" width="5" height="9" fill="#d48800"/>
        <rect x="-9" y="5" width="18" height="4" rx="1.5" fill="#f5a623"/>
        <text x="0" y="-6.5" textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="8" fontWeight="800" fill="#1a1208">?</text>
      </g>
    </svg>
  );
}

// 4. COMPARTIDAS — polaroid vacía + pin
function ArtCompartida() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <defs><filter id="esShadowP"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.4"/></filter></defs>
      <g filter="url(#esShadowP)" transform="rotate(-6 75 60)">
        <rect x="44" y="26" width="62" height="74" rx="2" fill="#f4eeda"/>
        <rect x="50" y="32" width="50" height="48" rx="1" fill="#1a2335"/>
        <rect x="50" y="32" width="50" height="48" rx="1" fill="none" stroke="#0e1320" strokeWidth="0.5"/>
        {/* camera glyph inside photo */}
        <g transform="translate(75 56)" stroke="#5a6178" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-11" y="-7" width="22" height="16" rx="3"/><circle cx="0" cy="1" r="4.5"/><rect x="-3" y="-10" width="6" height="3" rx="1"/>
        </g>
        <text x="75" y="92" textAnchor="middle" fontFamily="Caveat, cursive" fontSize="12" fill="#2c2620">tu primera foto</text>
      </g>
      {/* tape */}
      <rect x="60" y="20" width="30" height="10" rx="1" fill="rgba(232,220,180,0.6)" transform="rotate(-8 75 25)"/>
    </svg>
  );
}

// 5. COMUNIDAD — carnets / siluetas
function ArtComunidad() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      {meeple(56, 30, 3.2, '#1888ef', 0.9)}
      {meeple(88, 38, 2.6, '#f5a623', 0.8)}
      {meeple(40, 50, 2.2, '#00d984', 0.7)}
      <circle cx="75" cy="92" rx="40" r="6" fill="none"/>
      <ellipse cx="75" cy="100" rx="46" ry="8" fill="rgba(24,136,239,0.08)"/>
    </svg>
  );
}

// 6. GENERIC search — lupa sobre dado
function ArtSearch() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <g transform="translate(64 52)" opacity="0.85">
        <rect x="-20" y="-20" width="40" height="40" rx="6" fill="#151c28" stroke="#2a3a55" strokeWidth="1.5" transform="rotate(-8)"/>
        <text x="0" y="2" textAnchor="middle" dominantBaseline="middle" fontFamily="Poppins, sans-serif" fontSize="22" fontWeight="800" fill="#5a6178" transform="rotate(-8)">?</text>
      </g>
      <g transform="translate(88 74)" stroke="#00aeff" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <circle cx="0" cy="0" r="13" fill="rgba(0,174,255,0.08)"/>
        <line x1="9.5" y1="9.5" x2="20" y2="20"/>
      </g>
    </svg>
  );
}

// 7. NOTIFICACIONES — campana al día
function ArtNotif() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <g transform="translate(75 56)" stroke="#00d984" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8A16 16 0 0 0 -16 8c0 18-8 23-8 23h48s-8-5-8-23" fill="rgba(0,217,132,0.06)"/>
        <path d="M4 38a6 6 0 0 1-8 0"/>
      </g>
      {/* check badge */}
      <g transform="translate(102 36)">
        <circle r="12" fill="#00d984"/>
        <path d="M-5 0 L-1.5 4 L6 -5" stroke="#001712" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  );
}

// ─── Ghost previews per entity ─────────────────────────────────
function GhostMesa() {
  return (
    <div className="emptyGhosts">
      {[0,1,2,3].map(i => (
        <div key={i} className="ghostCard">
          <div className="ghostBanner" />
          <div className="ghostBody">
            <div className="ghostLine tall w70" />
            <div className="ghostLine w50" />
            <div className="ghostTrack" />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
              <div className="ghostAvatar" style={{ width:26, height:26 }} />
              <div className="ghostPill" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
function GhostRows() {
  return (
    <div className="emptyGhosts rows">
      {[0,1,2,3].map(i => (
        <div key={i} className="ghostRowCard">
          <div className="ghostDate" />
          <div className="ghostRowBody">
            <div className="ghostLine tall w50" />
            <div className="ghostLine w90" />
          </div>
          <div className="ghostPill" />
        </div>
      ))}
    </div>
  );
}
function GhostPolaroids() {
  return (
    <div className="emptyGhosts">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="ghostPolaroid"><div className="ghostPolaroidPhoto" /></div>
      ))}
    </div>
  );
}
function GhostMembers() {
  return (
    <div className="emptyGhosts">
      {[0,1,2,3].map(i => (
        <div key={i} className="ghostCard tall">
          <div style={{ height:5, background:'linear-gradient(90deg,#1888ef,#00aeff)' }} />
          <div className="ghostBody">
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <div className="ghostAvatar round" />
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                <div className="ghostLine tall w70" /><div className="ghostLine w40" />
              </div>
            </div>
            <div className="ghostLine w90" style={{ marginTop:6 }} />
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <div className="ghostPill" style={{ flex:1, width:'auto' }} />
              <div className="ghostPill" style={{ flex:1, width:'auto' }} />
              <div className="ghostPill" style={{ flex:1, width:'auto' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── EmptyState component (reutilizable) ───────────────────────
function EmptyState({ variant = 'first', art, ghost, eyebrow, title, text, primary, secondary, chips, hint, compact }) {
  return (
    <div className={`empty ${compact ? 'compact' : ''}`}>
      {ghost}
      <div className="emptyCore">
        {art && <div className="emptyArt">{art}</div>}
        {eyebrow && <span className={`emptyEyebrow ${variant === 'filtered' ? 'muted' : ''}`}>{eyebrow}</span>}
        <h2 className="emptyTitle" dangerouslySetInnerHTML={{ __html: title }} />
        {text && <p className="emptyText">{text}</p>}
        <div className="emptyActions">
          {primary && <button className="emptyBtn">{primary.icon}{primary.label}</button>}
          {secondary && <button className="emptyBtn ghost">{secondary.icon}{secondary.label}</button>}
        </div>
        {chips && (
          <div className="emptyChips">
            {chips.map(c => <button key={c} className="emptyChip">{c}</button>)}
          </div>
        )}
        {hint && <div className="emptyHint" dangerouslySetInnerHTML={{ __html: hint }} />}
      </div>
    </div>
  );
}

// ─── Entity configs ────────────────────────────────────────────
const ENTITIES = {
  mesas: {
    label: 'Mesas', frame: 'Mesas · /mesas',
    first: {
      art: <ArtMesa />, ghost: <GhostMesa />,
      eyebrow: '◆ Ninguna mesa abierta',
      title: 'La mesa está <em>servida.</em>',
      text: 'Todavía no hay mesas en tu zona. Sé quien tira los dados primero — armá la tuya y la comunidad se suma.',
      primary: { label: 'Crear la primera mesa', icon: <EI.Plus /> },
      secondary: { label: 'Explorar otras zonas', icon: <EI.Compass /> },
      hint: 'O esperá — las mesas suelen aparecer los <strong style="color:var(--text-secondary)">jueves y viernes</strong>.',
    },
    filtered: {
      art: <ArtSearch />, ghost: null, compact: true,
      eyebrow: 'Sin coincidencias',
      title: 'Ninguna mesa con <em>esos filtros.</em>',
      text: 'Probá ampliar la búsqueda o sacá algún filtro. Estas categorías sí tienen mesas:',
      chips: ['Con lugar', 'Públicas', 'Esta semana', 'Estrategia'],
      secondary: { label: 'Limpiar filtros', icon: <EI.Clear /> },
    },
  },
  eventos: {
    label: 'Eventos', frame: 'Eventos · /eventos',
    first: {
      art: <ArtEvento />, ghost: <GhostRows />,
      eyebrow: '◆ Agenda despejada',
      title: 'Nada en la <em>agenda</em> todavía.',
      text: 'No hay eventos próximos. Si organizás torneos o encuentros, este es el lugar para convocarlos.',
      primary: { label: 'Crear evento', icon: <EI.Plus /> },
      secondary: { label: 'Ver eventos pasados', icon: <EI.Compass /> },
    },
    filtered: {
      art: <ArtSearch />, ghost: null, compact: true,
      eyebrow: 'Sin coincidencias',
      title: 'Ningún evento con <em>ese filtro.</em>',
      text: 'No encontramos eventos para esa combinación. Probá con:',
      chips: ['Abiertos', 'Este mes', 'Gratis', 'Torneos'],
      secondary: { label: 'Limpiar filtros', icon: <EI.Clear /> },
    },
  },
  torneos: {
    label: 'Torneos', frame: 'Torneos · /torneos',
    first: {
      art: <ArtTorneo />, ghost: <GhostRows />,
      eyebrow: '◆ Cuadro vacío',
      title: 'Que empiece la <em>competencia.</em>',
      text: 'Todavía no hay torneos activos. Armá el bracket, definí el formato y dejá que gane el mejor.',
      primary: { label: 'Armar torneo', icon: <EI.Plus /> },
      secondary: { label: 'Cómo funciona', icon: <EI.Compass /> },
    },
    filtered: {
      art: <ArtSearch />, ghost: null, compact: true,
      eyebrow: 'Sin coincidencias',
      title: 'Ningún torneo con <em>ese estado.</em>',
      text: 'No hay torneos en esa categoría ahora mismo. Mirá:',
      chips: ['En curso', 'Inscripción abierta', 'Finalizados'],
      secondary: { label: 'Limpiar filtros', icon: <EI.Clear /> },
    },
  },
  compartidas: {
    label: 'Compartidas', frame: 'Compartidas · /compartidas',
    first: {
      art: <ArtCompartida />, ghost: <GhostPolaroids />,
      eyebrow: '◆ Diario en blanco',
      title: 'Contá tu <em>última partida.</em>',
      text: 'El feed está vacío. Subí una foto de la mesa, una anécdota o ese final ajustado — la comunidad quiere verlo.',
      primary: { label: 'Compartir una partida', icon: <EI.Plus /> },
      secondary: { label: 'Ver cómo se hace', icon: <EI.Compass /> },
    },
    filtered: {
      art: <ArtSearch />, ghost: null, compact: true,
      eyebrow: 'Sin coincidencias',
      title: 'Nada para <em>ese filtro.</em>',
      text: 'No hay compartidas que coincidan. Probá:',
      chips: ['Con fotos', 'Amigos', 'Mesas', 'Trending'],
      secondary: { label: 'Limpiar filtros', icon: <EI.Clear /> },
    },
  },
  comunidad: {
    label: 'Comunidad', frame: 'Comunidad · /comunidad',
    first: {
      art: <ArtComunidad />, ghost: <GhostMembers />,
      eyebrow: '◆ Roster vacío',
      title: 'Sé el <em>primero</em> en sentarte.',
      text: 'Todavía no hay miembros para mostrar. Invitá a tu grupo de juego y armá tu comunidad local.',
      primary: { label: 'Invitar jugadores', icon: <EI.Plus /> },
      secondary: { label: 'Compartir invitación', icon: <EI.Compass /> },
    },
    filtered: {
      art: <ArtSearch />, ghost: null, compact: true,
      eyebrow: 'Sin coincidencias',
      title: 'Ningún jugador con <em>ese nombre.</em>',
      text: 'No encontramos a nadie así. Probá buscar por @usuario, o filtrá por:',
      chips: ['Hosts', 'Recién llegados', 'Más activos'],
      secondary: { label: 'Limpiar búsqueda', icon: <EI.Clear /> },
    },
  },
  notificaciones: {
    label: 'Notificaciones', frame: 'Notificaciones · /notificaciones',
    first: {
      art: <ArtNotif />, ghost: null,
      eyebrow: '◆ Bandeja al día',
      title: 'Estás <em>al día.</em>',
      text: 'No tenés notificaciones nuevas. Cuando alguien se sume a tu mesa, te etiquete o haya novedades, aparece acá.',
      secondary: { label: 'Explorar mesas', icon: <EI.Compass /> },
      hint: 'Ajustá qué te avisamos en <button>Preferencias</button>.',
    },
    filtered: {
      art: <ArtSearch />, ghost: null, compact: true,
      eyebrow: 'Sin coincidencias',
      title: 'Nada en <em>este filtro.</em>',
      text: 'No hay notificaciones de este tipo. Probá otro:',
      chips: ['Todas', 'Sin leer', 'Mesas', 'Amigos'],
      secondary: { label: 'Ver todas', icon: <EI.Clear /> },
    },
  },
};

// ─── Showcase app ──────────────────────────────────────────────
function EmptyStatesApp() {
  const [entity, setEntity] = useState('mesas');
  const [mode, setMode] = useState('first');   // 'first' | 'filtered'
  const cfg = ENTITIES[entity];
  const data = cfg[mode];

  return (
    <div className="app-root">
      <div className="app-shell">
        <div className="esSwitcher">
          <div className="esSwitcherLogo"><span>◆</span><span>turnocero</span></div>
          <div className="esSwitcherTabs">
            {Object.entries(ENTITIES).map(([k, v]) => (
              <button key={k} className={`esTab ${entity === k ? 'active' : ''}`} onClick={() => setEntity(k)}>{v.label}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div className="esSwitcherTabs">
            <button className={`esTab ${mode === 'first' ? 'active' : ''}`} onClick={() => setMode('first')}>1ª vez</button>
            <button className={`esTab ${mode === 'filtered' ? 'active' : ''}`} onClick={() => setMode('filtered')}>Filtro vacío</button>
          </div>
        </div>

        <div className="esStage">
          <div className="esDemoHead">
            <span className="esDemoEyebrow">◆ Sistema de empty states</span>
            <h1 className="esDemoTitle">Pantallas <em>vacías</em> con intención.</h1>
            <p className="esDemoSub">
              Un patrón único para toda la plataforma: ilustración del universo de juego de mesa,
              ghost previews de lo que va a vivir ahí, y una acción clara. Dos modos: <strong>primera vez</strong> (invita
              a crear) y <strong>filtro vacío</strong> (ayuda a recuperar resultados). Cambiá entidad y modo arriba.
            </p>
          </div>

          <div className="esFrame">
            <div className="esFrameLabel">
              <span className="name">{cfg.frame}</span>
              <span className={`kind ${mode === 'filtered' ? 'filtered' : ''}`}>
                {mode === 'first' ? 'Vacío · primera vez' : 'Vacío · por filtro'}
              </span>
            </div>
            <EmptyState variant={mode} {...data} />
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<EmptyStatesApp />);
