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

// ─── Create / Log a play ──────────────────────────────────────
function CreatePlayScreen({ onCancel, onSave }) {
  // Frequent partners pulled from the shared P roster (exclude "vos")
  const PARTNERS = [P.cami, P.pancho, P.vale, P.tomi, P.luci, P.joaco];

  const [game, setGame] = useState(null);          // { name, year, numPlays } | { custom:true, name }
  const [pickerOpen, setPickerOpen] = useState(true);
  const [search, setSearch] = useState('');

  const [date, setDate] = useState('2026-05-19');
  const [quickDate, setQuickDate] = useState('hoy');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState(90);

  const [mode, setMode] = useState('versus');      // 'versus' | 'coop'
  const [coopWin, setCoopWin] = useState(true);
  const [players, setPlayers] = useState([
    { ...P.vos, score: '' },
  ]);
  const [notes, setNotes] = useState('');

  // ── Game picker ──
  const filtered = useMemo(() => {
    let list = COLL;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(g => g.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => b.numPlays - a.numPlays);
  }, [search]);

  const pickGame = (g) => {
    setGame({ name: g.name, year: g.year, numPlays: g.numPlays });
    setPickerOpen(false);
  };
  const pickCustom = () => {
    if (search.trim()) { setGame({ name: search.trim(), custom: true }); setPickerOpen(false); }
  };

  // ── Players ──
  const addPlayer = (p) => {
    if (players.find(x => x.handle === p.handle)) return;
    setPlayers([...players, { ...p, score: '' }]);
  };
  const addGuest = () => {
    const n = players.filter(p => p.guest).length + 1;
    setPlayers([...players, { handle: 'guest' + Date.now(), name: `Invitado ${n}`, initial: 'I', color: '#5a6178', guest: true, score: '' }]);
  };
  const removePlayer = (handle) => setPlayers(players.filter(p => p.handle !== handle));
  const setScore = (handle, v) => setPlayers(players.map(p => p.handle === handle ? { ...p, score: v.replace(/[^\d-]/g, '') } : p));

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

  const leaderHandle = useMemo(() => {
    const r = ranked.filter(p => p.rank === 1);
    return r.length === 1 ? r[0].handle : null;
  }, [ranked]);

  const youWin = mode === 'versus'
    ? (leaderHandle === 'vos')
    : coopWin;

  // ── Progress ──
  const steps = {
    game: !!game,
    when: !!date && !!location.trim(),
    players: mode === 'coop' ? players.length >= 1 : players.every(p => p.score !== '' && p.score !== '-'),
  };
  const doneCount = Object.values(steps).filter(Boolean).length;
  const canSave = steps.game && !!date;

  const initials = game ? gameInitials(game.name) : null;

  return (
    <div className="page">
      <button className="backBtn" onClick={onCancel}>
        <Icon.ArrowLeft size={11}/> Cancelar y volver
      </button>

      <div className="createPlayHead">
        <div>
          <div className="createPlayKicker"><Icon.Dice size={12}/> BG Watch · nueva entrada</div>
          <h1 className="createPlayTitle">Anotá la <em>partida.</em></h1>
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
              <div className="gamePickerSelected">
                <div className="gamePickerThumb">{initials}</div>
                <div className="gamePickerInfo">
                  <div className="gamePickerName">{game.name}</div>
                  <div className="gamePickerMeta">
                    {game.custom ? 'Juego nuevo · fuera de colección' : `${game.year} · ${game.numPlays}× jugado`}
                  </div>
                </div>
                <button className="gamePickerChange" onClick={() => setPickerOpen(true)}>Cambiar</button>
              </div>
            ) : (
              <>
                <div className="gamePickerSearch">
                  <input
                    className="searchInput"
                    placeholder="Buscar en tu colección…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {filtered.length > 0 ? (
                  <div className="gameTileGrid">
                    {filtered.map(g => (
                      <button
                        key={g.id}
                        className={`gameTile ${game && game.name === g.name ? 'active' : ''}`}
                        onClick={() => pickGame(g)}
                      >
                        <div className="gameTileThumb">
                          <span className="twoLetter">{gameInitials(g.name)}</span>
                          <span className={`gameTilePlays ${g.numPlays === 0 ? 'zero' : ''}`}>
                            {g.numPlays === 0 ? 'nuevo' : `${g.numPlays}×`}
                          </span>
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
                  <div className="gamePickerCustom">
                    ¿No está en tu colección?
                    <button onClick={pickCustom}>Registrar "{search.trim()}" igual →</button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* 2 · Cuándo y dónde */}
          <section className="cpSection">
            <div className="cpSectionHead">
              <span className={`cpSectionNum ${steps.when ? 'done' : ''}`}>{steps.when ? <Icon.Check size={13}/> : '2'}</span>
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
                <label>Duración</label>
                <input className="cpInput" type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="min" />
                <div className="cpQuickRow">
                  {[30, 60, 90, 120].map(m => (
                    <button key={m} className={`cpQuick ${Number(duration) === m ? 'active' : ''}`} onClick={() => setDuration(m)}>{m}min</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="cpField" style={{ marginTop: 16 }}>
              <label>Dónde se jugó</label>
              <input className="cpInput" value={location} onChange={e => setLocation(e.target.value)} placeholder="Casa de Cami · Club Estrategia · Bar La Torre…" />
            </div>
          </section>

          {/* 3 · Quiénes y puntajes */}
          <section className="cpSection">
            <div className="cpSectionHead">
              <span className={`cpSectionNum ${steps.players ? 'done' : ''}`}>{steps.players ? <Icon.Check size={13}/> : '3'}</span>
              <span className="cpSectionTitle">¿Quiénes jugaron?</span>
              <span className="cpSectionHint">{players.length} jugador{players.length === 1 ? '' : 'es'}</span>
            </div>

            <div className="cpModeToggle">
              <button className={`cpMode ${mode === 'versus' ? 'active' : ''}`} onClick={() => setMode('versus')}>
                <span className="t">Competitiva</span>
                <span className="d">cada uno con su puntaje</span>
              </button>
              <button className={`cpMode ${mode === 'coop' ? 'active' : ''}`} onClick={() => setMode('coop')}>
                <span className="t">Cooperativa</span>
                <span className="d">ganan o pierden juntos</span>
              </button>
            </div>

            {mode === 'versus' ? (
              <div className="scoreList">
                {ranked.map((p) => (
                  <div key={p.handle} className={`scoreRow ${p.handle === leaderHandle ? 'leader' : ''} ${p.handle === 'vos' ? 'you' : ''}`}>
                    <span className="scoreRank">{p.rank ? `#${p.rank}` : '—'}</span>
                    <Avatar user={p} size="sm" />
                    <div className="scorePlayer">
                      <span className="scorePlayerName">{p.name}</span>
                      {p.handle === 'vos' && <span className="scorePlayerYou">vos</span>}
                      {p.handle === leaderHandle && <span className="scoreCrown"><Icon.Crown size={13} filled /></span>}
                    </div>
                    <input
                      className="scoreInput" type="number" inputMode="numeric"
                      value={p.score} onChange={e => setScore(p.handle, e.target.value)}
                      placeholder="—"
                    />
                    {p.handle !== 'vos' && (
                      <button className="scoreRemove" onClick={() => removePlayer(p.handle)} aria-label="Quitar"><Icon.X size={14}/></button>
                    )}
                    {p.handle === 'vos' && <span style={{ width: 28 }} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="coopResult">
                <div className="coopOutcome">
                  <button className={`coopBtn win ${coopWin ? 'active' : ''}`} onClick={() => setCoopWin(true)}>
                    <span className="ic"><Icon.Trophy size={24}/></span>
                    <span className="t">Ganamos</span>
                  </button>
                  <button className={`coopBtn loss ${!coopWin ? 'active' : ''}`} onClick={() => setCoopWin(false)}>
                    <span className="ic"><Icon.X size={24}/></span>
                    <span className="t">Perdimos</span>
                  </button>
                </div>
                <div className="scoreList">
                  {players.map((p) => (
                    <div key={p.handle} className={`scoreRow ${p.handle === 'vos' ? 'you' : ''}`}>
                      <span className="scoreRank" style={{ fontSize: '1rem' }}><Icon.Users size={14}/></span>
                      <Avatar user={p} size="sm" />
                      <div className="scorePlayer">
                        <span className="scorePlayerName">{p.name}</span>
                        {p.handle === 'vos' && <span className="scorePlayerYou">vos</span>}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>equipo</span>
                      {p.handle !== 'vos'
                        ? <button className="scoreRemove" onClick={() => removePlayer(p.handle)} aria-label="Quitar"><Icon.X size={14}/></button>
                        : <span style={{ width: 28 }} />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="addPlayerWrap">
              <div className="addPlayerLabel">Agregar jugadores</div>
              <div className="addPlayerChips">
                {PARTNERS.map(p => (
                  <button key={p.handle} className="addPlayerChip" onClick={() => addPlayer(p)} disabled={!!players.find(x => x.handle === p.handle)}>
                    <Avatar user={p} size="sm" /> {p.name}
                  </button>
                ))}
                <button className="addPlayerGuest" onClick={addGuest}><Icon.Plus size={11}/> Invitado</button>
              </div>
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
              <textarea
                className="cpInput cpNotes"
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ese combo de la ronda 4, la jugada que definió todo, la revancha pendiente…"
              />
            </div>
          </section>

          {/* Footer */}
          <div className="cpFooter">
            <button className="btn ghost" onClick={onCancel}>Descartar</button>
            <div className="cpFooterRight">
              <button className="btn ghost">Guardar y cargar otra</button>
              <button className="btn" disabled={!canSave} onClick={onSave}>
                <Icon.Check size={13}/> Guardar partida
              </button>
            </div>
          </div>
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
                </div>
              </div>
              <div className="scorecardMeta">
                <span><Icon.Calendar size={11}/> {date ? fmtDate(date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin fecha'}</span>
                {location.trim() && <span><Icon.Pin size={11}/> {location}</span>}
                {duration && <span><Icon.Clock size={11}/> {duration} min</span>}
                <span><Icon.Users size={11}/> {players.length} jug.</span>
              </div>
            </div>

            <div className="scorecardBody">
              {/* Result banner */}
              {(mode === 'coop' || (mode === 'versus' && leaderHandle)) ? (
                <div className={`scorecardResultBanner ${youWin ? 'win' : 'loss'}`}>
                  {youWin ? <><Icon.Trophy size={14}/> {mode === 'coop' ? '¡Ganaron!' : '¡Ganaste!'}</> : <>{mode === 'coop' ? 'Perdieron' : 'Perdiste'}</>}
                </div>
              ) : (
                <div className="scorecardResultBanner empty">Cargá los puntajes para ver el resultado</div>
              )}

              {/* Players */}
              {mode === 'versus' ? (
                ranked.some(p => p.rank) ? (
                  <div className="scorecardPlayers">
                    {[...ranked].sort((a,b) => (a.rank ?? 99) - (b.rank ?? 99)).map(p => (
                      <div key={p.handle} className={`scorecardPlayer ${p.handle === leaderHandle ? 'lead' : ''} ${p.handle === 'vos' ? 'you' : ''}`}>
                        <span className="pr">{p.rank ? `#${p.rank}` : '—'}</span>
                        <Avatar user={p} size="sm" />
                        <span className="nm">{p.name}{p.handle === 'vos' ? ' (vos)' : ''}</span>
                        <span className="sc">{p.score === '' ? '—' : p.score}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="scorecardEmpty">Sin puntajes todavía</div>
                )
              ) : (
                <div className="scorecardPlayers">
                  {players.map(p => (
                    <div key={p.handle} className={`scorecardPlayer ${p.handle === 'vos' ? 'you' : ''}`}>
                      <span className="pr"><Icon.Users size={11}/></span>
                      <Avatar user={p} size="sm" />
                      <span className="nm">{p.name}{p.handle === 'vos' ? ' (vos)' : ''}</span>
                      <span className="sc" style={{ fontSize: '0.8rem', color: youWin ? 'var(--green)' : 'var(--text-muted)' }}>{youWin ? '✦' : '○'}</span>
                    </div>
                  ))}
                </div>
              )}

              {notes.trim() && <div className="scorecardNotes">"{notes}"</div>}
            </div>
          </div>
          <div className="previewHint">Se guarda en tu almanaque al confirmar</div>
        </aside>
      </div>
    </div>
  );
}

window.CreatePlayScreen = CreatePlayScreen;
