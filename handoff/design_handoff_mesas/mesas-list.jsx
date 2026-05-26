/* global React, MesaIcon, MesaTile, MESAS, mesasDateParts, mesasCountdown, mesasHorizon, MESAS_HORIZONS */
const { useState, useMemo } = React;

// ─── Mesa card (grid view) ────────────────────────────────────
function MesaCard({ mesa, i, onOpen }) {
  const d = mesasDateParts(mesa.date);
  const cd = mesasCountdown(mesa.date);
  const totalSeats = mesa.maxPlayers;
  const filled = mesa.players.length + 1; // +host
  const open = totalSeats - filled;
  const isFull = open <= 0;
  const fillPct = (filled / totalSeats) * 100;
  const isPrivate = mesa.privacy === 'private';

  // CTA logic
  let cta;
  if (mesa.userState === 'hosting') {
    cta = <button className="mesaCta host" onClick={onOpen}>Administrar →</button>;
  } else if (mesa.userState === 'joined') {
    cta = <button className="mesaCta joined-cta" onClick={onOpen}><MesaIcon.Check size={11}/>&nbsp;Unido</button>;
  } else if (mesa.userState === 'pending') {
    cta = <button className="mesaCta pending-cta" onClick={onOpen}>Solicitud enviada</button>;
  } else if (isFull) {
    cta = <button className="mesaCta disabled" disabled>Mesa llena</button>;
  } else if (isPrivate) {
    cta = <button className="mesaCta" onClick={onOpen}>Solicitar →</button>;
  } else {
    cta = <button className="mesaCta" onClick={onOpen}>Unirme</button>;
  }

  const cardClass = [
    'mesaCard',
    mesa.userState === 'hosting' && 'hosting',
    mesa.userState === 'joined' && 'joined',
    mesa.userState === 'pending' && 'pending',
    isFull && 'full',
    isPrivate && 'private',
  ].filter(Boolean).join(' ');

  return (
    <a className={cardClass} style={{ '--i': i }} href="#" onClick={(e) => { e.preventDefault(); onOpen(); }}>
      <div className="mesaBanner">
        <MesaTile seed={mesa.gameSeed} game={mesa.game} />
        <div className="mesaBannerGradient" />
        <div className="mesaBannerTop">
          <span className={`mesaDateChip ${cd.tone === 'urgent' ? 'urgent' : cd.tone === 'past' ? 'past' : ''}`}>
            {d.weekday} · {d.day} {d.month} · {d.time}
          </span>
          <div className="mesaBannerBadges">
            {mesa.userState === 'hosting' && <span className="mesaBadge host">Host</span>}
            {mesa.userState === 'joined'  && <span className="mesaBadge joined">Unido</span>}
            {mesa.userState === 'pending' && <span className="mesaBadge pending">Pendiente</span>}
            {isPrivate && <span className="mesaBadge lock"><MesaIcon.Lock size={10}/></span>}
          </div>
        </div>
      </div>

      <div className="mesaCardBody">
        <h3 className="mesaCardGame">{mesa.game}</h3>
        {mesa.location && (
          <div className="mesaCardLoc">
            <MesaIcon.Pin size={12}/>
            <span>{mesa.location}</span>
          </div>
        )}

        {mesa.tags?.length > 0 && (
          <div className="mesaTags">
            {mesa.tags.map(t => <span key={t} className="mesaTag">{t}</span>)}
          </div>
        )}

        <div className="seatSection">
          <div className="seatHead">
            <span>Lugares</span>
            <strong>{filled}/{totalSeats}</strong>
          </div>
          <div className="seatTrack">
            <div className={`seatFill ${isFull ? 'full' : ''}`} style={{ width: `${fillPct}%` }} />
            {Array.from({ length: totalSeats - 1 }).map((_, idx) => (
              <span key={idx} className="seatDivider" style={{ left: `${((idx+1) / totalSeats) * 100}%` }} />
            ))}
          </div>
        </div>

        <div className="mesaCardFoot">
          <div className="mesaHostBlock">
            <div className="hostAv" style={{
              width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center',
              background: mesa.host.color, color: '#fff',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
              flexShrink: 0,
            }}>{mesa.host.initial}</div>
            <div className="mesaHostInfo">
              <span className="mesaHostLabel">Host</span>
              <span className="mesaHostName">{mesa.host.name}</span>
              <span className={`mesaStatusChip ${isFull ? 'full' : ''}`}>
                {isFull ? 'Llena' : `${open} libre${open === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
          {cta}
        </div>
      </div>
    </a>
  );
}

// ─── List row ────────────────────────────────────────────────
function MesaRow({ mesa, i, onOpen }) {
  const d = mesasDateParts(mesa.date);
  const totalSeats = mesa.maxPlayers;
  const filled = mesa.players.length + 1;
  const open = totalSeats - filled;
  const isFull = open <= 0;
  const fillPct = (filled / totalSeats) * 100;

  const rowClass = ['mesaListRow',
    mesa.userState === 'hosting' && 'hosting',
    mesa.userState === 'joined' && 'joined',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClass} style={{ '--i': i, animationDelay: `${i*40}ms` }}>
      <div className="mesaListDate">
        <span className="mesaListDateDay">{d.day}</span>
        <span className="mesaListDateMonth">{d.month}</span>
        <span className="mesaListDateTime">{d.time}</span>
      </div>
      <div className="mesaListBody">
        <h3 className="mesaListGame">{mesa.game}</h3>
        <div className="mesaListMeta">
          {mesa.location && <span><MesaIcon.Pin size={11}/> {mesa.location}</span>}
          <span><MesaIcon.Users size={11}/> {filled}/{totalSeats}</span>
          {mesa.privacy === 'private' && <span><MesaIcon.Lock size={11}/> Privada</span>}
          <span style={{ color: 'var(--text-muted)' }}>· Host <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{mesa.host.name}</strong></span>
        </div>
      </div>
      <div className="mesaListSeats">
        <span className={`mesaListSeatsCount ${isFull ? 'full' : ''}`}>{isFull ? 'Llena' : `${open} libre${open===1?'':'s'}`}</span>
        <div className="mesaListSeatsBar seatTrack">
          <div className={`seatFill ${isFull ? 'full' : ''}`} style={{ width: `${fillPct}%` }} />
        </div>
      </div>
      <div>
        {mesa.userState === 'hosting' ? <button className="mesaCta host" onClick={onOpen}>Administrar →</button> :
         mesa.userState === 'joined'  ? <button className="mesaCta joined-cta" onClick={onOpen}><MesaIcon.Check size={11}/>&nbsp;Unido</button> :
         mesa.userState === 'pending' ? <button className="mesaCta pending-cta" onClick={onOpen}>Pendiente</button> :
         isFull                       ? <button className="mesaCta disabled" disabled>Llena</button> :
         mesa.privacy === 'private'   ? <button className="mesaCta" onClick={onOpen}>Solicitar</button> :
                                        <button className="mesaCta" onClick={onOpen}>Unirme</button>}
      </div>
    </div>
  );
}

// ─── Felted table hero illustration (for landing) ─────────────
function FeltedTableHero() {
  // Top-down ellipse with 6 seats around. Visual decoration.
  const seats = [
    { x: 50, y: 6,  init: 'M', c: '#f5a623' },
    { x: 86, y: 25, init: 'C', c: '#1888ef' },
    { x: 86, y: 65, init: 'V', c: '#00aeff' },
    { x: 50, y: 84, init: 'S', c: '#b48cff' },
    { x: 14, y: 65, init: 'L', c: '#00d984' },
    { x: 14, y: 25, init: 'T', c: '#f31d77' },
  ];
  return (
    <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="feltedGrad" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%"  stopColor="#1d3a2a"/>
          <stop offset="60%" stopColor="#162a1f"/>
          <stop offset="100%" stopColor="#0a1410"/>
        </radialGradient>
        <pattern id="feltedDots" patternUnits="userSpaceOnUse" width="3" height="3">
          <circle cx="1.5" cy="1.5" r="0.4" fill="rgba(255,255,255,0.04)"/>
        </pattern>
      </defs>
      <ellipse cx="50" cy="45" rx="42" ry="28" fill="url(#feltedGrad)" stroke="rgba(24,136,239,0.3)" strokeWidth="0.3"/>
      <ellipse cx="50" cy="45" rx="42" ry="28" fill="url(#feltedDots)"/>
      <ellipse cx="50" cy="45" rx="36" ry="22" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.2" strokeDasharray="1 1"/>
      {/* center die-roll motif */}
      <g transform="translate(50 45)" opacity="0.5">
        <rect x="-4" y="-4" width="8" height="8" rx="1.2" fill="none" stroke="rgba(24,136,239,0.4)" strokeWidth="0.4"/>
        <circle cx="-1.5" cy="-1.5" r="0.5" fill="rgba(24,136,239,0.6)"/>
        <circle cx="1.5"  cy="1.5"  r="0.5" fill="rgba(24,136,239,0.6)"/>
      </g>
      {/* seats */}
      {seats.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <circle r="6.5" fill={s.c} stroke="rgba(10,13,21,0.9)" strokeWidth="0.6"/>
          <text textAnchor="middle" dominantBaseline="central" fontFamily="Poppins, sans-serif" fontSize="6" fontWeight="800" fill="#fff" style={{ letterSpacing: '-0.04em' }}>{s.init}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Filter chips ────────────────────────────────────────────
const FILTERS = [
  { value: 'all',     label: 'Todas',      countFor: (m) => true },
  { value: 'mine',    label: 'Mis mesas',  countFor: (m) => m.userState === 'hosting' || m.userState === 'joined' || m.userState === 'pending' },
  { value: 'host',    label: 'Hosting',    countFor: (m) => m.userState === 'hosting' },
  { value: 'joined',  label: 'Jugando',    countFor: (m) => m.userState === 'joined' },
  { value: 'open',    label: 'Con lugar',  countFor: (m) => (m.maxPlayers - m.players.length - 1) > 0 },
  { value: 'public',  label: 'Públicas',   countFor: (m) => m.privacy === 'public' },
];

// ─── ListScreen ──────────────────────────────────────────────
function MesasListScreen({ onOpenDetail, onOpenCreate, viewMode, setViewMode }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = MESAS;
    const f = FILTERS.find(x => x.value === filter);
    if (f && filter !== 'all') list = list.filter(f.countFor);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.game.toLowerCase().includes(q) ||
        (m.location || '').toLowerCase().includes(q) ||
        m.host.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [filter, search]);

  // Group by horizon
  const groups = useMemo(() => {
    const m = new Map();
    MESAS_HORIZONS.forEach(h => m.set(h.key, []));
    filtered.forEach(mesa => {
      const h = mesasHorizon(mesa.date);
      if (m.has(h)) m.get(h).push(mesa);
    });
    return MESAS_HORIZONS.map(h => ({ ...h, items: (m.get(h.key) || []).sort((a,b) => new Date(a.date) - new Date(b.date)) })).filter(g => g.items.length > 0);
  }, [filtered]);

  const totalActive = MESAS.length;

  return (
    <div className="page">
      <div className="mesaHero">
        <div className="mesaHeroLeft">
          <div className="mesaHeroEyebrow">◆ {totalActive} mesas activas · martes 19 may</div>
          <h1 className="mesaHeroTitle">Tirá los <em>dados.</em></h1>
          <p className="mesaHeroSub">
            Sumate a una mesa o convocá la tuya. Las cartas se reparten ahora — los lugares se llenan rápido.
          </p>
        </div>
        <div className="mesaHeroRight">
          <div className="feltedTablePreview"><FeltedTableHero /></div>
        </div>
      </div>

      <div className="mesaControls">
        <div className="filterChips">
          {FILTERS.map(f => {
            const n = MESAS.filter(f.countFor).length;
            return (
              <button
                key={f.value}
                className={`chip ${filter === f.value ? 'chipActive' : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label} <span style={{ opacity: 0.6, marginLeft: 2 }}>· {n}</span>
              </button>
            );
          })}
        </div>

        <div className="controlsRight">
          <input
            type="text" className="search"
            placeholder="Buscar juego, lugar, host…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <div className="viewToggle">
            <button className={`viewBtn ${viewMode === 'grid' ? 'viewBtnActive' : ''}`} onClick={() => setViewMode('grid')}>
              <MesaIcon.Grid />
            </button>
            <button className={`viewBtn ${viewMode === 'list' ? 'viewBtnActive' : ''}`} onClick={() => setViewMode('list')}>
              <MesaIcon.List />
            </button>
          </div>
          <button className="newBtn" onClick={onOpenCreate}>
            <MesaIcon.Plus size={13}/> Crear mesa
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Sin mesas para esos filtros
          </p>
        </div>
      ) : (
        groups.map(g => (
          <section key={g.key} className="horizonGroup">
            <div className="horizonHeader">
              <span className="hLabel">Horizonte</span>
              <span className={`hName ${g.key === 'today' ? 'today' : ''}`}>{g.label}</span>
              <span className="hSub">{g.sub}</span>
              <span className="hRule" />
              <span className="hCount">{g.items.length} mesa{g.items.length === 1 ? '' : 's'}</span>
            </div>
            {viewMode === 'grid' ? (
              <div className="mesaGrid">
                {g.items.map((mesa, i) => (
                  <MesaCard key={mesa._id} mesa={mesa} i={i} onOpen={() => onOpenDetail(mesa._id)} />
                ))}
              </div>
            ) : (
              <div className="mesaList">
                {g.items.map((mesa, i) => (
                  <MesaRow key={mesa._id} mesa={mesa} i={i} onOpen={() => onOpenDetail(mesa._id)} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}

window.MesasListScreen = MesasListScreen;
window.MesaCardPreview = MesaCard;
