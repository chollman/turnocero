/* global React, ReactDOM, Icon, Avatar, Switcher, fmtDate, timeAgo, MESES_CORTO */
/* global TweaksPanel, TweakSection, useTweaks */
const { useState, useMemo } = React;

// ─── Mock players ─────────────────────────────────────────────
const P = {
  vos:    { handle: 'vos',    name: 'Vos',           initial: 'V', color: '#1888ef' },
  cami:   { handle: 'camir',  name: 'Cami Rossi',    initial: 'C', color: '#f5a623' },
  pancho: { handle: 'panchom',name: 'Pancho M.',     initial: 'P', color: '#b48cff' },
  vale:   { handle: 'valep',  name: 'Vale P.',       initial: 'V', color: '#00aeff' },
  tomi:   { handle: 'tomik',  name: 'Tomás K.',      initial: 'T', color: '#1888ef' },
  luci:   { handle: 'lucid',  name: 'Lucía D.',      initial: 'L', color: '#f31d77' },
  joaco:  { handle: 'joacor', name: 'Joaco R.',      initial: 'J', color: '#00d984' },
};

// ─── Mock collection ─────────────────────────────────────────
const COLLECTION = [
  { id: 'g1',  name: 'Wingspan',          year: 2019, numPlays: 14, owned: true },
  { id: 'g2',  name: 'Brass: Birmingham', year: 2018, numPlays: 11, owned: true },
  { id: 'g3',  name: 'Catán',             year: 1995, numPlays: 9,  owned: true },
  { id: 'g4',  name: 'Spirit Island',     year: 2017, numPlays: 7,  owned: true },
  { id: 'g5',  name: 'Ark Nova',          year: 2021, numPlays: 6,  owned: true },
  { id: 'g6',  name: 'Sky Team',          year: 2023, numPlays: 5,  owned: true },
  { id: 'g7',  name: 'Carcassonne',       year: 2000, numPlays: 4,  owned: true },
  { id: 'g8',  name: '7 Wonders',         year: 2010, numPlays: 4,  owned: true },
  { id: 'g9',  name: 'Gaia Project',      year: 2017, numPlays: 3,  owned: true },
  { id: 'g10', name: 'Terra Mystica',     year: 2012, numPlays: 2,  owned: true },
  { id: 'g11', name: 'Heat',              year: 2022, numPlays: 2,  owned: true },
  { id: 'g12', name: 'Marco Polo II',     year: 2019, numPlays: 1,  owned: true },
  { id: 'g13', name: 'Concordia',         year: 2013, numPlays: 0,  owned: true },
  { id: 'g14', name: 'Underwater Cities', year: 2018, numPlays: 0,  owned: true },
  { id: 'g15', name: 'Everdell',          year: 2018, numPlays: 0,  owned: true },
  { id: 'g16', name: 'Splendor',          year: 2014, numPlays: 0,  owned: true },
];

const COLL = COLLECTION;

// ─── Mock plays ───────────────────────────────────────────────
const PLAYS = [
  {
    id: 'pl1', date: '2026-05-18', game: 'Wingspan', initial: 'WS',
    score: 92, vsScore: 76, location: 'Casa de Cami', duration: 95, players: [P.vos, P.cami, P.pancho, P.vale], outcome: 'win',
    notes: 'Combo de aves de pradera + ronda 4 con +2 cada turno fue brutal. Cami casi me alcanza por bonus de fin.',
  },
  {
    id: 'pl2', date: '2026-05-15', game: 'Brass: Birmingham', initial: 'BB',
    score: 138, vsScore: 142, location: 'Club Estrategia', duration: 210, players: [P.vos, P.tomi, P.pancho, P.luci], outcome: 'loss',
    notes: 'Tomás cerró la era 2 con todos sus link points. Me faltó canal en el norte.',
  },
  {
    id: 'pl3', date: '2026-05-12', game: 'Sky Team', initial: 'SK', coop: true,
    score: 7, vsScore: null, location: 'Casa', duration: 35, players: [P.vos, P.vale], outcome: 'win',
    notes: 'Cooperativa con Vale. 7 puntos de dificultad — apenas la sacamos.',
  },
  {
    id: 'pl4', date: '2026-05-10', game: 'Ark Nova', initial: 'AN',
    score: 87, vsScore: 102, location: 'Bar La Torre', duration: 240, players: [P.vos, P.tomi, P.luci], outcome: 'loss',
    notes: '',
  },
  {
    id: 'pl5', date: '2026-05-08', game: 'Catán', initial: 'CT',
    score: 10, vsScore: 9, location: 'Casa de Pancho', duration: 75, players: [P.vos, P.pancho, P.joaco, P.cami], outcome: 'win',
    notes: 'Cerré con ciudad sobre vértice de trigo. Pancho me odió.',
  },
  {
    id: 'pl6', date: '2026-05-05', game: 'Wingspan', initial: 'WS',
    score: 81, vsScore: 89, location: 'Casa Cultural Boedo', duration: 100, players: [P.vos, P.cami, P.tomi], outcome: 'loss',
    notes: '',
  },
  {
    id: 'pl7', date: '2026-05-03', game: 'Heat', initial: 'HT',
    score: 1, vsScore: 4, location: 'Casa', duration: 55, players: [P.vos, P.vale, P.joaco, P.luci, P.pancho], outcome: 'win',
    notes: 'Llegué primero en la última curva. Pole position desde el principio.',
  },
];

// Heatmap: simulate plays for last 13 weeks
const HEATMAP = Array.from({ length: 13 * 7 }, (_, i) => {
  const r = (i * 17) % 10;
  if (r < 5) return 0;
  if (r < 8) return 1;
  if (r < 9) return 2;
  return 3;
});

// Top games (most played)
const TOP_GAMES = COLL.filter(g => g.numPlays > 0).slice(0, 5);

// Expose shared data for the create-play screen (separate babel script)
Object.assign(window, { P, COLL, PLAYS });

// ─── Landing screen ──────────────────────────────────────────
function LandingScreen({ onEnter }) {
  return (
    <div className="page">
      <div className="landingHero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="landingBadge"><Icon.Dice size={12}/> Integración BoardGameGeek</div>
          <h1 className="landingTitle">
            Tu <em>almanaque</em> de partidas.
          </h1>
          <p className="landingLead">
            BG Watch conecta tu cuenta de BoardGameGeek y convierte cada partida en una entrada de tu diario.
            Estadísticas, colección, tendencias y un calendario que se llena con cada juego. Sin esfuerzo.
          </p>
          <div className="landingCtas">
            <button className="btn" onClick={onEnter}><Icon.Plus size={13}/> Conectar mi cuenta BGG</button>
            <button className="btn ghost" onClick={onEnter}>Ver un ejemplo →</button>
          </div>
        </div>

        <div className="landingMockStats">
          <div className="landingMockCard tilt1">
            <div className="landingMockTitle">◆ Este año</div>
            <div className="landingMockBig">100</div>
            <div className="landingMockMeta">partidas registradas · récord personal</div>
          </div>
          <div className="landingMockCard tilt2">
            <div className="landingMockTitle">◆ Más jugado</div>
            <div className="landingMockBig" style={{ fontSize: '1.2rem' }}>Wingspan</div>
            <div className="landingMockMeta">14 partidas · win-rate 64%</div>
          </div>
          <div className="landingMockCard tilt3">
            <div className="landingMockTitle">◆ Colección</div>
            <div className="landingMockBig">87</div>
            <div className="landingMockMeta">juegos · 38 jugados al menos una vez</div>
          </div>
        </div>
      </div>

      <div className="ruleLine"><span>◆ Cómo funciona</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {[
          { n: '01', t: 'Conectá tu cuenta', d: 'Pegá tu usuario de BGG. Sincronizamos colección y partidas automáticamente.' },
          { n: '02', t: 'Llevá tu registro', d: 'Cada partida queda guardada con jugadores, score, duración y notas.' },
          { n: '03', t: 'Encontrá patrones', d: 'Stats por juego, heatmap mensual, top de la colección y mucho más.' },
        ].map(s => (
          <div key={s.n} style={{ padding: 18, background: 'var(--bg-paper)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--accent-light)', letterSpacing: '-0.04em', lineHeight: 1 }}>{s.n}</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, margin: '10px 0 6px', letterSpacing: '-0.02em' }}>{s.t}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Player header + stats ───────────────────────────────────
function PlayerHeader({ user, isOwn, onNewPlay }) {
  return (
    <div className="playerHeader">
      <div className="playerAvatar">
        <div className="avatar xl" style={{ background: user.color }}>{user.initial}</div>
      </div>
      <div className="playerInfo">
        <div className="playerKicker">◆ BG Watch · {isOwn ? 'tu perfil' : 'perfil público'}</div>
        <h1 className="playerName">{user.name}</h1>
        <div className="playerBgg">
          @{user.handle} en BGG ·{' '}
          <a className="playerBggLink" href="#" onClick={e => e.preventDefault()}>
            Ver en BoardGameGeek <Icon.External />
          </a>
        </div>
      </div>
      <div className="playerActions">
        {isOwn ? (
          <>
            <button className="btn ghost"><Icon.Edit size={13}/> Editar</button>
            <button className="btn" onClick={onNewPlay}><Icon.Plus size={13}/> Nueva partida</button>
          </>
        ) : (
          <button className="btn ghost"><Icon.UserPlus size={13}/> Seguir</button>
        )}
      </div>
    </div>
  );
}

function StatsBar({ totalPlays, uniqueGames, topGame, lastPlay }) {
  return (
    <div className="statsBar">
      <div className="bigStat accent">
        <span className="lbl">Partidas</span>
        <span className="val">{totalPlays}</span>
        <span className="sub">↑ 12 este mes</span>
      </div>
      <div className="bigStat">
        <span className="lbl">Juegos únicos</span>
        <span className="val">{uniqueGames}</span>
        <span className="sub">de {COLL.length} en colección</span>
      </div>
      <div className="bigStat purple large">
        <span className="lbl">Más jugado</span>
        <span className="val">{topGame.name}</span>
        <span className="sub">{topGame.numPlays}× partidas</span>
      </div>
      <div className="bigStat gold large">
        <span className="lbl">Última partida</span>
        <span className="val">{fmtDate(lastPlay.date, { day: 'numeric', month: 'short' })}</span>
        <span className="sub">{lastPlay.game}</span>
      </div>
    </div>
  );
}

// ─── Play row card ───────────────────────────────────────────
function PlayCard({ play, onOpen }) {
  const d = new Date(play.date);
  const isCoop = play.coop;
  // Winner(s): coop → all players win together; versus win → you (first); loss → top opponent
  const winners = isCoop
    ? play.players
    : (play.outcome === 'win' ? [play.players[0]] : [play.players[1] || play.players[0]]);
  const winSym = isCoop
    ? (play.outcome === 'win' ? '✦ Ganaron' : '○ Perdieron')
    : (play.outcome === 'win' ? '✦ Ganaste' : '○ Perdiste');
  return (
    <div className="play" onClick={onOpen}>
      <div className="playDate">
        <span className="playDateDay">{d.getDate()}</span>
        <span className="playDateMonth">{MESES_CORTO[d.getMonth()]}</span>
        <span className="playDateYear">{d.getFullYear()}</span>
      </div>
      <div className="playGameThumb">{play.initial}</div>
      <div className="playInfo">
        <span className="playGame">{play.game}</span>
        <div className="playMeta">
          <span className="playMetaItem"><Icon.Pin size={11}/> {play.location}</span>
          <span className="playMetaItem"><Icon.Clock size={11}/> {play.duration} min</span>
          <span className="playMetaItem"><Icon.Users size={11}/> {play.players.length} jug.</span>
        </div>
        <div className="playWinner">
          <Icon.Crown size={13} filled />
          <div className="playWinnerAvs">
            {winners.slice(0, 3).map((p, i) => <Avatar key={i} user={p} size="xs" />)}
          </div>
          <span className="playWinnerName">
            {isCoop ? 'Ganaron en equipo' : <>Ganó <strong>{winners[0]?.name}</strong></>}
          </span>
        </div>
      </div>
      <div className="playRight">
        <span className={`playOutcome ${play.outcome}`}>{winSym}</span>
        <span className="playScore">
          {play.score}{play.vsScore != null && <><span className="vs">·</span>{play.vsScore}</>}
        </span>
      </div>
    </div>
  );
}

// ─── Partidas panel ──────────────────────────────────────────
function PartidasPanel({ onOpenPlay }) {
  const [filter, setFilter] = useState('all');
  return (
    <div className="partidasLayout">
      <div className="playsList">
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[{ id: 'all', l: 'Todas · 100' }, { id: 'year', l: 'Este año · 47' }, { id: 'month', l: 'Este mes · 12' }, { id: '7d', l: '7 días · 3' }].map(f => (
            <button key={f.id} className={`chip ${filter === f.id ? 'chipActive' : ''}`} onClick={() => setFilter(f.id)}>
              {f.l}
            </button>
          ))}
        </div>

        {PLAYS.map(pl => <PlayCard key={pl.id} play={pl} onOpen={() => onOpenPlay(pl.id)} />)}

        <button className="btn ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
          Cargar más partidas ↓
        </button>
      </div>

      <aside className="playsSideCol">
        <div className="sideWidget">
          <div className="sideWidgetLabel">◆ Calendario · últimas 13 semanas</div>
          <div className="heatmap">
            {HEATMAP.map((lvl, i) => (
              <div key={i} className={`heatmapCell ${lvl ? 'l' + lvl : ''}`} />
            ))}
          </div>
          <div className="heatmapLegend">
            <span>Menos</span>
            <div className="heatmapScale">
              <div className="heatmapCell" />
              <div className="heatmapCell l1" />
              <div className="heatmapCell l2" />
              <div className="heatmapCell l3" />
              <div className="heatmapCell l4" />
            </div>
            <span>Más</span>
          </div>
        </div>

        <div className="sideWidget">
          <div className="sideWidgetLabel">◆ Top de la colección</div>
          <div className="miniRankList">
            {TOP_GAMES.map((g, i) => {
              const max = TOP_GAMES[0].numPlays;
              return (
                <div key={g.id} className="miniRank">
                  <span className={`miniRankNum ${i === 0 ? 'top' : ''}`}>{i + 1}</span>
                  <div className="miniRankInfo">
                    <div className="miniRankName">{g.name}</div>
                    <div className="miniRankBar">
                      <div className={`miniRankBarFill ${i === 0 ? 'gold' : ''}`} style={{ width: `${(g.numPlays / max) * 100}%` }} />
                    </div>
                  </div>
                  <span className="miniRankCount">{g.numPlays}×</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sideWidget">
          <div className="sideWidgetLabel">◆ Win rate</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 800, color: 'var(--green)', letterSpacing: '-0.04em' }}>64%</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>en 31 partidas medidas</span>
          </div>
          <div style={{ marginTop: 12, height: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '64%', background: 'linear-gradient(90deg, #00ad6a, var(--green))' }} />
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── Colección panel ────────────────────────────────────────
function ColeccionPanel() {
  const [view, setView] = useState('played');
  const list = useMemo(() => {
    if (view === 'played') return COLL.filter(g => g.numPlays > 0);
    if (view === 'unplayed') return COLL.filter(g => g.numPlays === 0);
    return COLL;
  }, [view]);

  return (
    <div>
      <div className="coleccionControls">
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'all', l: `Todos · ${COLL.length}` },
            { id: 'played', l: `Jugados · ${COLL.filter(g=>g.numPlays>0).length}` },
            { id: 'unplayed', l: `Sin jugar · ${COLL.filter(g=>g.numPlays===0).length}` }].map(v => (
            <button key={v.id} className={`chip ${view === v.id ? 'chipActive' : ''}`} onClick={() => setView(v.id)}>
              {v.l}
            </button>
          ))}
        </div>
        <input className="searchInput" placeholder="Buscar en colección…" style={{ width: 200 }} />
      </div>

      <div className="coleccionGrid">
        {list.map(g => (
          <div key={g.id} className="gameCard">
            <div className="gameCardThumb">
              <Icon.Dice size={36}/>
              <span className={`gameCardCount ${g.numPlays === 0 ? 'zero' : ''}`}>
                {g.numPlays === 0 ? 'Sin jugar' : `${g.numPlays}×`}
              </span>
            </div>
            <div className="gameCardBody">
              <h4 className="gameCardName">{g.name}</h4>
              <div className="gameCardYear">{g.year}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Play detail screen ─────────────────────────────────────
function PlayDetailScreen({ playId, onBack }) {
  const play = useMemo(() => PLAYS.find(p => p.id === playId) || PLAYS[0], [playId]);
  const d = new Date(play.date);
  const ranked = [...play.players].map((p, i) => ({ ...p, score: i === 0 ? play.score : Math.max(20, play.score - 6 - i * 8) }));
  ranked.sort((a, b) => b.score - a.score);

  return (
    <div className="page">
      <button className="backBtn" onClick={onBack}>
        <Icon.ArrowLeft size={11}/> Volver a partidas
      </button>

      <div className="playDetailHero">
        <div className="playDetailThumb">{play.initial}</div>
        <div className="playDetailInfo">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--accent-light)', textTransform: 'uppercase' }}>
            ◆ Partida #{play.id.slice(2)}
          </div>
          <h1 className="playDetailGame">{play.game}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="statusPill"><Icon.Calendar size={11}/> {fmtDate(play.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span className="statusPill"><Icon.Pin size={11}/> {play.location}</span>
            <span className="statusPill"><Icon.Clock size={11}/> {play.duration} min</span>
            <span className="statusPill"><Icon.Users size={11}/> {play.players.length} jugadores</span>
          </div>
        </div>
        <div className="playDetailScore">
          <div className="playDetailScoreLbl">Tu puntaje</div>
          <div className="playDetailScoreVal" style={{ color: play.outcome === 'win' ? 'var(--green)' : undefined }}>{play.score}</div>
        </div>
      </div>

      {/* Players table */}
      <div className="ruleLine"><span>◆ Resultados</span></div>
      <div className="playersTable">
        <div className="playersHead">
          <div>#</div>
          <div>Jugador</div>
          <div>Puntaje</div>
          <div>Resultado</div>
        </div>
        {ranked.map((p, i) => {
          const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
          return (
            <div key={p.handle + i} className="playersRow">
              <div className={`rank ${rankCls}`}>#{i+1}</div>
              <div className="player">
                <Avatar user={p} size="sm" />
                <span className="nm">{p.name}</span>
              </div>
              <div className="score">{p.score}</div>
              <div className="outcome">
                {i === 0 ? <span className="playOutcome win">✦ Ganó</span> : <span className="playOutcome loss">—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {play.notes && (
        <div className="playNotes" style={{ marginTop: 28 }}>
          <div className="playNotesHead">◆ Tus notas</div>
          <p className="playNotesBody">"{play.notes}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Profile screen ─────────────────────────────────────────
function ProfileScreen({ onOpenPlay, onNewPlay }) {
  const [tab, setTab] = useState('partidas');
  const topGame = TOP_GAMES[0];
  const lastPlay = PLAYS[0];
  const uniqueGames = COLL.filter(g => g.numPlays > 0).length;
  const totalPlays = PLAYS.length * 14; // mock — ~100

  return (
    <div className="page">
      <PlayerHeader user={P.vos} isOwn={true} onNewPlay={onNewPlay} />

      <StatsBar
        totalPlays={100}
        uniqueGames={uniqueGames}
        topGame={topGame}
        lastPlay={lastPlay}
      />

      <div className="tabs">
        <button className={`tab ${tab === 'partidas' ? 'tabActive' : ''}`} onClick={() => setTab('partidas')}>
          Partidas <span className="badge">100</span>
        </button>
        <button className={`tab ${tab === 'coleccion' ? 'tabActive' : ''}`} onClick={() => setTab('coleccion')}>
          Colección <span className="badge">{COLL.length}</span>
        </button>
      </div>

      {tab === 'partidas' && <PartidasPanel onOpenPlay={onOpenPlay} />}
      {tab === 'coleccion' && <ColeccionPanel />}
    </div>
  );
}

// ─── App shell ──────────────────────────────────────────────
function BgWatchApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "accent": "blue"
  }/*EDITMODE-END*/;

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('landing');
  const [playId, setPlayId] = useState(null);

  const openPlay = (id) => { setPlayId(id); setScreen('play'); };

  return (
    <div className="app-root">
      <Switcher
        crumb="BG Watch · Reimagined"
        tabs={[
          { id: 'landing', label: 'Landing' },
          { id: 'profile', label: 'Perfil' },
          { id: 'create',  label: 'Registrar partida' },
          { id: 'play',    label: 'Detalle partida' },
        ]}
        active={screen}
        onTab={(id) => {
          if (id === 'play' && !playId) setPlayId(PLAYS[0].id);
          setScreen(id);
        }}
        pill="v2 · almanac"
      />

      {screen === 'landing' && <LandingScreen onEnter={() => setScreen('profile')} />}
      {screen === 'profile' && <ProfileScreen onOpenPlay={openPlay} onNewPlay={() => setScreen('create')} />}
      {screen === 'create'  && <CreatePlayScreen onCancel={() => setScreen('profile')} onSave={() => setScreen('profile')} />}
      {screen === 'play'    && <PlayDetailScreen playId={playId} onBack={() => setScreen('profile')} />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Demo · Navegación" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'landing', l: 'Landing' },
            { id: 'profile', l: 'Perfil' },
            { id: 'create',  l: 'Registrar' },
            { id: 'play',    l: 'Partida' },
          ].map(b => (
            <button key={b.id} onClick={() => { if (b.id === 'play' && !playId) setPlayId(PLAYS[0].id); setScreen(b.id); }}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                background: screen === b.id ? 'var(--accent)' : 'transparent',
                color: screen === b.id ? '#fff' : 'var(--text-secondary)',
                border: '1px solid ' + (screen === b.id ? 'var(--accent)' : 'var(--border)'),
              }}>{b.l}</button>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<BgWatchApp />);
