/* global React, Icon, Avatar, COLL, P, MESES_CORTO, fmtDate */
const { useState, useMemo } = React;

// 2-letter abbreviation for a game (mirror of the play.initial style)
function gameInitials(name) {
  if (!name) return '?';
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

// Mock expansions per game (mirrors BGG "expansions played" picker)
const EXPANSIONS = {
  'Wingspan': ['Europa', 'Oceanía', 'Asia'],
  'Catán': ['Navegantes', 'Ciudades y Caballeros'],
  'Brass: Birmingham': [],
  'Spirit Island': ['Branch & Claw', 'Jagged Earth'],
  'Ark Nova': ['Marine Worlds'],
  'Terraforming Mars': ['Prelude', 'Venus Next', 'Colonies'],
};

const TEAM_IDS = ['A', 'B', 'C', 'D'];

// ─── Score stepper cell (− input +) ──────────────────────────
function ScoreCell({ value, onChange, onStep }) {
  return (
    <div className="scoreCell">
      <button type="button" className="scoreStep" onClick={() => onStep(-1)} tabIndex={-1} aria-label="Bajar">−</button>
      <input className="scoreInput" inputMode="numeric" placeholder="—" value={value}
        onChange={e => onChange(e.target.value.replace(/[^\d-]/g, ''))} maxLength={6} />
      <button type="button" className="scoreStep" onClick={() => onStep(1)} tabIndex={-1} aria-label="Subir">+</button>
    </div>
  );
}

// ─── Create / Log a play ──────────────────────────────────────
function CreatePlayScreen({ onCancel, onSave, editMode = false }) {
  const PARTNERS = [P.cami, P.pancho, P.vale, P.tomi, P.luci, P.joaco];
  // Última juntada (mock) — pre-llena jugadores + ubicación con un toque
  const LAST_JUNTADA = { players: [P.cami, P.pancho, P.vale], location: 'Casa de Cami · Palermo' };
  const applyLastJuntada = () => {
    setPlayers([
      { ...P.vos, score: '', team: 'A', win: false, isNew: false },
      ...LAST_JUNTADA.players.map(p => ({ ...p, score: '', team: 'B', win: false, isNew: ['luci','joaco'].includes(p.handle) })),
    ]);
    setLocation(LAST_JUNTADA.location);
  };

  const [game, setGame] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [activePicker, setActivePicker] = useState(null); // null | 'player' | 'exp' | 'variant'
  const [playerSearch, setPlayerSearch] = useState('');
  const [expansions, setExpansions] = useState([]);
  const [variant, setVariant] = useState('');
  const [variantOpen, setVariantOpen] = useState(false);

  const [date, setDate] = useState('2026-05-19');
  const [quickDate, setQuickDate] = useState('hoy');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [incomplete, setIncomplete] = useState(false);
  const [noStats, setNoStats] = useState(false);

  const [mode, setMode] = useState('versus');      // 'versus' | 'coop' | 'teams'
  const [coopWin, setCoopWin] = useState(true);
  const [numTeams, setNumTeams] = useState(2);
  const [teamWin, setTeamWin] = useState(null);
  const [winsManual, setWinsManual] = useState(false);
  const [solo, setSolo] = useState(false);
  const [players, setPlayers] = useState([
    { ...P.vos, score: '', team: 'A', win: false, isNew: false },
  ]);
  const [notes, setNotes] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  const activeTeams = TEAM_IDS.slice(0, numTeams);

  // ── Game picker ──
  const filtered = useMemo(() => {
    let list = COLL;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => b.numPlays - a.numPlays);
  }, [search]);

  const pickGame = (g) => { setGame({ name: g.name, year: g.year, numPlays: g.numPlays }); setPickerOpen(false); setExpansions([]); setVariant(''); };
  const pickCustom = () => { if (search.trim()) { setGame({ name: search.trim(), custom: true }); setPickerOpen(false); } };
  const toggleExp = (e) => setExpansions(arr => arr.includes(e) ? arr.filter(x => x !== e) : [...arr, e]);
  const gameExps = game ? (EXPANSIONS[game.name] || []) : [];

  // ── Players ──
  const addPlayer = (p) => {
    if (players.find(x => x.handle === p.handle)) return;
    // mock "new" autodetect: a couple partners are new at this game
    const isNew = ['luci', 'joaco'].includes(p.handle);
    setPlayers([...players, { ...p, score: '', team: 'B', win: false, isNew }]);
  };
  const addGuest = () => {
    const n = players.filter(p => p.guest).length + 1;
    setPlayers([...players, { handle: 'guest' + Date.now(), name: `Anónimo ${n}`, initial: '?', color: '#5a6178', guest: true, anon: true, score: '', team: 'B', win: false, isNew: false }]);
  };
  const removePlayer = (handle) => setPlayers(players.filter(p => p.handle !== handle));
  const setTeam = (handle, team) => setPlayers(players.map(p => p.handle === handle ? { ...p, team } : p));

  // ── Ranking (versus) ──
  const ranked = useMemo(() => {
    const withNum = players.map(p => ({ ...p, n: p.score === '' || p.score === '-' ? null : Number(p.score) }));
    const scored = withNum.filter(p => p.n !== null);
    if (scored.length === 0) return players.map(p => ({ ...p, rank: null }));
    const sorted = [...withNum].sort((a, b) => (b.n ?? -Infinity) - (a.n ?? -Infinity));
    let rank = 0, lastScore = null;
    return sorted.map((p, i) => {
      if (p.n === null) return { ...p, rank: null };
      if (p.n !== lastScore) { rank = i + 1; lastScore = p.n; }
      return { ...p, rank };
    });
  }, [players]);

  // Auto-leader by top score (single)
  const autoLeader = useMemo(() => {
    const r = ranked.filter(p => p.rank === 1);
    return r.length === 1 ? r[0].handle : null;
  }, [ranked]);
  // Winner handle: manual override or auto top score
  const winnerHandle = winsManual ? (players.find(p => p.win)?.handle || null) : autoLeader;

  // Score change: if not manual, winner stays auto (no flag needed)
  const setScore = (handle, v) => setPlayers(players.map(p => p.handle === handle ? { ...p, score: v.replace(/[^\d-]/g, '') } : p));
  const stepScore = (handle, d) => setPlayers(players.map(p => {
    if (p.handle !== handle) return p;
    const cur = Number(p.score); const base = p.score.trim() !== '' && Number.isFinite(cur) ? cur : 0;
    return { ...p, score: String(base + d) };
  }));
  const toggleWin = (handle) => {
    setWinsManual(true);
    setPlayers(players.map(p => ({ ...p, win: p.handle === handle ? !p.win : false })));
  };
  const sortByScore = () => setPlayers([...players].sort((a, b) => (Number(b.score) || -Infinity) - (Number(a.score) || -Infinity)));

  const youWin = mode === 'versus' ? (winnerHandle === 'vos')
    : mode === 'teams' ? (players.find(p => p.handle === 'vos')?.team === teamWin)
    : coopWin;

  const playerWins = (p) => mode === 'coop' ? coopWin : mode === 'teams' ? (!!teamWin && p.team === teamWin) : (p.handle === winnerHandle);

  // ── Progress (3 required steps) ──
  const meaningful = players.length;
  const steps = {
    game: !!game,
    jugadores: meaningful >= 2 || (meaningful === 1 && solo),
    cuando: !!date,
  };
  const doneCount = Object.values(steps).filter(Boolean).length;
  const canSave = steps.game && steps.jugadores && !!date;
  const initials = game ? gameInitials(game.name) : null;
  const canSort = mode !== 'coop' && players.length > 1 && players.some(p => p.score !== '');

  // ── Player row renderer (shared) ──
  const renderRow = (p) => {
    const isLeader = playerWins(p);
    const rankLabel = mode === 'versus' ? (ranked.find(r => r.handle === p.handle)?.rank) : null;
    return (
      <div key={p.handle} className={`scoreRow ${isLeader ? 'leader' : ''} ${p.handle === 'vos' ? 'you' : ''}`}>
        <span className="scoreRank">{mode === 'versus' ? (rankLabel ? `#${rankLabel}` : '—') : '·'}</span>
        {p.anon ? <span className="ghostAvatar" aria-hidden="true">👤</span> : <Avatar user={p} size="sm" />}
        <div className="scorePlayer">
          <span className="scorePlayerName">{p.name}</span>
          {!p.anon && !p.guest && p.handle !== 'vos' && <span className="scorePlayerHandle">@{p.handle}</span>}
          {p.handle === 'vos' && <span className="scorePlayerYou">vos</span>}
          {p.anon && <span className="anonTag">anónimo</span>}
          {isLeader && <span className="scoreCrown"><Icon.Crown size={13} filled /></span>}
          {p.isNew && <span className="newBadge" title="Primera vez que lo juega">✨ Nuevo</span>}
        </div>

        {mode === 'versus' ? (
          <div className="scoreControls">
            <ScoreCell value={p.score} onChange={v => setScore(p.handle, v)} onStep={d => stepScore(p.handle, d)} />
            <button type="button" className={`winToggle ${p.handle === winnerHandle ? 'active' : ''}`} onClick={() => toggleWin(p.handle)} aria-label="Ganó" title="Ganó">
              <Icon.Trophy size={15} />
            </button>
          </div>
        ) : mode === 'coop' ? (
          <span className="teamTag">Equipo</span>
        ) : (
          <div className="scoreControls">
            <ScoreCell value={p.score} onChange={v => setScore(p.handle, v)} onStep={d => stepScore(p.handle, d)} />
            <div className="teamPick" role="group" aria-label="Equipo">
              {activeTeams.map(t => (
                <button key={t} type="button" className={`teamBtn ${p.team === t ? 'active' : ''}`} onClick={() => setTeam(p.handle, t)}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {players.length > 1 && (p.handle === 'vos'
          ? <span style={{ width: 28 }} />
          : <button className="scoreRemove" onClick={() => removePlayer(p.handle)} aria-label="Quitar"><Icon.X size={14}/></button>)}
      </div>
    );
  };

  // scorecard rows ordered
  const scRows = mode === 'versus'
    ? [...ranked].sort((a,b) => (a.rank ?? 99) - (b.rank ?? 99))
    : mode === 'teams'
      ? [...players].sort((a,b) => (a.team || 'Z').localeCompare(b.team || 'Z'))
      : players;

  return (
    <div className="page">
      <button className="backBtn" onClick={onCancel}>
        <Icon.ArrowLeft size={11}/> Cancelar y volver
      </button>

      <div className="createPlayHead">
        <div>
          <div className="createPlayKicker"><Icon.Dice size={12}/> BG Watch · {editMode ? 'editar' : 'nueva entrada'}</div>
          <h1 className="createPlayTitle">{editMode ? 'Editá la ' : 'Anotá la '}<em>partida.</em></h1>
        </div>
        <div className="createPlayProgress">
          <span className="createPlayProgressVal">{doneCount}/3</span>
          <span className="createPlayProgressLbl">secciones listas</span>
        </div>
      </div>

      <div className="createPlayLayout">
        {/* ─── FORM ─── */}
        <div className="createPlayForm">

          {/* 1 · Juego */}
          <section className="cpSection">
            <div className="cpSectionHead">
              <span className={`cpSectionNum ${steps.game ? 'done' : ''}`}>{steps.game ? <Icon.Check size={13}/> : '1'}</span>
              <span className="cpSectionTitle">¿Qué jugaron?</span>
              {game && <span className="cpSectionHint">de tu colección</span>}
            </div>

            {game && !pickerOpen ? (
              <>
                <div className="gamePickerSelected">
                  <div className="gamePickerThumb">{initials}</div>
                  <div className="gamePickerInfo">
                    <div className="gamePickerName">{game.name}</div>
                    <div className="gamePickerMeta">{game.custom ? 'Juego nuevo · fuera de colección' : `${game.year} · ${game.numPlays}× jugado`}</div>
                  </div>
                  <button className="gamePickerChange" onClick={() => setPickerOpen(true)}>Cambiar</button>
                </div>

                {/* Expansion + variant chips */}
                {(expansions.length > 0 || variant) && (
                  <div className="gameExtrasChips">
                    {expansions.map(e => (
                      <span key={e} className="extraChip">{e}<button onClick={() => toggleExp(e)} aria-label={`Quitar ${e}`}>✕</button></span>
                    ))}
                    {variant && <span className="extraChip variant">🎲 {variant}<button onClick={() => setVariant('')} aria-label="Quitar variante">✕</button></span>}
                  </div>
                )}

                <div className="gameExtrasActions" style={{ position: 'relative' }}>
                  <button className="btn ghost small" onClick={() => setActivePicker(p => p === 'exp' ? null : 'exp')} aria-expanded={activePicker === 'exp'}>+ Expansión jugada</button>
                  <button className="btn ghost small pushRight" onClick={() => setActivePicker(p => p === 'variant' ? null : 'variant')} aria-expanded={activePicker === 'variant'}>+ Variante/tablero</button>

                  {activePicker === 'exp' && (
                    <div className="cpPickerPop">
                      <div className="cpPickerSection">Expansiones jugadas</div>
                      {gameExps.length === 0
                        ? <div className="cpPickerEmpty">Este juego no tiene expansiones en tu colección.</div>
                        : gameExps.map(e => (
                          <button key={e} className="cpPickerItem" onClick={() => toggleExp(e)}>
                            <span className="nm">{e}</span>
                            <span className="hd" style={{ color: expansions.includes(e) ? 'var(--accent-light)' : undefined }}>{expansions.includes(e) ? '✓ agregada' : '+ agregar'}</span>
                          </button>
                        ))}
                    </div>
                  )}
                  {activePicker === 'variant' && (
                    <div className="cpPickerPop">
                      <div className="cpPickerSection">Variante o tablero</div>
                      <div className="cpVariantRow">
                        <input autoFocus placeholder="Lado B, mapa avanzado…" defaultValue={variant}
                          onKeyDown={e => { if (e.key === 'Enter') { setVariant(e.target.value.trim()); setActivePicker(null); } }} id="cpVarInputD" />
                        <button onClick={() => { const v = document.getElementById('cpVarInputD').value.trim(); if (v) { setVariant(v); setActivePicker(null); } }}>OK</button>
                      </div>
                      {['Lado oscuro', 'Mapa avanzado', 'Modo experto'].map(v => (
                        <button key={v} className="cpPickerItem" onClick={() => { setVariant(v); setActivePicker(null); }}>
                          <span className="nm">{v}</span><span className="hd">sugerida</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="gamePickerSearch">
                  <input className="searchInput" placeholder="Buscar en tu colección…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                </div>
                {filtered.length > 0 ? (
                  <div className="gameTileGrid">
                    {filtered.map(g => (
                      <button key={g.id} className={`gameTile ${game && game.name === g.name ? 'active' : ''}`} onClick={() => pickGame(g)}>
                        <div className="gameTileThumb">
                          <span className="twoLetter">{gameInitials(g.name)}</span>
                          <span className={`gameTilePlays ${g.numPlays === 0 ? 'zero' : ''}`}>{g.numPlays === 0 ? 'nuevo' : `${g.numPlays}×`}</span>
                        </div>
                        <div className="gameTileBody">
                          <div className="gameTileName">{g.name}</div>
                          <div className="gameTileYear">{g.year}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="gamePickerEmpty">Ningún juego coincide con "{search}"</div>
                )}
                {search.trim() && (
                  <div className="gamePickerCustom">¿No está en tu colección?<button onClick={pickCustom}>Registrar "{search.trim()}" igual →</button></div>
                )}
              </>
            )}
          </section>

          {/* 2 · Quiénes jugaron */}
          <section className="cpSection">
            <div className="cpSectionHead">
              <span className={`cpSectionNum ${steps.jugadores ? 'done' : ''}`}>{steps.jugadores ? <Icon.Check size={13}/> : '2'}</span>
              <span className="cpSectionTitle">¿Quiénes jugaron?</span>
              <span className="cpSectionHint">{players.length} jugador{players.length === 1 ? '' : 'es'}</span>
            </div>

            <div className="cpModeToggle" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <button className={`cpMode ${mode === 'versus' ? 'active' : ''}`} onClick={() => setMode('versus')}>
                <span className="t">Competitiva</span><span className="d">cada uno su puntaje</span>
              </button>
              <button className={`cpMode ${mode === 'coop' ? 'active' : ''}`} onClick={() => setMode('coop')}>
                <span className="t">Cooperativa</span><span className="d">ganan o pierden juntos</span>
              </button>
              <button className={`cpMode ${mode === 'teams' ? 'active' : ''}`} onClick={() => { setMode('teams'); if (!teamWin) setTeamWin(null); }}>
                <span className="t">Equipos</span><span className="d">gana un equipo</span>
              </button>
            </div>

            {mode === 'coop' && (
              <div className="coopOutcome">
                <button className={`coopBtn win ${coopWin ? 'active' : ''}`} onClick={() => setCoopWin(true)}>
                  <span className="ic"><Icon.Trophy size={24}/></span><span className="t">Ganamos</span>
                </button>
                <button className={`coopBtn loss ${!coopWin ? 'active' : ''}`} onClick={() => setCoopWin(false)}>
                  <span className="ic"><Icon.X size={24}/></span><span className="t">Perdimos</span>
                </button>
              </div>
            )}

            {mode === 'teams' && (
              <div className="teamResult">
                <span className="teamResultLabel">¿Qué equipo ganó?</span>
                <div className="teamResultBtns">
                  {numTeams > 2 && <button className="btn ghost small" onClick={() => { const r = TEAM_IDS[numTeams-1]; setPlayers(players.map(p => p.team === r ? {...p, team:'A'} : p)); if (teamWin === r) setTeamWin(null); setNumTeams(numTeams-1); }}>− Equipo</button>}
                  {activeTeams.map(t => (
                    <button key={t} className={`teamWinBtn ${t.toLowerCase()} ${teamWin === t ? 'on' : ''}`} onClick={() => setTeamWin(teamWin === t ? null : t)} aria-pressed={teamWin === t}>
                      <span className="dot" /> Equipo {t}
                    </button>
                  ))}
                  {numTeams < 4 && <button className="btn ghost small" onClick={() => setNumTeams(numTeams+1)}>+ Equipo</button>}
                </div>
              </div>
            )}

            {meaningful === 1 && (
              <div className="cpHelperRow">
                <label className={`cpHelperPill ${solo ? 'on' : ''}`}>
                  <input type="checkbox" checked={solo} onChange={e => setSolo(e.target.checked)} />
                  <span className="hpCheck">{solo && <Icon.Check size={11}/>}</span>
                  <span className="hpText">Jugué en solitario</span>
                </label>
                {!editMode && (
                  <button className="cpHelperPill action" onClick={applyLastJuntada}>
                    <span className="hpIcon">↺</span>
                    <span className="hpText">Usar última juntada</span>
                    <span className="hpHint">{LAST_JUNTADA.players.length} jug. · {LAST_JUNTADA.location.split(' · ')[0]}</span>
                  </button>
                )}
              </div>
            )}

            <div className="scoreList">
              {scRows.map(renderRow)}
            </div>

            <div className="addPlayerWrap" style={{ position: 'relative' }}>
              <div className="addPlayerLabel">Agregar jugadores</div>
              <div className="addPlayerChips">
                <button className="addPlayerGuest" onClick={() => setActivePicker(p => p === 'player' ? null : 'player')} aria-expanded={activePicker === 'player'}>
                  <Icon.UserPlus size={12}/> Agregar jugador
                </button>
                <button className="addPlayerGuest" onClick={addGuest}><Icon.Plus size={11}/> Anónimo</button>
                {canSort && <button className="btn ghost small pushRight" onClick={sortByScore}>↓ Ordenar por puntaje</button>}
              </div>

              {activePicker === 'player' && (
                <div className="cpPickerPop">
                  <input className="cpPickerSearch" autoFocus placeholder="Buscar compañero o usuario…" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} />
                  <div className="cpPickerSection">Compañeros frecuentes</div>
                  {PARTNERS.filter(p => !playerSearch.trim() || p.name.toLowerCase().includes(playerSearch.toLowerCase()) || p.handle.includes(playerSearch.toLowerCase())).map(p => {
                    const present = !!players.find(x => x.handle === p.handle);
                    const isNew = ['luci', 'joaco'].includes(p.handle);
                    return (
                      <button key={p.handle} className="cpPickerItem" disabled={present} onClick={() => { addPlayer(p); setActivePicker(null); setPlayerSearch(''); }}>
                        <Avatar user={p} size="sm" />
                        <span className="nm">{p.name}</span>
                        <span className="hd">@{p.handle}</span>
                        {isNew && <span className="nb">✨</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 3 · Cuándo y dónde */}
          <section className="cpSection">
            <div className="cpSectionHead">
              <span className={`cpSectionNum ${steps.cuando ? 'done' : ''}`}>{steps.cuando ? <Icon.Check size={13}/> : '3'}</span>
              <span className="cpSectionTitle">¿Cuándo y dónde?</span>
            </div>

            <div className="cpFieldRow">
              <div className="cpField">
                <label>Fecha</label>
                <input className="cpInput" type="date" value={date} onChange={e => { setDate(e.target.value); setQuickDate(''); }} />
                <div className="cpQuickRow">
                  <button className={`cpQuick ${quickDate === 'hoy' ? 'active' : ''}`} onClick={() => { setDate('2026-05-19'); setQuickDate('hoy'); }}>Hoy</button>
                  <button className={`cpQuick ${quickDate === 'ayer' ? 'active' : ''}`} onClick={() => { setDate('2026-05-18'); setQuickDate('ayer'); }}>Ayer</button>
                </div>
              </div>
              <div className="cpField">
                <label>Duración (min)</label>
                <input className="cpInput" type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="60" />
                <div className="cpQuickRow">
                  {[30, 60, 90, 120].map(m => (
                    <button key={m} className={`cpQuick ${Number(duration) === m ? 'active' : ''}`} onClick={() => setDuration(m)}>{m}min</button>
                  ))}
                  {game && !game.custom && duration === '' && (
                    <button className="cpQuick suggest" onClick={() => setDuration(90)}>Tiempo de caja: 90min</button>
                  )}
                </div>
              </div>
            </div>

            <div className="cpField" style={{ marginTop: 16 }}>
              <label>Dónde se jugó</label>
              <input className="cpInput" value={location} onChange={e => setLocation(e.target.value)} placeholder="Casa de Cami · Club Estrategia · Bar La Torre…" />
            </div>

            <div className="cpCheckRow">
              <label className="cpCheck"><input type="checkbox" checked={incomplete} onChange={e => setIncomplete(e.target.checked)} /> Incompleta (no se terminó)</label>
              <label className="cpCheck"><input type="checkbox" checked={noStats} onChange={e => setNoStats(e.target.checked)} /> No contar para estadísticas</label>
            </div>
          </section>

          {/* 4 · Notas */}
          <section className="cpSection">
            <div className="cpSectionHead">
              <span className="cpSectionNum" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>4</span>
              <span className="cpSectionTitle">Notas</span>
              <span className="cpSectionHint">opcional</span>
            </div>
            <div className="cpField">
              <textarea className="cpInput cpNotes" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ese combo de la ronda 4, la jugada que definió todo, la revancha pendiente…" />
            </div>
          </section>

          {/* 5 · Compartí esta partida (solo crear) */}
          {!editMode && (
            <section className={`cpSection shareSection ${shareOpen ? 'open' : ''}`}>
              <button className="shareHead" onClick={() => setShareOpen(v => !v)} aria-expanded={shareOpen}>
                <span className="cpSectionNum" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>5</span>
                <span className="shareHeadText">
                  <span className="shareHeadTitle">Compartí esta partida</span>
                  <span className="shareHeadSub">Publicá una juntada con fotos y copiá el link para tus grupos de WhatsApp o Telegram.</span>
                </span>
                <span className="cpSectionHint">opcional</span>
                <span className={`shareChevron ${shareOpen ? 'open' : ''}`}><Icon.Arrow size={14} /></span>
              </button>
              {shareOpen && (
                <div className="shareBody">
                  <div className="cpFieldRow">
                    <div className="cpField">
                      <label>Privacidad</label>
                      <div className="cpQuickRow">
                        <button className="cpQuick active">Pública</button>
                        <button className="cpQuick">Comunidad</button>
                        <button className="cpQuick">Privada</button>
                      </div>
                    </div>
                    <div className="cpField">
                      <label>Comunidad</label>
                      <input className="cpInput" placeholder="Elegí una comunidad…" />
                    </div>
                  </div>
                  <div className="cpField">
                    <label>Título</label>
                    <input className="cpInput" placeholder="18 dados, ni un triple…" />
                  </div>
                  <div className="cpField">
                    <label>Contá cómo estuvo</label>
                    <textarea className="cpInput cpNotes" placeholder="La crónica de la partida para tus amigos…" />
                  </div>
                  <div className="shareDrop"><Icon.Image size={20}/> Arrastrá fotos de la partida (opcional)</div>
                  <div className="shareResultNote"><Icon.Check size={11}/> Se adjunta el scorecard de resultados automáticamente.</div>
                </div>
              )}
            </section>
          )}

          {/* Footer */}
          <div className="cpFooter">
            <button className="btn ghost" onClick={onCancel}>Cancelar</button>
            <div className="cpFooterRight">
              {!editMode && <button className="btn ghost" disabled={!canSave} onClick={onSave}>Guardar y cargar otra</button>}
              <button className="btn" disabled={!canSave} onClick={onSave}>
                <Icon.Check size={13}/> {editMode ? 'Guardar cambios' : 'Guardar partida'}
              </button>
            </div>
          </div>

          {/* Danger zone (edit) */}
          {editMode && (
            <div className="dangerZone">
              <div className="dangerZoneLabel">◆ Zona de peligro</div>
              <div className="dangerZoneTitle">Eliminar partida</div>
              <p className="dangerZoneSub">Se borra la partida también en BoardGameGeek. Esta acción no se puede deshacer.</p>
              <button className="dangerBtn"><Icon.Trash size={11}/>&nbsp;Eliminar partida</button>
            </div>
          )}
        </div>

        {/* ─── LIVE SCORECARD ─── */}
        <aside className="cpPreview">
          <div className="cpPreviewLabel">◆ Tu entrada · en vivo</div>
          <div className="scorecard">
            <div className="scorecardTop">
              <div className="scorecardKicker">◆ BG Watch · partida</div>
              <div className="scorecardGameRow">
                <div className={`scorecardThumb ${!game ? 'empty' : ''}`}>{initials || <Icon.Dice size={20}/>}</div>
                <div>
                  <div className={`scorecardGameName ${!game ? 'empty' : ''}`}>{game ? game.name : 'Elegí un juego'}</div>
                  {expansions.length > 0 && <div className="scorecardExp">+ {expansions.join(', ')}</div>}
                </div>
              </div>
              <div className="scorecardMeta">
                <span><Icon.Calendar size={11}/> {date ? fmtDate(date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin fecha'}</span>
                {location.trim() && <span><Icon.Pin size={11}/> {location}</span>}
                {duration && <span><Icon.Clock size={11}/> {duration} min</span>}
                <span><Icon.Users size={11}/> {players.length} jug.</span>
                {incomplete && <span style={{ color: 'var(--orange)' }}>◷ incompleta</span>}
              </div>
            </div>

            <div className="scorecardBody">
              {(mode === 'coop' || mode === 'teams' ? (mode === 'coop' || teamWin) : winnerHandle) ? (
                <div className={`scorecardResultBanner ${youWin ? 'win' : 'loss'}`}>
                  {mode === 'teams'
                    ? (youWin ? <><Icon.Trophy size={14}/> Ganó tu equipo ({teamWin})</> : <>Ganó el equipo {teamWin}</>)
                    : (youWin ? <><Icon.Trophy size={14}/> {mode === 'coop' ? '¡Ganaron!' : '¡Ganaste!'}</> : <>{mode === 'coop' ? 'Perdieron' : 'Perdiste'}</>)}
                </div>
              ) : (
                <div className="scorecardResultBanner empty">{mode === 'versus' ? 'Marcá el ganador para ver el resultado' : 'Elegí el resultado'}</div>
              )}

              {mode === 'versus' ? (
                ranked.some(p => p.rank || p.handle === winnerHandle) ? (
                  <div className="scorecardPlayers">
                    {scRows.map(p => (
                      <div key={p.handle} className={`scorecardPlayer ${p.handle === winnerHandle ? 'lead' : ''} ${p.handle === 'vos' ? 'you' : ''}`}>
                        <span className="pr">{p.handle === winnerHandle ? <Icon.Crown size={11} filled /> : (p.rank ? `#${p.rank}` : '—')}</span>
                        {p.anon ? <span className="ghostAvatar sm" aria-hidden="true">👤</span> : <Avatar user={p} size="sm" />}
                        <span className="nm">{p.name}{p.handle === 'vos' ? ' (vos)' : ''}</span>
                        <span className="sc">{p.score === '' ? '—' : p.score}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="scorecardEmpty">Sin puntajes todavía</div>
              ) : mode === 'teams' ? (
                <div className="scorecardPlayers">
                  {scRows.map(p => (
                    <div key={p.handle} className={`scorecardPlayer ${p.team === teamWin ? 'lead' : ''} ${p.handle === 'vos' ? 'you' : ''}`}>
                      <span className="pr">{p.team === teamWin ? <Icon.Crown size={11} filled /> : p.team}</span>
                      {p.anon ? <span className="ghostAvatar sm" aria-hidden="true">👤</span> : <Avatar user={p} size="sm" />}
                      <span className="nm">{p.name}{p.handle === 'vos' ? ' (vos)' : ''}</span>
                      <span className="sc" style={{ fontSize: '0.72rem', color: p.team === 'A' ? 'var(--accent-light)' : 'var(--orange)' }}>EQ. {p.team}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="scorecardPlayers">
                  {players.map(p => (
                    <div key={p.handle} className={`scorecardPlayer ${p.handle === 'vos' ? 'you' : ''}`}>
                      <span className="pr"><Icon.Users size={11}/></span>
                      {p.anon ? <span className="ghostAvatar sm" aria-hidden="true">👤</span> : <Avatar user={p} size="sm" />}
                      <span className="nm">{p.name}{p.handle === 'vos' ? ' (vos)' : ''}</span>
                      <span className="sc" style={{ fontSize: '0.8rem', color: youWin ? 'var(--green)' : 'var(--text-muted)' }}>{youWin ? '✦' : '○'}</span>
                    </div>
                  ))}
                </div>
              )}

              {notes.trim() && <div className="scorecardNotes">"{notes}"</div>}
            </div>
          </div>
          <div className="previewHint">Se guarda en tu almanaque{!editMode && shareOpen ? ' y se publica la juntada' : ''} al confirmar</div>
        </aside>
      </div>
    </div>
  );
}

window.CreatePlayScreen = CreatePlayScreen;
