/* global React, MesaIcon, MesaTile, MESAS, mesasDateParts, mesasCountdown */
const { useState, useMemo } = React;

// ─── Round-table top-down view ─────────────────────────────────
function TableTopDown({ mesa }) {
  const totalSeats = mesa.maxPlayers;
  // Build seat list: [host, ...players, ...empty]
  const seats = [];
  seats.push({ kind: 'host', user: mesa.host });
  mesa.players.forEach(p => seats.push({ kind: p.isYou ? 'you' : 'player', user: p }));
  while (seats.length < totalSeats) seats.push({ kind: 'empty', user: null });

  // Position seats around an ellipse (slightly wider than tall to feel like a table)
  // cx 50, cy 50, rx 36, ry 32 — seats placed at radii rx+10, ry+10
  const cx = 50, cy = 50, rx = 32, ry = 30;
  const seatOffset = 12;
  const seatRadius = 7;

  // Start at top (angle = -π/2)
  const positions = seats.map((s, i) => {
    const angle = (i / totalSeats) * 2 * Math.PI - Math.PI / 2;
    const x = cx + (rx + seatOffset) * Math.cos(angle);
    const y = cy + (ry + seatOffset) * Math.sin(angle);
    // Label offset further out
    const lx = cx + (rx + seatOffset + 6) * Math.cos(angle);
    const ly = cy + (ry + seatOffset + 6) * Math.sin(angle);
    return { ...s, x, y, lx, ly, angle };
  });

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="feltGrad" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%"  stopColor="#1d3a2a"/>
          <stop offset="60%" stopColor="#162a1f"/>
          <stop offset="100%" stopColor="#0e1a14"/>
        </radialGradient>
        <pattern id="feltDots" patternUnits="userSpaceOnUse" width="2.5" height="2.5">
          <circle cx="1.25" cy="1.25" r="0.3" fill="rgba(255,255,255,0.05)"/>
        </pattern>
        <filter id="seatShadow">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.5" floodColor="#000" floodOpacity="0.5"/>
        </filter>
      </defs>

      {/* Outer table wood ring */}
      <ellipse cx={cx} cy={cy} rx={rx + 4} ry={ry + 3} fill="#2a1f15" stroke="#1a1108" strokeWidth="0.4"/>
      {/* Felt surface */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#feltGrad)" stroke="rgba(24,136,239,0.2)" strokeWidth="0.3"/>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#feltDots)"/>
      {/* Inner decoration ring */}
      <ellipse cx={cx} cy={cy} rx={rx - 6} ry={ry - 5} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.2" strokeDasharray="1.5 1.5"/>

      {/* Center game tile (mini mosaic) */}
      <g transform={`translate(${cx} ${cy})`}>
        <rect x={-9} y={-6} width={18} height={12} rx={1.5} fill="rgba(10,13,21,0.5)" stroke="rgba(24,136,239,0.25)" strokeWidth="0.25"/>
        <text textAnchor="middle" dominantBaseline="central" fontFamily="Poppins, sans-serif" fontSize="2.4" fontWeight="700" fill="rgba(255,255,255,0.4)" style={{ letterSpacing: '-0.04em' }}>
          {mesa.game.length > 16 ? mesa.game.slice(0, 14) + '…' : mesa.game}
        </text>
        <text x={0} y={4.5} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="1.4" fill="rgba(24,136,239,0.6)" style={{ letterSpacing: '0.12em' }}>◆ MESA</text>
      </g>

      {/* Seats */}
      {positions.map((p, i) => {
        const isHost = p.kind === 'host';
        const isYou = p.kind === 'you';
        const isEmpty = p.kind === 'empty';
        const color = isEmpty
          ? 'transparent'
          : (p.user.color || 'var(--accent)');
        const label = isEmpty ? '?' : (p.user.initial || '?');
        const stroke = isEmpty ? 'rgba(255,255,255,0.25)' : 'rgba(10,13,21,0.9)';
        const strokeDasharray = isEmpty ? '0.8 0.8' : '0';

        return (
          <g key={i} className="tableSeat">
            {/* Connection line to table edge */}
            <line x1={p.x} y1={p.y}
                  x2={cx + rx * Math.cos(p.angle)} y2={cy + ry * Math.sin(p.angle)}
                  stroke={isEmpty ? 'rgba(255,255,255,0.1)' : (p.user?.color || 'rgba(24,136,239,0.3)')}
                  strokeWidth="0.4"
                  strokeDasharray={isEmpty ? '0.4 0.4' : '0'}
                  opacity={isEmpty ? 0.5 : 0.7}/>
            {/* Glow halo for "you" */}
            {isYou && (
              <circle cx={p.x} cy={p.y} r={seatRadius + 1.5} fill="none" stroke="var(--green)" strokeWidth="0.8" strokeDasharray="1 1" opacity="0.7">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite"/>
              </circle>
            )}
            {/* Seat circle */}
            <circle cx={p.x} cy={p.y} r={seatRadius} fill={color} stroke={stroke} strokeWidth="0.5" strokeDasharray={strokeDasharray} filter={!isEmpty ? 'url(#seatShadow)' : undefined}/>
            {/* Initial */}
            <text className="tableSeatLabel" x={p.x} y={p.y} style={{ fontSize: 5.5, opacity: isEmpty ? 0.4 : 1 }}>{label}</text>
            {/* Host crown indicator */}
            {isHost && (
              <text x={p.x} y={p.y - seatRadius - 2.5} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="2.4" fill="var(--orange)" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>♦ HOST</text>
            )}
            {/* Name label */}
            <text className={`tableSeatName ${isHost ? 'host' : isYou ? 'you' : isEmpty ? 'empty' : ''}`} x={p.lx} y={p.ly} style={{ fontSize: 2.6 }}>
              {isEmpty ? 'lugar libre' : (p.user.handle ? '@' + p.user.handle : p.user.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Detail screen ───────────────────────────────────────────
function MesasDetailScreen({ mesaId, onBack, onOpenCreate }) {
  const mesa = useMemo(() => MESAS.find(m => m._id === mesaId) || MESAS[0], [mesaId]);
  const [chatText, setChatText] = useState('');
  const [pending, setPending] = useState(mesa.pending);

  const d = mesasDateParts(mesa.date);
  const cd = mesasCountdown(mesa.date);
  const totalSeats = mesa.maxPlayers;
  const filled = mesa.players.length + 1;
  const open = totalSeats - filled;
  const isFull = open <= 0;
  const fillPct = (filled / totalSeats) * 100;

  const isHost = mesa.userState === 'hosting';
  const isJoined = mesa.userState === 'joined';
  const isPending = mesa.userState === 'pending';

  return (
    <div className="page">
      <button className="detailBack" onClick={onBack}>
        <MesaIcon.ArrowLeft size={11} /> Volver al listado
      </button>

      <div className="mesaDetailLayout">
        <div className="mesaDetailMain">
          {/* Banner */}
          <div className="detailBanner">
            <svg className="bg" viewBox="0 0 100 67" preserveAspectRatio="xMidYMid slice">
              <foreignObject width="100" height="67">
                <div style={{ width: '100%', height: '100%' }}>
                  <MesaTile seed={mesa.gameSeed} game={mesa.game} />
                </div>
              </foreignObject>
            </svg>
            <div className="detailBannerOverlay" />
            <div className="detailBannerContent">
              <div className="detailBannerLeft">
                <span className="detailBannerEyebrow">
                  ◆ {mesa.privacy === 'private' ? 'Mesa privada' : 'Mesa abierta'} · {totalSeats} jugadores
                </span>
                <h1 className="detailBannerTitle">{mesa.game}</h1>
                {mesa.tags?.length > 0 && (
                  <div className="detailBannerTags">
                    {mesa.tags.map(t => <span key={t} className="detailBannerTag">{t}</span>)}
                  </div>
                )}
              </div>
              <div className="detailBannerRight">
                <span className="detailBannerDate">{d.weekday} {d.day} {d.month} · {d.time}</span>
              </div>
            </div>
          </div>

          {/* Meta strip */}
          <div className="detailMetaRow">
            <div className="cell">
              <span className="label">Cuándo</span>
              <span className="value">{d.weekdayLong} {d.day} {d.monthLong}</span>
              <span className="value accent">{d.time} hs</span>
            </div>
            <div className="cell">
              <span className="label">Dónde</span>
              <span className="value">{mesa.location || 'Por confirmar'}</span>
            </div>
            <div className="cell">
              <span className="label">Jugadores</span>
              <span className="value">{filled} de {totalSeats}</span>
              <span className="value accent">{isFull ? 'mesa llena' : `${open} lugar${open===1?'':'es'} libre${open===1?'':'s'}`}</span>
            </div>
            <div className="cell">
              <span className="label">Privacidad</span>
              <span className="value">{mesa.privacy === 'private' ? 'Privada' : 'Pública'}</span>
              <span className="value accent">{mesa.privacy === 'private' ? 'requiere aprobación' : 'unirse al toque'}</span>
            </div>
          </div>

          {/* Description */}
          {mesa.description && (
            <section className="detailSec">
              <div className="detailSecHead">
                <span className="lbl">◆ Sobre la partida</span>
                <span className="rule" />
              </div>
              <p className="detailText">{mesa.description}</p>
            </section>
          )}

          {/* Reglas */}
          {mesa.rules && (
            <section className="detailSec">
              <div className="detailSecHead">
                <span className="lbl">◆ Reglas de la mesa</span>
                <span className="rule" />
              </div>
              <p className="detailText">{mesa.rules}</p>
            </section>
          )}

          {/* Table map */}
          <section className="detailSec">
            <div className="detailSecHead">
              <span className="lbl">◆ Alrededor de la mesa</span>
              <span className="rule" />
              <span className="count">{filled} de {totalSeats}</span>
            </div>
            <div className="tableMapWrap">
              <div className="tableMapLegend">
                <span className="it"><span className="dot host"></span> Host</span>
                <span className="it"><span className="dot"></span> Jugador</span>
                <span className="it"><span className="dot you"></span> Vos</span>
                <span className="it"><span className="dot empty"></span> Libre</span>
              </div>
              <div className="tableMap">
                <TableTopDown mesa={mesa} />
              </div>

              {/* List version below */}
              <div className="playersList">
                <div className="playerRow host">
                  <div className="playerRowAv" style={{ background: mesa.host.color }}>{mesa.host.initial}</div>
                  <div className="playerRowInfo">
                    <span className="playerRowName">{mesa.host.name}</span>
                    <span className="playerRowHandle">@{mesa.host.handle} · ⭐ {mesa.host.rating?.toFixed(1)} · {mesa.host.games} partidas</span>
                  </div>
                  <span className="playerRowRole host">Host</span>
                </div>
                {mesa.players.map((p, i) => (
                  <div key={i} className={`playerRow ${p.isYou ? 'you' : ''}`}>
                    <div className="playerRowAv" style={{ background: p.color }}>{p.initial}</div>
                    <div className="playerRowInfo">
                      <span className="playerRowName">{p.name}</span>
                      <span className="playerRowHandle">{p.handle ? '@' + p.handle : '—'}</span>
                    </div>
                    {p.isYou ? <span className="playerRowRole you">Vos</span> : <span className="playerRowRole">Jugador</span>}
                  </div>
                ))}
                {Array.from({ length: open }).map((_, i) => (
                  <div key={i} className="emptySeatRow">
                    <span className="seatIcon"><MesaIcon.Chair size={18}/></span>
                    <span className="emptySeatLabel">Lugar libre · esperando jugador</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pending requests (host-only) */}
          {isHost && pending.length > 0 && (
            <section className="detailSec">
              <div className="detailSecHead">
                <span className="lbl" style={{ color: 'var(--purple)' }}>◆ Solicitudes pendientes</span>
                <span className="rule" />
                <span className="count" style={{ color: 'var(--purple)' }}>{pending.length} esperando</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map((p, i) => (
                  <div key={i} className="pendingReq">
                    <div className="playerRowAv" style={{ background: p.color }}>{p.initial}</div>
                    <div className="pendingReqBody">
                      <span className="playerRowName">{p.name}</span>
                      <span className="playerRowHandle">@{p.handle}</span>
                      <p className={`pendingReqMsg ${!p.message ? 'empty' : ''}`}>
                        {p.message ? `"${p.message}"` : 'Sin mensaje adjunto'}
                      </p>
                    </div>
                    <div className="pendingReqActions">
                      <button className="pendingBtnReject" onClick={() => setPending(pending.filter((_,j) => j !== i))}>
                        <MesaIcon.X size={11}/> Rechazar
                      </button>
                      <button className="pendingBtnAccept" onClick={() => setPending(pending.filter((_,j) => j !== i))}>
                        <MesaIcon.Check size={11}/> Aceptar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Chat */}
          {(isHost || isJoined) && (
            <section className="detailSec">
              <div className="detailSecHead">
                <span className="lbl">◆ Chat de la mesa</span>
                <span className="rule" />
                <span className="count">solo jugadores</span>
              </div>
              <div className="chatPreview">
                {mesa.chat.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                    Sin mensajes todavía · empezá la conversación
                  </p>
                ) : mesa.chat.map((msg, i) => (
                  <div key={i} className={`chatRow ${msg.from.isYou ? 'own' : ''}`}>
                    <div className="chatAv" style={{ background: msg.from.color }}>{msg.from.initial}</div>
                    <div className="chatBubble">
                      <span className="chatAuthor">{msg.from.name}</span>
                      <span className="chatText">{msg.text}</span>
                      <span className="chatTime">{msg.time}</span>
                    </div>
                  </div>
                ))}
                <div className="chatForm">
                  <input
                    className="chatInput"
                    placeholder="Escribí un mensaje…"
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                  />
                  <button className="chatSubmit" onClick={() => setChatText('')}>
                    <MesaIcon.Send size={13}/>
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ─── Sticky stub ─── */}
        <aside>
          <div className="mesaStub">
            <div className="mesaStubTop">
              <div className="mesaStubLabel">◆ Esta mesa</div>
              <div className="mesaStubDateRow">
                <span className="mesaStubDay">{d.day}</span>
                <div className="mesaStubMonth">
                  <span className="m">{d.monthLong}</span>
                  <span className="w">{d.weekdayLong} · {d.year}</span>
                </div>
              </div>
              <div className="mesaStubTime">⏱ {d.time} hs</div>
              <div className={`mesaStubCountdown ${cd.tone === 'urgent' ? 'urgent' : ''}`}>{cd.text}</div>
            </div>

            <div className="mesaStubTear"><div className="mesaStubDashes" /></div>

            <div className="mesaStubBottom">
              <div className="mesaStubRow">
                <span className="mesaStubRowLabel">Juego</span>
                <span className="mesaStubRowValue">{mesa.game.length > 16 ? mesa.game.slice(0,14) + '…' : mesa.game}</span>
              </div>
              <div className="mesaStubRow">
                <span className="mesaStubRowLabel">Lugar</span>
                <span className="mesaStubRowValue" style={{ fontSize: 12 }}>{(mesa.location || '—').split(' · ')[0]}</span>
              </div>
              <div className="mesaStubRow">
                <span className="mesaStubRowLabel">Jugadores</span>
                <span className={`mesaStubRowValue ${isFull ? 'full' : ''}`}>{filled}/{totalSeats}</span>
              </div>
              <div className="seatTrack mesaStubSeats">
                <div className={`seatFill ${isFull ? 'full' : ''}`} style={{ width: `${fillPct}%` }} />
              </div>
              <div className="mesaStubRow">
                <span className="mesaStubRowLabel">Acceso</span>
                <span className="mesaStubRowValue" style={{ fontSize: 12, color: mesa.privacy === 'private' ? 'var(--purple)' : 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {mesa.privacy === 'private' ? '✓ Privada' : '◆ Pública'}
                </span>
              </div>

              <div className="mesaStubCtaBlock">
                {isHost ? (
                  <>
                    <div className="mesaStubCtaState hosting">
                      <MesaIcon.Crown size={18}/>
                      <span className="title">Sos el host</span>
                      <span className="sub">{pending.length > 0 ? `${pending.length} solicitud${pending.length === 1 ? '' : 'es'} para revisar` : 'Mesa al día'}</span>
                    </div>
                    <div className="mesaStubHostActions">
                      <div className="mesaStubHostActionsTitle">◆ Acciones de host</div>
                      <div className="mesaStubHostActionsRow">
                        <button className="mesaStubHostBtn" onClick={onOpenCreate}><MesaIcon.Edit size={11}/>&nbsp;Editar</button>
                        <button className="mesaStubHostBtn"><MesaIcon.X size={11}/>&nbsp;Cancelar</button>
                      </div>
                    </div>
                  </>
                ) : isJoined ? (
                  <>
                    <div className="mesaStubCtaState joined">
                      <MesaIcon.Check size={18}/>
                      <span className="title">Estás dentro</span>
                      <span className="sub">Tu lugar está reservado</span>
                    </div>
                    <button className="mesaStubGhost">Abandonar mesa</button>
                  </>
                ) : isPending ? (
                  <>
                    <div className="mesaStubCtaState pending">
                      <MesaIcon.Clock size={18}/>
                      <span className="title">Solicitud enviada</span>
                      <span className="sub">El host está revisando</span>
                    </div>
                    <button className="mesaStubGhost">Cancelar solicitud</button>
                  </>
                ) : isFull ? (
                  <button className="mesaStubGhost" disabled>Mesa llena</button>
                ) : (
                  <button className="mesaStubCta">
                    {mesa.privacy === 'private' ? 'Solicitar lugar' : 'Unirme a la mesa'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.MesasDetailScreen = MesasDetailScreen;
