// Direction B — "Token & Track"
// More playful: meeple-style avatars, progress tracks, layered depth.
// Same dark navy palette, geometric headers, more game-board UI language.

const tkTheme = {
  bg: '#080b13',
  bgCard: '#121826',
  bgElev: '#1a2233',
  bgInset: '#0d121d',
  border: '#1f2a40',
  borderHi: '#2a3a58',
  text: '#ffffff',
  textSub: '#9aa6c0',
  textMute: '#525c75',
  accent: '#1888ef',
  accentLight: '#00aeff',
  accentDim: 'rgba(24,136,239,0.18)',
  green: '#00d984',
  red: '#f31d77',
  amber: '#ffbf3d',
  purple: '#a78bfa',
};

// Meeple SVG token avatar
function Meeple({ char, size = 36, color = tkTheme.accent }) {
  return (
    <div style={{
      width: size, height: size, position: 'relative', flexShrink: 0,
    }}>
      <svg viewBox="0 0 40 40" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <path d="M20 4c-3 0-5 2-5 5 0 2 1 3 2 4-3 1-7 3-7 7v3h4v13h12V23h4v-3c0-4-4-6-7-7 1-1 2-2 2-4 0-3-2-5-5-5z" fill={color}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: 'Manrope, sans-serif', fontWeight: 800,
        fontSize: size * 0.32, paddingTop: size * 0.05, textShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }}>{char}</div>
    </div>
  );
}

function SeatTrack({ filled, total }) {
  const pct = (filled / total) * 100;
  return (
    <div style={{
      position: 'relative', height: 8, background: tkTheme.bgInset,
      borderRadius: 999, overflow: 'hidden', border: `1px solid ${tkTheme.border}`,
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`,
        background: `linear-gradient(90deg, ${tkTheme.accent}, ${tkTheme.accentLight})`,
        boxShadow: `0 0 8px ${tkTheme.accentDim}`,
      }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {Array.from({ length: total - 1 }).map((_, i) => (
          <span key={i} style={{
            position: 'absolute', left: `${((i+1)/total) * 100}%`, top: 0, bottom: 0,
            width: 1, background: 'rgba(255,255,255,0.08)',
          }} />
        ))}
      </div>
    </div>
  );
}

function TKStatusChip({ seats }) {
  const full = seats === 0;
  const color = full ? tkTheme.red : tkTheme.green;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, color,
      fontFamily: 'Manrope, sans-serif', letterSpacing: '0.02em',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color, boxShadow: `0 0 8px ${color}` }} />
      {full ? 'Mesa completa' : `${seats} lugar${seats !== 1 ? 'es' : ''}`}
    </span>
  );
}

function TKTableCard({ table }) {
  return (
    <div style={{
      background: tkTheme.bgCard,
      border: `1px solid ${table.hosted ? tkTheme.accent : tkTheme.border}`,
      borderRadius: 14, overflow: 'hidden',
      fontFamily: 'Inter, sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.04) inset',
      position: 'relative',
      transition: 'transform 0.2s',
    }}>
      {/* tile banner */}
      <div style={{ position: 'relative', height: 92, overflow: 'hidden' }}>
        <GameTile game={table.game} seed={table.seed} size={'100%'} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(18,24,38,0.7) 70%, rgba(18,24,38,1) 100%)',
        }} />
        <div style={{
          position: 'absolute', top: 10, left: 12, right: 12,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)',
            color: '#fff', padding: '4px 9px', borderRadius: 6,
            fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6,
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <span style={{ color: tkTheme.accentLight }}>●</span>
            {table.weekday} · {table.dateShort.split(' ')[0]} {table.dateShort.split(' ')[1]} · {table.time}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {table.hosted && (
              <span style={{
                background: tkTheme.accent, color: '#fff',
                padding: '4px 8px', borderRadius: 6,
                fontFamily: 'Manrope, sans-serif', fontSize: 9, fontWeight: 800,
                letterSpacing: '0.08em',
              }}>HOST</span>
            )}
            {table.joined && (
              <span style={{
                background: 'rgba(0,217,132,0.18)', color: tkTheme.green,
                padding: '4px 8px', borderRadius: 6, border: `1px solid ${tkTheme.green}`,
                fontFamily: 'Manrope, sans-serif', fontSize: 9, fontWeight: 800,
                letterSpacing: '0.08em',
              }}>UNIDO</span>
            )}
            {table.privacy === 'private' && (
              <span style={{
                background: 'rgba(0,0,0,0.45)', color: '#fff',
                width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
              }}><Icon.Lock size={11} /></span>
            )}
          </div>
        </div>
      </div>

      {/* body */}
      <div style={{ padding: 16 }}>
        <h3 style={{
          fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700,
          letterSpacing: '-0.025em', color: tkTheme.text, margin: 0, lineHeight: 1.1,
        }}>{table.game}</h3>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {table.tags.map(t => (
            <span key={t} style={{
              fontSize: 10, fontWeight: 600, color: tkTheme.textSub,
              padding: '2px 7px', borderRadius: 4,
              background: tkTheme.bgInset, border: `1px solid ${tkTheme.border}`,
            }}>{t}</span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: tkTheme.textSub, fontSize: 12 }}>
          <Icon.Pin size={13} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.location}</span>
        </div>

        {/* seat track */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: tkTheme.textMute, letterSpacing: '0.1em', fontFamily: 'Manrope, sans-serif' }}>LUGARES</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: tkTheme.text, fontFamily: 'Manrope, sans-serif' }}>{table.players + 1}/{table.maxPlayers + 1}</span>
          </div>
          <SeatTrack filled={table.players + 1} total={table.maxPlayers + 1} />
        </div>

        {/* host + cta */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tkTheme.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Meeple char={table.hostAvatar} size={28} color={tkTheme.accent} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: tkTheme.text }}>{table.host}</span>
              <TKStatusChip seats={table.seats} />
            </div>
          </div>
          {table.joined ? (
            <button style={{
              background: tkTheme.bgElev, border: `1px solid ${tkTheme.borderHi}`, color: tkTheme.text,
              padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12,
              fontFamily: 'Manrope, sans-serif',
            }}>Abrir mesa</button>
          ) : table.hosted ? (
            <button style={{
              background: tkTheme.bgElev, border: `1px solid ${tkTheme.accent}`, color: tkTheme.accentLight,
              padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12,
              fontFamily: 'Manrope, sans-serif',
            }}>Administrar</button>
          ) : table.seats === 0 ? (
            <button disabled style={{
              background: tkTheme.bgInset, border: `1px solid ${tkTheme.border}`, color: tkTheme.textMute,
              padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12,
              fontFamily: 'Manrope, sans-serif', cursor: 'not-allowed',
            }}>Llena</button>
          ) : (
            <button style={{
              background: tkTheme.accent, border: 'none', color: '#fff',
              padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12,
              fontFamily: 'Manrope, sans-serif', letterSpacing: '0.02em',
              boxShadow: `0 4px 14px ${tkTheme.accentDim}`,
            }}>{table.privacy === 'private' ? 'Solicitar' : 'Unirme'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function TKSidebar({ active = 'mesas' }) {
  const items = [
    { id: 'mesas', icon: Icon.Dice, label: 'Mesas' },
    { id: 'feed', icon: Icon.Users, label: 'Mi feed' },
    { id: 'jugadores', icon: Icon.Crown, label: 'Jugadores' },
    { id: 'avisos', icon: Icon.Bell, label: 'Avisos', badge: 3 },
  ];
  return (
    <div style={{
      width: 220, background: tkTheme.bgCard, borderRight: `1px solid ${tkTheme.border}`,
      display: 'flex', flexDirection: 'column', padding: '20px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 24px' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: tkTheme.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, color: '#fff', fontSize: 18,
          boxShadow: `0 4px 16px ${tkTheme.accentDim}`,
        }}>T</div>
        <div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>TurnoCero</div>
          <div style={{ fontSize: 9, color: tkTheme.textMute, letterSpacing: '0.1em', fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>BOARD GAME MEETUPS</div>
        </div>
      </div>

      <button style={{
        background: tkTheme.accent, color: '#fff', border: 'none',
        padding: '11px 14px', borderRadius: 9, fontWeight: 700, fontSize: 13,
        fontFamily: 'Manrope, sans-serif', letterSpacing: '0.02em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: `0 6px 18px ${tkTheme.accentDim}`,
        marginBottom: 20,
      }}><Icon.Plus size={15} /> Crear mesa</button>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(it => {
          const isActive = it.id === active;
          return (
            <a key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: isActive ? tkTheme.bgElev : 'transparent',
              color: isActive ? tkTheme.text : tkTheme.textSub,
              fontSize: 13, fontWeight: 600,
              borderLeft: `2px solid ${isActive ? tkTheme.accent : 'transparent'}`,
              marginLeft: -14, paddingLeft: 14,
            }}>
              <it.icon size={16} /><span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  background: tkTheme.red, color: '#fff',
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                  fontFamily: 'Manrope, sans-serif',
                }}>{it.badge}</span>
              )}
            </a>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* upcoming widget */}
      <div style={{
        background: tkTheme.bgInset, border: `1px solid ${tkTheme.border}`,
        borderRadius: 10, padding: 12, marginBottom: 12,
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: tkTheme.textMute, letterSpacing: '0.12em', fontFamily: 'Manrope, sans-serif', marginBottom: 8 }}>
          PRÓXIMA PARTIDA
        </div>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>Catan</div>
        <div style={{ fontSize: 11, color: tkTheme.textSub, marginTop: 2 }}>Sáb · 21:00 · 2d</div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        borderRadius: 9, background: tkTheme.bgElev, border: `1px solid ${tkTheme.border}`,
      }}>
        <Meeple char="Y" size={28} color={tkTheme.accent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: tkTheme.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>tu_nombre</div>
          <div style={{ fontSize: 10, color: tkTheme.textMute }}>14 partidas · 4.8 ★</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Dashboard Desktop
// ============================================================
function TKDashboardDesktop() {
  return (
    <div style={{
      width: 1280, height: 900, background: tkTheme.bg,
      color: tkTheme.text, fontFamily: 'Inter, sans-serif', overflow: 'hidden',
      display: 'flex',
    }}>
      <TKSidebar active="mesas" />
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 36px' }}>
        {/* hero */}
        <div style={{
          background: `linear-gradient(135deg, ${tkTheme.bgCard}, ${tkTheme.bgInset})`,
          border: `1px solid ${tkTheme.border}`, borderRadius: 14,
          padding: '24px 28px', marginBottom: 22,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', right: -40, top: -40, width: 220, height: 220,
            opacity: 0.5,
          }}>
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <circle cx="50" cy="50" r="40" fill="none" stroke={tkTheme.accent} strokeWidth="0.6" opacity="0.3"/>
              <circle cx="50" cy="50" r="30" fill="none" stroke={tkTheme.accent} strokeWidth="0.6" opacity="0.3"/>
              <circle cx="50" cy="50" r="20" fill="none" stroke={tkTheme.accent} strokeWidth="0.6" opacity="0.5"/>
              <polygon points="50,10 60,40 90,40 65,60 75,90 50,72 25,90 35,60 10,40 40,40" fill={tkTheme.accentDim}/>
            </svg>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: tkTheme.accentLight, letterSpacing: '0.15em', fontFamily: 'Manrope, sans-serif', marginBottom: 6 }}>
              ◆ 12 MESAS · 6 EN TU ZONA
            </div>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 42, fontWeight: 700, letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>
              Tirá los dados.
            </h1>
            <p style={{ color: tkTheme.textSub, marginTop: 8, fontSize: 14, maxWidth: 480 }}>
              Sumate a una mesa o convocá la tuya. Encontrá jugadores cerca y empezá la próxima partida.
            </p>
          </div>
        </div>

        {/* controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            {[
              { label: 'Todas', count: 12, active: true },
              { label: 'Cerca tuyo', count: 6 },
              { label: 'Esta semana', count: 4 },
              { label: 'Mis mesas', count: 2 },
            ].map(t => (
              <button key={t.label} style={{
                background: 'transparent', border: 'none', padding: '6px 0',
                color: t.active ? tkTheme.text : tkTheme.textSub,
                fontSize: 13, fontWeight: 600,
                fontFamily: 'Manrope, sans-serif',
                borderBottom: `2px solid ${t.active ? tkTheme.accent : 'transparent'}`,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {t.label}
                <span style={{ fontSize: 11, color: tkTheme.textMute, fontWeight: 600 }}>{t.count}</span>
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: tkTheme.textMute }}>
              <Icon.Search size={14} />
            </span>
            <input placeholder="Buscar juego, host…" style={{
              background: tkTheme.bgCard, border: `1px solid ${tkTheme.border}`,
              borderRadius: 9, padding: '9px 12px 9px 36px', fontSize: 13,
              color: tkTheme.text, width: 240, outline: 'none', fontFamily: 'Inter, sans-serif',
            }} />
          </div>
        </div>

        {/* grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {window.MOCK_TABLES.slice(0, 6).map(t => <TKTableCard key={t.id} table={t} />)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Dashboard Mobile
// ============================================================
function TKDashboardMobile() {
  return (
    <PhoneFrame theme={tkTheme.bg}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: tkTheme.text, fontFamily: 'Inter, sans-serif' }}>
        {/* header */}
        <div style={{ padding: '12px 18px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800, color: tkTheme.accentLight, letterSpacing: '0.15em' }}>● 12 MESAS</div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 26, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, marginTop: 4 }}>Tirá los dados</div>
          </div>
          <Meeple char="Y" size={36} color={tkTheme.accent} />
        </div>

        {/* tabs */}
        <div style={{ padding: '14px 18px 8px', display: 'flex', gap: 18, borderBottom: `1px solid ${tkTheme.border}` }}>
          {[
            { label: 'Todas', count: 12, active: true },
            { label: 'Cerca', count: 6 },
            { label: 'Mías', count: 2 },
          ].map(t => (
            <button key={t.label} style={{
              background: 'transparent', border: 'none', padding: '6px 0 10px',
              color: t.active ? tkTheme.text : tkTheme.textSub,
              fontSize: 13, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
              borderBottom: `2px solid ${t.active ? tkTheme.accent : 'transparent'}`,
              marginBottom: -1,
              display: 'inline-flex', gap: 5,
            }}>{t.label}<span style={{ color: tkTheme.textMute, fontWeight: 500 }}>{t.count}</span></button>
          ))}
        </div>

        {/* cards */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {window.MOCK_TABLES.slice(0, 4).map(t => <TKTableCard key={t.id} table={t} />)}
        </div>

        {/* FAB */}
        <button style={{
          position: 'absolute', bottom: 96, right: 20,
          height: 50, padding: '0 18px 0 14px',
          borderRadius: 14, background: tkTheme.accent, color: '#fff', border: 'none',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13,
          letterSpacing: '0.02em',
          boxShadow: `0 8px 24px ${tkTheme.accentDim}, 0 0 0 4px rgba(24,136,239,0.08)`,
        }}><Icon.Plus size={18} /> Crear mesa</button>

        {/* bottom nav */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(8,11,19,0.92)', backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${tkTheme.border}`,
          padding: '10px 18px 22px', display: 'flex', justifyContent: 'space-around',
        }}>
          {[
            { icon: Icon.Dice, label: 'Mesas', active: true },
            { icon: Icon.Users, label: 'Feed' },
            { icon: Icon.Bell, label: 'Avisos', badge: 3 },
            { icon: Icon.Crown, label: 'Perfil' },
          ].map((n, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: n.active ? tkTheme.accentLight : tkTheme.textMute, position: 'relative',
              fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            }}>
              <n.icon size={20} />
              <span>{n.label.toUpperCase()}</span>
              {n.badge && (
                <span style={{
                  position: 'absolute', top: -3, right: 8,
                  background: tkTheme.red, width: 14, height: 14, borderRadius: 999,
                  fontSize: 9, fontWeight: 700, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1.5px solid ${tkTheme.bg}`,
                }}>{n.badge}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

// ============================================================
// Table Detail Desktop
// ============================================================
function TKTableDetailDesktop() {
  const t = window.MOCK_TABLES[1];
  return (
    <div style={{
      width: 1280, height: 900, background: tkTheme.bg,
      color: tkTheme.text, fontFamily: 'Inter, sans-serif', overflow: 'hidden',
      display: 'flex',
    }}>
      <TKSidebar active="mesas" />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Hero banner with game tile */}
          <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
            <GameTile game={t.game} seed={t.seed} size={'100%'} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(8,11,19,0.4) 0%, rgba(8,11,19,0.7) 60%, ' + tkTheme.bg + ' 100%)',
            }} />
            <div style={{ position: 'absolute', top: 18, left: 32 }}>
              <a style={{ color: tkTheme.textSub, fontSize: 12, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.06em', fontWeight: 600 }}>← VOLVER</a>
            </div>
            <div style={{ position: 'absolute', bottom: 22, left: 32, right: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <TKStatusChip seats={t.seats} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    fontFamily: 'Manrope, sans-serif',
                    background: 'rgba(0,217,132,0.18)', color: tkTheme.green,
                    padding: '3px 8px', borderRadius: 5, border: `1px solid ${tkTheme.green}`,
                  }}>TE UNISTE</span>
                </div>
                <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 48, fontWeight: 700, letterSpacing: '-0.035em', margin: 0, lineHeight: 1 }}>{t.game}</h1>
                <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 13, color: tkTheme.textSub }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon.Calendar size={13} /> {t.weekday} {t.dateShort} · {t.time}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon.Pin size={13} /> {t.location}</span>
                </div>
              </div>
              <button style={{
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${tkTheme.borderHi}`, color: tkTheme.text,
                padding: '10px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13,
                fontFamily: 'Manrope, sans-serif', backdropFilter: 'blur(10px)',
              }}>↩ Abandonar mesa</button>
            </div>
          </div>

          <div style={{ padding: '24px 32px 32px' }}>
            {/* description + seat track */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
              <div>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800, color: tkTheme.textMute, letterSpacing: '0.14em', marginBottom: 8, marginTop: 0 }}>SOBRE LA PARTIDA</h3>
                <p style={{ fontSize: 14, color: tkTheme.textSub, lineHeight: 1.6, margin: 0 }}>{t.description}</p>
                <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
                  {t.tags.map(tg => (
                    <span key={tg} style={{
                      fontSize: 11, fontWeight: 600, color: tkTheme.textSub,
                      padding: '4px 9px', borderRadius: 5,
                      background: tkTheme.bgInset, border: `1px solid ${tkTheme.border}`,
                    }}>{tg}</span>
                  ))}
                </div>
              </div>
              <div style={{ background: tkTheme.bgCard, border: `1px solid ${tkTheme.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800, color: tkTheme.textMute, letterSpacing: '0.12em' }}>OCUPACIÓN</span>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14 }}>{t.players + 1}/{t.maxPlayers + 1}</span>
                </div>
                <SeatTrack filled={t.players + 1} total={t.maxPlayers + 1} />
                <p style={{ fontSize: 11, color: tkTheme.textMute, marginTop: 8, margin: '8px 0 0' }}>
                  {t.seats === 0 ? 'Mesa completa' : `${t.seats} lugar${t.seats !== 1 ? 'es' : ''} libre${t.seats !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* players */}
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800, color: tkTheme.textMute, letterSpacing: '0.14em', marginBottom: 12, marginTop: 0 }}>EN LA MESA</h3>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {window.MOCK_PLAYERS.map((p, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <Meeple char={p.avatar} size={56} color={i % 2 === 0 ? tkTheme.accent : tkTheme.purple} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</span>
                    {p.host && <span style={{ fontSize: 9, fontWeight: 800, color: tkTheme.accentLight, letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>HOST</span>}
                    {p.you && !p.host && <span style={{ fontSize: 9, fontWeight: 800, color: tkTheme.green, letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>VOS</span>}
                  </div>
                ))}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.5 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14, border: `1.5px dashed ${tkTheme.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: tkTheme.textMute,
                  }}><Icon.Plus size={20} /></div>
                  <span style={{ fontSize: 10, color: tkTheme.textMute, fontWeight: 600, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.06em' }}>VACÍO</span>
                </div>
              </div>
            </div>

            {/* photos */}
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800, color: tkTheme.textMute, letterSpacing: '0.14em', margin: 0 }}>FOTOS · 4/10</h3>
                <button style={{
                  background: 'transparent', border: `1px solid ${tkTheme.border}`, color: tkTheme.textSub,
                  padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, fontFamily: 'Manrope, sans-serif',
                  letterSpacing: '0.04em', display: 'inline-flex', gap: 6, alignItems: 'center',
                }}><Icon.Camera size={13} /> AGREGAR</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    aspectRatio: '1', borderRadius: 10, overflow: 'hidden',
                    background: `repeating-linear-gradient(45deg, ${tkTheme.bgElev} 0 8px, ${tkTheme.bgCard} 8px 16px)`,
                    border: `1px solid ${tkTheme.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: tkTheme.textMute, fontSize: 10, fontFamily: 'monospace',
                  }}>foto_{i+1}</div>
                ))}
                <div style={{
                  aspectRatio: '1', borderRadius: 10, border: `1.5px dashed ${tkTheme.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: tkTheme.textMute,
                }}><Icon.Plus size={20} /></div>
              </div>
            </div>

            {/* ratings */}
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800, color: tkTheme.textMute, letterSpacing: '0.14em', margin: 0 }}>VALORACIONES</h3>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: tkTheme.amber }}>
                  {[1,2,3,4,5].map(s => <Icon.Star key={s} size={13} filled={s <= 4} />)}
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: tkTheme.text, marginLeft: 4 }}>4.5</span>
                  <span style={{ color: tkTheme.textMute, fontSize: 12 }}>· 2 reseñas</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {window.MOCK_RATINGS.map((r, i) => (
                  <div key={i} style={{
                    background: tkTheme.bgCard, border: `1px solid ${tkTheme.border}`, borderRadius: 11, padding: 14,
                    display: 'flex', gap: 12,
                  }}>
                    <Meeple char={r.avatar} size={36} color={tkTheme.purple} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{r.user}</span>
                        <span style={{ display: 'inline-flex', gap: 1, color: tkTheme.amber }}>
                          {[1,2,3,4,5].map(s => <Icon.Star key={s} size={11} filled={s <= r.score} />)}
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, color: tkTheme.textSub, margin: '5px 0 0', lineHeight: 1.5 }}>{r.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* chat */}
        <div style={{ width: 360, borderLeft: `1px solid ${tkTheme.border}`, background: tkTheme.bgCard, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${tkTheme.border}` }}>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Sala de chat</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 10, color: tkTheme.textMute, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.06em' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: tkTheme.green }} />3 EN LÍNEA</span>
              <span>·</span>
              <span><Icon.Lock size={9} /> PRIVADO</span>
            </div>
          </div>
          <div style={{ flex: 1, padding: '14px 20px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ textAlign: 'center', fontSize: 10, color: tkTheme.textMute, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.12em' }}>HOY</div>
            {window.MOCK_MESSAGES.map(m => (
              <div key={m.id} style={{ display: 'flex', flexDirection: m.own ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                {!m.own && <Meeple char={m.avatar} size={26} color={tkTheme.accent} />}
                <div style={{ maxWidth: 220, display: 'flex', flexDirection: 'column', alignItems: m.own ? 'flex-end' : 'flex-start' }}>
                  {!m.own && <span style={{ fontSize: 10, color: tkTheme.textMute, marginBottom: 3, fontWeight: 600 }}>{m.author}</span>}
                  <div style={{
                    background: m.own ? tkTheme.accent : tkTheme.bgElev,
                    color: m.own ? '#fff' : tkTheme.text,
                    padding: '8px 12px', borderRadius: 14,
                    borderBottomRightRadius: m.own ? 4 : 14,
                    borderBottomLeftRadius: m.own ? 14 : 4,
                    fontSize: 13, lineHeight: 1.45,
                  }}>{m.text}</div>
                  <span style={{ fontSize: 9, color: tkTheme.textMute, marginTop: 2, fontFamily: 'Manrope, sans-serif' }}>{m.time}</span>
                </div>
              </div>
            ))}
          </div>
          {/* reactions */}
          <div style={{ padding: '8px 20px', borderTop: `1px solid ${tkTheme.border}`, display: 'flex', gap: 4, justifyContent: 'center' }}>
            {['❤️', '🎲', '🔥', '👍', '😄'].map((e, i) => (
              <button key={e} style={{
                background: i === 1 ? tkTheme.bgElev : 'transparent',
                border: `1px solid ${i === 1 ? tkTheme.accent : 'transparent'}`,
                padding: '4px 8px', borderRadius: 7, fontSize: 14,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>{e}<span style={{ fontSize: 10, color: tkTheme.textSub, fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>{i === 1 ? 3 : i === 0 ? 1 : ''}</span></button>
            ))}
          </div>
          <div style={{ padding: '12px 16px 16px', borderTop: `1px solid ${tkTheme.border}`, display: 'flex', gap: 8 }}>
            <input placeholder="Escribí un mensaje…" style={{
              flex: 1, background: tkTheme.bg, border: `1px solid ${tkTheme.border}`, borderRadius: 999,
              padding: '10px 16px', fontSize: 13, color: tkTheme.text, outline: 'none', fontFamily: 'Inter, sans-serif',
            }} />
            <button style={{
              width: 40, height: 40, borderRadius: 999, background: tkTheme.accent,
              color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${tkTheme.accentDim}`,
            }}><Icon.Send size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Table Detail Mobile
// ============================================================
function TKTableDetailMobile() {
  const t = window.MOCK_TABLES[1];
  return (
    <PhoneFrame theme={tkTheme.bg}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: tkTheme.text, fontFamily: 'Inter, sans-serif' }}>
        {/* hero with game tile bg */}
        <div style={{ position: 'relative', height: 170, overflow: 'hidden', flexShrink: 0 }}>
          <GameTile game={t.game} seed={t.seed} size={'100%'} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(8,11,19,0.3) 0%, rgba(8,11,19,0.7) 60%, ${tkTheme.bg} 100%)` }} />
          <div style={{ position: 'absolute', top: 10, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a style={{ color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11, letterSpacing: '0.06em', fontWeight: 700, background: 'rgba(0,0,0,0.4)', padding: '5px 10px', borderRadius: 999, backdropFilter: 'blur(10px)' }}>← VOLVER</a>
            <span style={{ color: '#fff', fontSize: 18, background: 'rgba(0,0,0,0.4)', width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>⋯</span>
          </div>
          <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <TKStatusChip seats={t.seats} />
            </div>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.035em', margin: 0, lineHeight: 1 }}>{t.game}</h1>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 100px' }}>
          {/* info chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tkTheme.textSub }}>
              <Icon.Calendar size={14} /><span style={{ color: tkTheme.text }}>{t.weekday} {t.dateShort} · {t.time}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tkTheme.textSub }}>
              <Icon.Pin size={14} /><span style={{ color: tkTheme.text }}>{t.location}</span>
            </div>
          </div>

          {/* seat track */}
          <div style={{ background: tkTheme.bgCard, border: `1px solid ${tkTheme.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 800, color: tkTheme.textMute, letterSpacing: '0.12em' }}>OCUPACIÓN</span>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 12 }}>{t.players + 1}/{t.maxPlayers + 1}</span>
            </div>
            <SeatTrack filled={t.players + 1} total={t.maxPlayers + 1} />
          </div>

          {/* description */}
          <p style={{ fontSize: 13, color: tkTheme.textSub, lineHeight: 1.55, margin: '0 0 14px' }}>{t.description}</p>
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, flexWrap: 'wrap' }}>
            {t.tags.map(tg => (
              <span key={tg} style={{
                fontSize: 10, fontWeight: 600, color: tkTheme.textSub,
                padding: '3px 8px', borderRadius: 5,
                background: tkTheme.bgInset, border: `1px solid ${tkTheme.border}`,
              }}>{tg}</span>
            ))}
          </div>

          {/* players */}
          <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 800, color: tkTheme.textMute, letterSpacing: '0.14em', marginBottom: 10, marginTop: 0 }}>EN LA MESA</h3>
          <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
            {window.MOCK_PLAYERS.map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Meeple char={p.avatar} size={44} color={i % 2 === 0 ? tkTheme.accent : tkTheme.purple} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>{p.name}</span>
                {p.host && <span style={{ fontSize: 8, fontWeight: 800, color: tkTheme.accentLight, letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>HOST</span>}
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.5 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11, border: `1.5px dashed ${tkTheme.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: tkTheme.textMute,
              }}><Icon.Plus size={16} /></div>
            </div>
          </div>

          {/* tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: `1px solid ${tkTheme.border}` }}>
            {['Chat', 'Fotos', 'Reseñas'].map((tab, i) => (
              <button key={tab} style={{
                flex: 1, padding: '10px 0', borderBottom: `2px solid ${i === 0 ? tkTheme.accent : 'transparent'}`,
                background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                color: i === 0 ? tkTheme.text : tkTheme.textSub,
                fontSize: 12, fontWeight: 700, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.04em',
              }}>{tab.toUpperCase()}</button>
            ))}
          </div>

          {/* messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {window.MOCK_MESSAGES.slice(0, 3).map(m => (
              <div key={m.id} style={{ display: 'flex', flexDirection: m.own ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                {!m.own && <Meeple char={m.avatar} size={24} color={tkTheme.accent} />}
                <div style={{ maxWidth: '75%' }}>
                  {!m.own && <span style={{ fontSize: 9, color: tkTheme.textMute, fontWeight: 600, marginLeft: 2, display: 'block', marginBottom: 2 }}>{m.author}</span>}
                  <div style={{
                    background: m.own ? tkTheme.accent : tkTheme.bgCard,
                    color: m.own ? '#fff' : tkTheme.text,
                    padding: '8px 12px', borderRadius: 14,
                    fontSize: 12.5, lineHeight: 1.4,
                    border: m.own ? 'none' : `1px solid ${tkTheme.border}`,
                  }}>{m.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* chat input */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '10px 14px 24px', background: 'rgba(8,11,19,0.92)',
          backdropFilter: 'blur(20px)', borderTop: `1px solid ${tkTheme.border}`,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <input placeholder="Mensaje…" style={{
            flex: 1, background: tkTheme.bgCard, border: `1px solid ${tkTheme.border}`,
            borderRadius: 999, padding: '10px 16px', fontSize: 13, color: tkTheme.text, outline: 'none',
          }} />
          <button style={{
            width: 40, height: 40, borderRadius: 999, background: tkTheme.accent,
            color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${tkTheme.accentDim}`,
          }}><Icon.Send size={15} /></button>
        </div>
      </div>
    </PhoneFrame>
  );
}

window.tkTheme = tkTheme;
window.Meeple = Meeple;
window.SeatTrack = SeatTrack;
window.TKStatusChip = TKStatusChip;
window.TKDashboardDesktop = TKDashboardDesktop;
window.TKDashboardMobile = TKDashboardMobile;
window.TKTableDetailDesktop = TKTableDetailDesktop;
window.TKTableDetailMobile = TKTableDetailMobile;
