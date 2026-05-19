// Direction A — "Cardstock"
// Tactile, dark-navy, with ticket-stub date components, perforated edges,
// cardboard texture, and embossed feel. Display: Space Grotesk.

const csTheme = {
  bg: '#0a0d15',
  bgCard: '#151c28',
  bgElev: '#1d2535',
  border: '#22304a',
  borderLight: 'rgba(255,255,255,0.06)',
  text: '#ffffff',
  textSub: '#a8b4cc',
  textMute: '#5a6480',
  accent: '#1888ef',
  accentLight: '#00aeff',
  accentDim: 'rgba(24,136,239,0.15)',
  green: '#00d984',
  red: '#f31d77',
  amber: '#ffbf3d',
};

// Paper grain noise overlay
const grain = `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.015) 0, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.012) 0, transparent 50%)`;

function CSDateStub({ weekday, dateShort, time, accent = csTheme.accent }) {
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch',
      borderRadius: 6, overflow: 'hidden', border: `1px solid ${csTheme.border}`,
      fontFamily: 'Manrope, sans-serif', minWidth: 64,
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
    }}>
      <div style={{
        background: accent, color: '#fff', padding: '4px 10px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textAlign: 'center',
      }}>{weekday}</div>
      <div style={{
        background: csTheme.bgElev, padding: '6px 10px 8px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: csTheme.text, letterSpacing: '-0.01em', lineHeight: 1 }}>{dateShort.split(' ')[0]}</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: csTheme.textMute, letterSpacing: '0.1em', marginTop: 2 }}>{dateShort.split(' ')[1]}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: csTheme.textSub, marginTop: 4, borderTop: `1px dashed ${csTheme.border}`, paddingTop: 4 }}>{time}</div>
      </div>
    </div>
  );
}

function CSSeatPips({ filled, total }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          width: 10, height: 10, borderRadius: 3,
          background: i < filled ? csTheme.accent : 'transparent',
          border: `1.5px solid ${i < filled ? csTheme.accent : csTheme.border}`,
          boxShadow: i < filled ? `0 0 8px ${csTheme.accentDim}` : 'none',
        }} />
      ))}
    </div>
  );
}

function CSStatusBadge({ seats, total }) {
  const full = seats === 0;
  const color = full ? csTheme.red : csTheme.green;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700,
      color, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '4px 8px', borderRadius: 999,
      border: `1px solid ${color}`, background: full ? 'rgba(243,29,119,0.08)' : 'rgba(0,217,132,0.08)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color, boxShadow: `0 0 6px ${color}` }} />
      {full ? 'Completa' : `${seats} libre${seats !== 1 ? 's' : ''}`}
    </span>
  );
}

function CSTableCard({ table, compact = false }) {
  return (
    <div style={{
      background: csTheme.bgCard,
      backgroundImage: grain,
      border: `1px solid ${table.hosted ? csTheme.accent : csTheme.border}`,
      borderRadius: 12,
      padding: compact ? 14 : 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
      fontFamily: 'Inter, sans-serif',
      boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 16px rgba(0,0,0,0.3)',
    }}>
      {table.hosted && (
        <span style={{
          position: 'absolute', top: -1, right: 14,
          background: csTheme.accent, color: '#fff',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
          padding: '3px 10px 4px', borderRadius: '0 0 4px 4px',
          fontFamily: 'Manrope, sans-serif',
        }}>SOS EL HOST</span>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <GameTile game={table.game} seed={table.seed} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: 19, fontWeight: 700, color: csTheme.text,
              letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0,
            }}>{table.game}</h3>
            {table.privacy === 'private' && (
              <span title="Privada" style={{ color: csTheme.textMute, flexShrink: 0 }}>
                <Icon.Lock size={13} />
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: csTheme.textSub, fontSize: 12 }}>
            <span style={{
              width: 18, height: 18, borderRadius: 999, background: csTheme.accent,
              color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
            }}>{table.hostAvatar}</span>
            <span style={{ color: csTheme.text, fontWeight: 600 }}>{table.host}</span>
            <span style={{ color: csTheme.textMute }}>· host</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {table.tags.slice(0, 2).map(t => (
              <span key={t} style={{
                fontSize: 10, fontWeight: 600, color: csTheme.textSub,
                background: csTheme.bgElev, padding: '2px 7px', borderRadius: 4,
                border: `1px solid ${csTheme.border}`, letterSpacing: '0.02em',
              }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* meta row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <CSDateStub weekday={table.weekday} dateShort={table.dateShort} time={table.time} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: csTheme.textSub, fontSize: 12 }}>
            <Icon.Pin size={13} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.location}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CSSeatPips filled={table.players + 1} total={table.maxPlayers + 1} />
            <span style={{ fontSize: 11, color: csTheme.textMute, fontWeight: 600, fontFamily: 'Manrope, sans-serif' }}>
              {table.players + 1}/{table.maxPlayers + 1}
            </span>
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: `1px dashed ${csTheme.border}`, paddingTop: 12 }}>
        <CSStatusBadge seats={table.seats} total={table.maxPlayers} />
        {table.joined ? (
          <button style={{
            background: 'transparent', border: `1px solid ${csTheme.border}`, color: csTheme.textSub,
            padding: '7px 14px', borderRadius: 6, fontWeight: 600, fontSize: 12,
            fontFamily: 'Manrope, sans-serif', letterSpacing: '0.02em',
          }}>Ver mesa →</button>
        ) : table.hosted ? (
          <button style={{
            background: 'transparent', border: `1px solid ${csTheme.accent}`, color: csTheme.accent,
            padding: '7px 14px', borderRadius: 6, fontWeight: 600, fontSize: 12,
            fontFamily: 'Manrope, sans-serif', letterSpacing: '0.02em',
          }}>Administrar</button>
        ) : table.seats === 0 ? (
          <button disabled style={{
            background: csTheme.bgElev, border: `1px solid ${csTheme.border}`, color: csTheme.textMute,
            padding: '7px 14px', borderRadius: 6, fontWeight: 600, fontSize: 12,
            fontFamily: 'Manrope, sans-serif', letterSpacing: '0.02em', cursor: 'not-allowed',
          }}>Llena</button>
        ) : (
          <button style={{
            background: csTheme.accent, border: 'none', color: '#fff',
            padding: '7px 16px', borderRadius: 6, fontWeight: 700, fontSize: 12,
            fontFamily: 'Manrope, sans-serif', letterSpacing: '0.04em',
            boxShadow: `0 4px 14px ${csTheme.accentDim}`,
          }}>{table.privacy === 'private' ? 'Solicitar' : 'Unirme'}</button>
        )}
      </div>
    </div>
  );
}

function CSNavbar({ active = 'mesas' }) {
  return (
    <div style={{
      borderBottom: `1px solid ${csTheme.border}`,
      background: 'rgba(10,13,21,0.85)', backdropFilter: 'blur(10px)',
      padding: '0 32px', height: 64,
      display: 'flex', alignItems: 'center', gap: 36,
      fontFamily: 'Manrope, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7, background: csTheme.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em',
          boxShadow: `0 0 18px ${csTheme.accentDim}`,
        }}>T</div>
        <span style={{ fontWeight: 700, fontSize: 17, color: csTheme.text, letterSpacing: '-0.02em' }}>TurnoCero</span>
      </div>
      <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
        {['Mesas', 'Mi feed', 'Jugadores', 'Notificaciones'].map(item => {
          const isActive = item.toLowerCase().includes(active);
          return (
            <a key={item} style={{
              padding: '8px 14px', borderRadius: 6,
              fontSize: 13, fontWeight: 600,
              color: isActive ? csTheme.text : csTheme.textSub,
              background: isActive ? csTheme.bgCard : 'transparent',
              letterSpacing: '-0.01em',
            }}>{item}</a>
          );
        })}
      </nav>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button style={{
          background: csTheme.accent, color: '#fff', border: 'none',
          padding: '8px 14px', borderRadius: 7, fontWeight: 700, fontSize: 12,
          fontFamily: 'Manrope, sans-serif', letterSpacing: '0.04em',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: `0 4px 14px ${csTheme.accentDim}`,
        }}><Icon.Plus size={14} /> CREAR MESA</button>
        <span style={{ color: csTheme.textSub, position: 'relative' }}>
          <Icon.Bell size={18} />
          <span style={{
            position: 'absolute', top: -2, right: -2, width: 8, height: 8,
            background: csTheme.red, borderRadius: 999, border: `2px solid ${csTheme.bg}`,
          }} />
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: csTheme.bgElev,
          border: `1px solid ${csTheme.border}`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: csTheme.text, fontWeight: 700, fontSize: 13,
          fontFamily: 'Manrope, sans-serif',
        }}>Y</div>
      </div>
    </div>
  );
}

// ============================================================
// Dashboard — Desktop
// ============================================================
function CSDashboardDesktop() {
  return (
    <div style={{
      width: 1280, height: 900, background: csTheme.bg,
      backgroundImage: `radial-gradient(circle at 10% 0%, rgba(24,136,239,0.06), transparent 40%), ${grain}`,
      color: csTheme.text, fontFamily: 'Inter, sans-serif', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <CSNavbar active="mesas" />
      <div style={{ padding: '32px 48px', flex: 1, overflow: 'hidden' }}>
        {/* hero */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: csTheme.accentLight, letterSpacing: '0.15em',
                fontFamily: 'Manrope, sans-serif',
              }}>● 12 MESAS ACTIVAS</span>
            </div>
            <h1 style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 44, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, margin: 0,
            }}>Mesas de juego</h1>
            <p style={{ color: csTheme.textSub, marginTop: 8, fontSize: 15 }}>
              Encontrá una mesa o creá la tuya. Esta semana hay 6 en tu zona.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: csTheme.textMute }}>
                <Icon.Search size={14} />
              </span>
              <input placeholder="Buscar juego, host o lugar" style={{
                background: csTheme.bgCard, border: `1px solid ${csTheme.border}`,
                borderRadius: 8, padding: '10px 12px 10px 36px', fontSize: 13,
                color: csTheme.text, width: 280, outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }} />
            </div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: csTheme.bgCard, borderRadius: 9, border: `1px solid ${csTheme.border}` }}>
            {['Todas', 'Mis mesas', 'Hospedando', 'Pasadas'].map((t, i) => (
              <button key={t} style={{
                padding: '7px 14px', borderRadius: 6,
                background: i === 0 ? csTheme.bgElev : 'transparent',
                border: 'none', color: i === 0 ? csTheme.text : csTheme.textSub,
                fontSize: 12, fontWeight: 600, fontFamily: 'Manrope, sans-serif',
                letterSpacing: '0.02em',
              }}>{t}{i === 1 && <span style={{ marginLeft: 6, color: csTheme.accentLight }}>2</span>}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: csTheme.textSub }}>
            <span>Ordenar:</span>
            <select style={{
              background: csTheme.bgCard, border: `1px solid ${csTheme.border}`,
              borderRadius: 6, padding: '6px 10px', color: csTheme.text,
              fontSize: 12, fontFamily: 'Inter, sans-serif',
            }}>
              <option>Próximas primero</option>
              <option>Más recientes</option>
            </select>
          </div>
        </div>

        {/* grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {window.MOCK_TABLES.slice(0, 6).map(t => <CSTableCard key={t.id} table={t} />)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Dashboard — Mobile
// ============================================================
function CSDashboardMobile() {
  return (
    <PhoneFrame>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: csTheme.text, fontFamily: 'Inter, sans-serif', background: csTheme.bg, backgroundImage: grain }}>
        {/* top bar */}
        <div style={{ padding: '12px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6, background: csTheme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'Manrope, sans-serif',
            }}>T</div>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>TurnoCero</span>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', color: csTheme.textSub }}>
            <Icon.Search size={18} />
            <span style={{ position: 'relative' }}>
              <Icon.Bell size={18} />
              <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, background: csTheme.red, borderRadius: 999 }} />
            </span>
          </div>
        </div>

        {/* hero */}
        <div style={{ padding: '8px 18px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: csTheme.accentLight, letterSpacing: '0.15em', fontFamily: 'Manrope, sans-serif', marginBottom: 4 }}>● 12 MESAS ACTIVAS</div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, margin: 0 }}>Mesas<br/>de juego</h1>
        </div>

        {/* tabs */}
        <div style={{ padding: '0 18px 12px', display: 'flex', gap: 6, overflow: 'auto' }}>
          {['Todas', 'Mis mesas', 'Hospedando', 'Pasadas'].map((t, i) => (
            <button key={t} style={{
              padding: '7px 12px', borderRadius: 999,
              background: i === 0 ? csTheme.accent : 'transparent',
              border: `1px solid ${i === 0 ? csTheme.accent : csTheme.border}`,
              color: i === 0 ? '#fff' : csTheme.textSub,
              fontSize: 11, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
              letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0,
            }}>{t.toUpperCase()}</button>
          ))}
        </div>

        {/* cards */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 80px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {window.MOCK_TABLES.slice(0, 4).map(t => <CSTableCard key={t.id} table={t} compact />)}
        </div>

        {/* FAB */}
        <button style={{
          position: 'absolute', bottom: 90, right: 20,
          width: 56, height: 56, borderRadius: 16,
          background: csTheme.accent, border: 'none',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 24px ${csTheme.accentDim}, 0 0 0 4px rgba(24,136,239,0.1)`,
        }}><Icon.Plus size={24} /></button>

        {/* bottom nav */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(10,13,21,0.92)', backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${csTheme.border}`,
          padding: '10px 18px 22px', display: 'flex', justifyContent: 'space-around',
        }}>
          {[
            { icon: Icon.Dice, label: 'Mesas', active: true },
            { icon: Icon.Users, label: 'Feed' },
            { icon: Icon.Bell, label: 'Avisos' },
            { icon: Icon.Crown, label: 'Perfil' },
          ].map((n, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: n.active ? csTheme.accentLight : csTheme.textMute,
              fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            }}>
              <n.icon size={20} />
              <span>{n.label.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

// ============================================================
// Table Detail — Desktop
// ============================================================
function CSTableDetailDesktop() {
  const t = window.MOCK_TABLES[1]; // Catan, joined
  return (
    <div style={{
      width: 1280, height: 900, background: csTheme.bg,
      backgroundImage: grain,
      color: csTheme.text, fontFamily: 'Inter, sans-serif', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <CSNavbar active="mesas" />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* main column */}
        <div style={{ flex: 1, padding: '24px 36px', overflow: 'auto' }}>
          <a style={{ color: csTheme.textSub, fontSize: 12, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.04em' }}>← VOLVER AL DASHBOARD</a>

          {/* hero card */}
          <div style={{
            marginTop: 16,
            background: csTheme.bgCard, backgroundImage: grain,
            border: `1px solid ${csTheme.border}`, borderRadius: 14,
            padding: 24, display: 'flex', gap: 20,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}>
            <GameTile game={t.game} seed={t.seed} size={140} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                  fontFamily: 'Manrope, sans-serif', color: csTheme.accentLight,
                }}>● ESTA SEMANA</span>
                <CSStatusBadge seats={t.seats} total={t.maxPlayers} />
                <span style={{
                  fontSize: 10, fontWeight: 700, color: csTheme.green, letterSpacing: '0.1em',
                  fontFamily: 'Manrope, sans-serif',
                  padding: '3px 8px', borderRadius: 4,
                  background: 'rgba(0,217,132,0.1)', border: `1px solid rgba(0,217,132,0.3)`,
                }}>TE UNISTE</span>
              </div>
              <h1 style={{
                fontFamily: 'Manrope, sans-serif', fontSize: 38, fontWeight: 700,
                letterSpacing: '-0.03em', margin: 0, lineHeight: 1,
              }}>{t.game}</h1>
              <p style={{ color: csTheme.textSub, fontSize: 14, marginTop: 10, lineHeight: 1.55 }}>{t.description}</p>
              <div style={{ display: 'flex', gap: 18, marginTop: 16, alignItems: 'center' }}>
                <CSDateStub weekday={t.weekday} dateShort={t.dateShort} time={t.time} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: csTheme.textSub }}>
                    <Icon.Pin size={14} /><span style={{ color: csTheme.text }}>{t.location}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: csTheme.textSub }}>
                    <Icon.Crown size={14} /><span>Host: <strong style={{ color: csTheme.text }}>{t.host}</strong></span>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button style={{
                    background: 'transparent', border: `1px solid ${csTheme.border}`,
                    color: csTheme.textSub, padding: '10px 16px', borderRadius: 7,
                    fontSize: 12, fontWeight: 600, fontFamily: 'Manrope, sans-serif',
                    letterSpacing: '0.04em',
                  }}>↩ ABANDONAR</button>
                </div>
              </div>
            </div>
          </div>

          {/* participants */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, color: csTheme.textSub, letterSpacing: '0.12em', marginBottom: 12 }}>JUGADORES · {t.players + 1}/{t.maxPlayers + 1}</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {window.MOCK_PLAYERS.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: csTheme.bgCard, border: `1px solid ${p.you ? csTheme.accent : csTheme.border}`,
                  borderRadius: 10, padding: '8px 14px 8px 8px',
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, background: csTheme.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                  }}>{p.avatar}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                    {p.host && <span style={{ fontSize: 9, color: csTheme.accentLight, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>HOST</span>}
                    {p.you && <span style={{ fontSize: 9, color: csTheme.green, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>VOS</span>}
                  </div>
                </div>
              ))}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 52, border: `1.5px dashed ${csTheme.border}`,
                borderRadius: 10, color: csTheme.textMute,
              }}><Icon.Plus size={18} /></div>
            </div>
          </div>

          {/* photos */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, color: csTheme.textSub, letterSpacing: '0.12em', margin: 0 }}>FOTOS · 4/10</h3>
              <button style={{
                background: 'transparent', border: `1px solid ${csTheme.border}`,
                color: csTheme.textSub, padding: '6px 12px', borderRadius: 6,
                fontSize: 11, fontWeight: 600, fontFamily: 'Manrope, sans-serif',
                letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}><Icon.Camera size={13} /> AGREGAR</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
                  border: `1px solid ${csTheme.border}`,
                  background: `repeating-linear-gradient(45deg, ${csTheme.bgElev} 0 8px, ${csTheme.bgCard} 8px 16px)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: csTheme.textMute, fontSize: 10, fontFamily: 'monospace',
                }}>foto_{i+1}.jpg</div>
              ))}
              <div style={{
                aspectRatio: '1', borderRadius: 8, border: `1.5px dashed ${csTheme.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: csTheme.textMute,
              }}><Icon.Plus size={20} /></div>
            </div>
          </div>

          {/* ratings */}
          <div style={{ marginTop: 28, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, color: csTheme.textSub, letterSpacing: '0.12em', margin: 0 }}>VALORACIONES</h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: csTheme.amber, fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13 }}>
                {[1,2,3,4,5].map(s => <Icon.Star key={s} size={12} filled={s <= 4} />)}
                <span style={{ marginLeft: 4 }}>4.5</span>
                <span style={{ color: csTheme.textMute, fontWeight: 500 }}>· 2 reseñas</span>
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {window.MOCK_RATINGS.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: 14,
                  background: csTheme.bgCard, border: `1px solid ${csTheme.border}`, borderRadius: 10,
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, background: csTheme.bgElev,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: csTheme.text, fontWeight: 700, fontFamily: 'Manrope, sans-serif', flexShrink: 0,
                  }}>{r.avatar}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.user}</span>
                      <span style={{ display: 'inline-flex', gap: 1, color: csTheme.amber }}>
                        {[1,2,3,4,5].map(s => <Icon.Star key={s} size={11} filled={s <= r.score} />)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: csTheme.textSub, margin: '6px 0 0', lineHeight: 1.5 }}>{r.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* chat panel */}
        <div style={{
          width: 380, borderLeft: `1px solid ${csTheme.border}`,
          background: csTheme.bgCard, backgroundImage: grain,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${csTheme.border}` }}>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Chat de la mesa</h2>
            <p style={{ fontSize: 11, color: csTheme.textMute, marginTop: 4, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.04em' }}>
              <Icon.Lock size={10} /> SOLO PARTICIPANTES · 3 EN LÍNEA
            </p>
          </div>
          <div style={{ flex: 1, padding: '16px 22px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ textAlign: 'center', fontSize: 10, color: csTheme.textMute, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.1em' }}>
              ─── HOY ───
            </div>
            {window.MOCK_MESSAGES.map(m => (
              <div key={m.id} style={{
                display: 'flex', flexDirection: m.own ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end',
              }}>
                {!m.own && (
                  <span style={{
                    width: 26, height: 26, borderRadius: 7, background: csTheme.bgElev,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: csTheme.text, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                  }}>{m.avatar}</span>
                )}
                <div style={{ maxWidth: 240, display: 'flex', flexDirection: 'column', alignItems: m.own ? 'flex-end' : 'flex-start' }}>
                  {!m.own && <span style={{ fontSize: 10, color: csTheme.textMute, fontWeight: 600, marginBottom: 3, marginLeft: 2 }}>{m.author}</span>}
                  <div style={{
                    background: m.own ? csTheme.accent : csTheme.bgElev,
                    color: m.own ? '#fff' : csTheme.text,
                    padding: '8px 12px', borderRadius: 12,
                    borderBottomRightRadius: m.own ? 4 : 12,
                    borderBottomLeftRadius: m.own ? 12 : 4,
                    fontSize: 13, lineHeight: 1.45,
                  }}>{m.text}</div>
                  <span style={{ fontSize: 9, color: csTheme.textMute, marginTop: 3, fontFamily: 'Manrope, sans-serif' }}>{m.time}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${csTheme.border}`, display: 'flex', gap: 8 }}>
            <input placeholder="Escribí un mensaje…" style={{
              flex: 1, background: csTheme.bg, border: `1px solid ${csTheme.border}`,
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: csTheme.text,
              outline: 'none', fontFamily: 'Inter, sans-serif',
            }} />
            <button style={{
              background: csTheme.accent, color: '#fff', border: 'none', borderRadius: 8,
              width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${csTheme.accentDim}`,
            }}><Icon.Send size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Table Detail — Mobile
// ============================================================
function CSTableDetailMobile() {
  const t = window.MOCK_TABLES[1];
  return (
    <PhoneFrame>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: csTheme.text, fontFamily: 'Inter, sans-serif', background: csTheme.bg, backgroundImage: grain }}>
        <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a style={{ color: csTheme.textSub, fontSize: 11, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.06em', fontWeight: 600 }}>← VOLVER</a>
          <span style={{ fontSize: 18, color: csTheme.textSub }}>⋯</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 80px' }}>
          {/* hero */}
          <div style={{
            background: csTheme.bgCard, backgroundImage: grain,
            border: `1px solid ${csTheme.border}`, borderRadius: 14, padding: 16,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
              <GameTile game={t.game} seed={t.seed} size={70} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                  <CSStatusBadge seats={t.seats} total={t.maxPlayers} />
                </div>
                <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.05 }}>{t.game}</h1>
              </div>
            </div>
            <p style={{ fontSize: 13, color: csTheme.textSub, lineHeight: 1.5, margin: 0 }}>{t.description}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center' }}>
              <CSDateStub weekday={t.weekday} dateShort={t.dateShort} time={t.time} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: csTheme.textSub }}>
                  <Icon.Pin size={12} /><span style={{ color: csTheme.text }}>{t.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: csTheme.textSub }}>
                  <Icon.Crown size={12} /><span>{t.host}</span>
                </div>
              </div>
            </div>
          </div>

          {/* tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 16, background: csTheme.bgCard, padding: 4, borderRadius: 9, border: `1px solid ${csTheme.border}` }}>
            {['Info', 'Chat', 'Fotos', 'Reseñas'].map((tab, i) => (
              <button key={tab} style={{
                flex: 1, padding: '7px 0', borderRadius: 6,
                background: i === 1 ? csTheme.bgElev : 'transparent',
                border: 'none', color: i === 1 ? csTheme.text : csTheme.textSub,
                fontSize: 11, fontWeight: 700, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.04em',
              }}>{tab.toUpperCase()}</button>
            ))}
          </div>

          {/* chat */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {window.MOCK_MESSAGES.slice(0, 4).map(m => (
              <div key={m.id} style={{ display: 'flex', flexDirection: m.own ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
                {!m.own && (
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, background: csTheme.bgElev,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: csTheme.text, fontSize: 10, fontWeight: 700, fontFamily: 'Manrope, sans-serif', flexShrink: 0,
                  }}>{m.avatar}</span>
                )}
                <div style={{ maxWidth: '75%' }}>
                  {!m.own && <span style={{ fontSize: 9, color: csTheme.textMute, fontWeight: 600, marginLeft: 2, display: 'block', marginBottom: 2 }}>{m.author}</span>}
                  <div style={{
                    background: m.own ? csTheme.accent : csTheme.bgCard,
                    color: m.own ? '#fff' : csTheme.text,
                    padding: '8px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.4,
                    border: m.own ? 'none' : `1px solid ${csTheme.border}`,
                  }}>{m.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* chat input */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '10px 14px 24px', background: 'rgba(10,13,21,0.92)',
          backdropFilter: 'blur(20px)', borderTop: `1px solid ${csTheme.border}`,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <input placeholder="Mensaje…" style={{
            flex: 1, background: csTheme.bgCard, border: `1px solid ${csTheme.border}`,
            borderRadius: 999, padding: '10px 16px', fontSize: 13, color: csTheme.text, outline: 'none',
          }} />
          <button style={{
            width: 40, height: 40, borderRadius: 999, background: csTheme.accent,
            color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${csTheme.accentDim}`,
          }}><Icon.Send size={15} /></button>
        </div>
      </div>
    </PhoneFrame>
  );
}

window.CSDashboardDesktop = CSDashboardDesktop;
window.CSDashboardMobile = CSDashboardMobile;
window.CSTableDetailDesktop = CSTableDetailDesktop;
window.CSTableDetailMobile = CSTableDetailMobile;
