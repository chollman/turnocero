// Token & Track — extra screens: Login, Profile, CreateTable, EditTable, Notifications, Feed
const T = window.tkTheme;
const _Meeple = window.Meeple;
const _PhoneFrame = window.PhoneFrame;
const _Icon = window.Icon;
const _GameTile = window.GameTile;
const _SeatTrack = window.SeatTrack;

const fontDisp = { fontFamily: 'Manrope, sans-serif' };
const eyebrow = (color = T.accentLight) => ({
  fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800,
  color, letterSpacing: '0.15em',
});

// Shared chrome — sidebar nav (compact reuse of dashboard sidebar)
function TKSidebar({ active = 'feed' }) {
  const nav = [
    { id: 'feed', icon: '◈', label: 'Mi feed' },
    { id: 'dash', icon: '▦', label: 'Mesas' },
    { id: 'create', icon: '+', label: 'Crear mesa' },
    { id: 'notif', icon: '◆', label: 'Notificaciones', badge: 3 },
    { id: 'profile', icon: '○', label: 'Perfil' },
  ];
  return (
    <div style={{
      width: 220, background: T.bgCard, borderRight: `1px solid ${T.border}`,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, padding: '0 6px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...fontDisp, fontWeight: 800, color: '#fff', fontSize: 16,
          boxShadow: `0 4px 14px ${T.accentDim}`,
        }}>T</div>
        <div>
          <div style={{ ...fontDisp, fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>TurnoCero</div>
          <div style={{ fontSize: 9, color: T.textMute, letterSpacing: '0.1em', fontWeight: 700, ...fontDisp }}>BOARD GAME MEETUPS</div>
        </div>
      </div>
      {nav.map(it => {
        const a = it.id === active;
        return (
          <div key={it.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8,
            background: a ? T.bgElev : 'transparent',
            color: a ? T.text : T.textSub,
            fontSize: 13, fontWeight: 600,
            borderLeft: `2px solid ${a ? T.accent : 'transparent'}`,
            marginLeft: -14, paddingLeft: 14,
          }}>
            <span style={{ width: 18, textAlign: 'center', color: a ? T.accentLight : T.textMute, fontSize: 13 }}>{it.icon}</span>
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.badge && (
              <span style={{
                background: T.red, color: '#fff', fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 999, ...fontDisp,
              }}>{it.badge}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Mobile bottom nav (compact reuse)
function TKBottomNav({ active = 'feed' }) {
  const nav = [
    { id: 'feed', icon: '◈', label: 'Feed' },
    { id: 'dash', icon: '▦', label: 'Mesas' },
    { id: 'create', icon: '+', label: 'Crear' },
    { id: 'notif', icon: '◆', label: 'Avisos', badge: 3 },
    { id: 'profile', icon: '○', label: 'Perfil' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
      background: 'rgba(13,18,28,0.92)', backdropFilter: 'blur(10px)',
      borderTop: `1px solid ${T.border}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    }}>
      {nav.map(n => {
        const a = n.id === active;
        return (
          <div key={n.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: a ? T.accentLight : T.textMute, position: 'relative',
            ...fontDisp, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          }}>
            <span style={{ fontSize: 16 }}>{n.icon}</span>
            <span>{n.label.toUpperCase()}</span>
            {n.badge && (
              <span style={{
                position: 'absolute', top: -2, right: 12,
                background: T.red, width: 14, height: 14, borderRadius: 999,
                fontSize: 9, fontWeight: 700, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${T.bg}`,
              }}>{n.badge}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const Input = ({ label, value, placeholder, hint, ...rest }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>{label.toUpperCase()}</label>}
    <input value={value} placeholder={placeholder} readOnly style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 9, padding: '12px 14px', fontSize: 14,
      color: T.text, outline: 'none', fontFamily: 'Inter, sans-serif',
    }} {...rest} />
    {hint && <span style={{ fontSize: 11, color: T.textMute }}>{hint}</span>}
  </div>
);

const Btn = ({ children, primary, ghost, full, sm, danger }) => (
  <button style={{
    background: primary ? T.accent : ghost ? 'transparent' : T.bgElev,
    color: primary ? '#fff' : danger ? T.red : T.text,
    border: ghost ? `1px solid ${T.border}` : primary ? 'none' : `1px solid ${T.borderHi}`,
    padding: sm ? '7px 14px' : '11px 18px',
    borderRadius: 9,
    fontWeight: 700, fontSize: sm ? 12 : 13,
    ...fontDisp,
    width: full ? '100%' : 'auto',
    boxShadow: primary ? `0 6px 18px ${T.accentDim}` : 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }}>{children}</button>
);

// ===========================================================
// LOGIN — Desktop
// ===========================================================
function TKLoginDesktop() {
  const t = window.MOCK_TABLES[0];
  return (
    <div style={{
      width: 1280, height: 900, background: T.bg, color: T.text,
      fontFamily: 'Inter, sans-serif', display: 'flex', overflow: 'hidden',
    }}>
      {/* Left: form */}
      <div style={{ width: 560, padding: '64px 80px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...fontDisp, fontWeight: 800, color: '#fff', fontSize: 20,
            boxShadow: `0 4px 16px ${T.accentDim}`,
          }}>T</div>
          <div>
            <div style={{ ...fontDisp, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>TurnoCero</div>
            <div style={{ fontSize: 9, color: T.textMute, letterSpacing: '0.1em', fontWeight: 700, ...fontDisp }}>BOARD GAME MEETUPS</div>
          </div>
        </div>

        <div style={eyebrow()}>◆ BIENVENIDO DE VUELTA</div>
        <h1 style={{ ...fontDisp, fontSize: 42, fontWeight: 700, letterSpacing: '-0.04em', margin: '10px 0 12px', lineHeight: 1 }}>
          Tirá los dados.
        </h1>
        <p style={{ color: T.textSub, fontSize: 15, lineHeight: 1.5, margin: '0 0 36px', maxWidth: 380 }}>
          Sumate a tu próxima partida o convocá la tuya.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
          <Input label="Usuario o email" value="yago@turnocero.club" />
          <Input label="Contraseña" value="••••••••••" type="password" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: T.textSub }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: T.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>
              Recordarme
            </label>
            <a style={{ color: T.accentLight, fontWeight: 600 }}>¿Olvidaste tu contraseña?</a>
          </div>
          <Btn primary full><span style={{ fontSize: 14 }}>🎲</span> Entrar</Btn>
          <div style={{ textAlign: 'center', color: T.textMute, fontSize: 12, margin: '8px 0', position: 'relative' }}>
            <span style={{ background: T.bg, padding: '0 12px', position: 'relative', zIndex: 1 }}>o</span>
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: `1px solid ${T.border}` }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn ghost full><span style={{ fontSize: 14 }}>G</span> Google</Btn>
            <Btn ghost full><span style={{ fontSize: 14 }}>✦</span> Discord</Btn>
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: T.textSub, margin: '14px 0 0' }}>
            ¿No tenés cuenta? <a style={{ color: T.accentLight, fontWeight: 700 }}>Crear cuenta →</a>
          </p>
        </div>
      </div>

      {/* Right: showcase */}
      <div style={{ flex: 1, background: T.bgCard, position: 'relative', overflow: 'hidden', borderLeft: `1px solid ${T.border}` }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
          <_GameTile game="Catan TurnoCero" seed={11} size={'100%'} />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(8,11,19,0.5), rgba(8,11,19,0.85))` }} />
        <div style={{ position: 'absolute', inset: 0, padding: '80px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={eyebrow('#fff')}>◆ ESTA SEMANA</div>
            <h2 style={{ ...fontDisp, fontSize: 56, fontWeight: 700, letterSpacing: '-0.04em', margin: '14px 0 0', lineHeight: 0.95, color: '#fff', maxWidth: 480 }}>
              42 mesas activas
              <br/>
              <span style={{ color: T.accentLight }}>en tu zona.</span>
            </h2>
          </div>
          {/* preview card */}
          <div style={{
            background: 'rgba(13,18,28,0.85)', border: `1px solid ${T.borderHi}`,
            borderRadius: 14, padding: 18, backdropFilter: 'blur(12px)',
            maxWidth: 360,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <_Meeple char={t.hostAvatar} size={34} color={T.accent} />
              <div>
                <div style={{ ...fontDisp, fontWeight: 700, fontSize: 15 }}>{t.game}</div>
                <div style={{ fontSize: 11, color: T.textSub }}>{t.host} · {t.location}</div>
              </div>
            </div>
            <_SeatTrack filled={t.players + 1} total={t.maxPlayers + 1} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: T.green, ...fontDisp, fontWeight: 700 }}>● {t.maxPlayers - t.players} LUGARES</span>
              <span style={{ fontSize: 11, color: T.textSub }}>{t.weekday} {t.dateShort} · {t.time}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// LOGIN — Mobile
// ===========================================================
function TKLoginMobile() {
  return (
    <_PhoneFrame theme={T.bg}>
      <div style={{ height: '100%', background: T.bg, color: T.text, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* tile bg top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, opacity: 0.4 }}>
          <_GameTile game="TurnoCero" seed={7} size={'100%'} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 0%, ${T.bg} 90%)` }} />
        </div>
        <div style={{ position: 'relative', padding: '60px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...fontDisp, fontWeight: 800, color: '#fff', fontSize: 28,
            boxShadow: `0 8px 28px ${T.accentDim}`,
          }}>T</div>
          <div style={{ ...fontDisp, fontWeight: 700, fontSize: 20, marginTop: 14, letterSpacing: '-0.02em' }}>TurnoCero</div>
          <div style={{ fontSize: 10, color: T.textMute, letterSpacing: '0.12em', fontWeight: 700, ...fontDisp, marginTop: 4 }}>BOARD GAME MEETUPS</div>
        </div>
        <div style={{ position: 'relative', flex: 1, padding: '32px 22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ ...fontDisp, fontSize: 26, fontWeight: 700, letterSpacing: '-0.035em', margin: 0, textAlign: 'center', lineHeight: 1.1 }}>
            Tirá los dados.
          </h1>
          <p style={{ color: T.textSub, fontSize: 13, textAlign: 'center', margin: '0 0 12px' }}>
            Sumate a tu próxima partida.
          </p>
          <Input label="Usuario o email" value="yago@turnocero.club" />
          <Input label="Contraseña" value="••••••••••" type="password" />
          <Btn primary full><span style={{ fontSize: 13 }}>🎲</span> Entrar</Btn>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn ghost full sm>Google</Btn>
            <Btn ghost full sm>Discord</Btn>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: T.textSub, margin: '8px 0 0' }}>
            ¿No tenés cuenta? <span style={{ color: T.accentLight, fontWeight: 700 }}>Crear cuenta</span>
          </p>
        </div>
      </div>
    </_PhoneFrame>
  );
}

// ===========================================================
// CREATE TABLE — Desktop
// ===========================================================
function TKCreateTableDesktop({ editMode }) {
  const POPULAR = ['Catan', 'Wingspan', 'Terraforming Mars', '7 Wonders', 'Gloomhaven', 'Spirit Island', 'Root', 'Pandemic'];
  const selected = editMode ? 'Terraforming Mars' : 'Wingspan';
  return (
    <div style={{ width: 1280, height: 900, background: T.bg, color: T.text, display: 'flex', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <TKSidebar active="create" />
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 56px' }}>
        <div style={{ maxWidth: 760 }}>
          <div style={eyebrow()}>◆ {editMode ? 'EDITAR MESA' : 'NUEVA MESA'}</div>
          <h1 style={{ ...fontDisp, fontSize: 40, fontWeight: 700, letterSpacing: '-0.04em', margin: '8px 0 6px' }}>
            {editMode ? 'Editar tu mesa' : 'Convocá una partida'}
          </h1>
          <p style={{ color: T.textSub, fontSize: 14, margin: '0 0 32px' }}>
            {editMode ? 'Los cambios se notifican a los jugadores ya unidos.' : 'Elegí juego, lugar y horario. La comunidad se encarga del resto.'}
          </p>

          {/* Form */}
          <div style={{
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 24,
          }}>
            {/* Game */}
            <div>
              <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>JUEGO DE MESA *</label>
              <input value={selected} readOnly style={{
                background: T.bgInset, border: `1px solid ${T.border}`,
                borderRadius: 9, padding: '12px 14px', fontSize: 15,
                color: T.text, outline: 'none', width: '100%', marginTop: 8,
                fontFamily: 'Inter, sans-serif',
              }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {POPULAR.map(g => {
                  const a = g === selected;
                  return (
                    <span key={g} style={{
                      padding: '6px 12px', borderRadius: 999,
                      border: `1px solid ${a ? T.accent : T.border}`,
                      background: a ? T.accentDim : T.bgInset,
                      color: a ? T.accentLight : T.textSub,
                      fontSize: 12, fontWeight: 600, ...fontDisp,
                    }}>{g}</span>
                  );
                })}
              </div>
            </div>

            {/* Date + Seats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>FECHA Y HORA *</label>
                <div style={{
                  background: T.bgInset, border: `1px solid ${T.border}`,
                  borderRadius: 9, padding: '12px 14px', fontSize: 14,
                  marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>Sáb, 24 may 2026 · 21:00</span>
                  <span style={{ color: T.textMute, fontSize: 16 }}>▾</span>
                </div>
              </div>
              <div>
                <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>LUGARES *</label>
                <div style={{
                  background: T.bgInset, border: `1px solid ${T.border}`,
                  borderRadius: 9, padding: '8px 12px', marginTop: 8,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: T.bgElev, border: `1px solid ${T.borderHi}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...fontDisp, fontWeight: 700, fontSize: 18 }}>−</div>
                  <div style={{ flex: 1, textAlign: 'center', ...fontDisp, fontWeight: 700, fontSize: 22 }}>3</div>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...fontDisp, fontWeight: 700, fontSize: 18 }}>+</div>
                  <span style={{ color: T.textSub, fontSize: 12, marginLeft: 6 }}>Total: 4</span>
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>UBICACIÓN</label>
              <input placeholder="Casa, bar, club… (opcional)" readOnly value="Lapsus Coffee · Palermo" style={{
                background: T.bgInset, border: `1px solid ${T.border}`,
                borderRadius: 9, padding: '12px 14px', fontSize: 14,
                color: T.text, outline: 'none', width: '100%', marginTop: 8, fontFamily: 'Inter, sans-serif',
              }} />
            </div>

            {/* Description */}
            <div>
              <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>DESCRIPCIÓN</label>
              <textarea readOnly defaultValue="Partida tranquila, nivel intermedio. Traigan ganas. Hay café y picada del lugar." style={{
                background: T.bgInset, border: `1px solid ${T.border}`,
                borderRadius: 9, padding: '12px 14px', fontSize: 14,
                color: T.text, outline: 'none', width: '100%', marginTop: 8,
                resize: 'none', minHeight: 72, fontFamily: 'Inter, sans-serif',
              }} />
            </div>

            {/* Privacy */}
            <div>
              <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>PRIVACIDAD</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                <div style={{
                  border: `1.5px solid ${T.accent}`, background: T.accentDim,
                  borderRadius: 11, padding: 14, display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🌐</span>
                    <span style={{ ...fontDisp, fontWeight: 700, fontSize: 14, color: T.accentLight }}>Pública</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.textSub }}>Cualquiera puede unirse al instante</span>
                </div>
                <div style={{
                  border: `1px solid ${T.border}`, background: T.bgInset,
                  borderRadius: 11, padding: 14, display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🔒</span>
                    <span style={{ ...fontDisp, fontWeight: 700, fontSize: 14 }}>Privada</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.textSub }}>Aprobás cada solicitud</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
              <Btn ghost>Cancelar</Btn>
              {editMode && <Btn danger>Eliminar mesa</Btn>}
              <Btn primary>{editMode ? 'Guardar cambios' : '🎲 Crear mesa'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// CREATE TABLE — Mobile
// ===========================================================
function TKCreateTableMobile({ editMode }) {
  const POPULAR = ['Catan', 'Wingspan', 'TM', '7 Wonders', 'Root', 'Pandemic'];
  const sel = editMode ? 'Terraforming Mars' : 'Wingspan';
  return (
    <_PhoneFrame theme={T.bg}>
      <div style={{ height: '100%', background: T.bg, color: T.text, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ color: T.textSub, fontSize: 13 }}>← Volver</span>
          <span style={{ ...fontDisp, fontWeight: 700, fontSize: 14 }}>{editMode ? 'Editar mesa' : 'Nueva mesa'}</span>
          <span style={{ width: 40 }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px 90px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={eyebrow()}>◆ {editMode ? 'EDITAR' : 'CONVOCÁ JUGADORES'}</div>
            <h1 style={{ ...fontDisp, fontSize: 26, fontWeight: 700, letterSpacing: '-0.035em', margin: '6px 0 0', lineHeight: 1.05 }}>
              {editMode ? 'Editar mesa' : 'Crear nueva mesa'}
            </h1>
          </div>
          <Input label="Juego *" value={sel} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {POPULAR.map(g => {
              const a = g === sel || (g === 'TM' && sel === 'Terraforming Mars');
              return (
                <span key={g} style={{
                  padding: '5px 10px', borderRadius: 999,
                  border: `1px solid ${a ? T.accent : T.border}`,
                  background: a ? T.accentDim : T.bgInset,
                  color: a ? T.accentLight : T.textSub,
                  fontSize: 11, fontWeight: 600, ...fontDisp,
                }}>{g}</span>
              );
            })}
          </div>
          <Input label="Fecha y hora *" value="Sáb 24 may · 21:00" />
          <div>
            <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>LUGARES *</label>
            <div style={{
              background: T.bgCard, border: `1px solid ${T.border}`,
              borderRadius: 9, padding: '8px 12px', marginTop: 6,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: T.bgElev, border: `1px solid ${T.borderHi}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...fontDisp, fontWeight: 700, fontSize: 16 }}>−</div>
              <div style={{ flex: 1, textAlign: 'center', ...fontDisp, fontWeight: 700, fontSize: 20 }}>3</div>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...fontDisp, fontWeight: 700, fontSize: 16 }}>+</div>
            </div>
          </div>
          <Input label="Ubicación" value="Lapsus Coffee · Palermo" />
          <div>
            <label style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.textMute, letterSpacing: '0.1em' }}>PRIVACIDAD</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, background: T.bgCard, padding: 4, borderRadius: 10, border: `1px solid ${T.border}` }}>
              <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, background: T.accent, color: '#fff', ...fontDisp, fontWeight: 700, fontSize: 12, textAlign: 'center' }}>🌐 Pública</div>
              <div style={{ flex: 1, padding: '8px 10px', borderRadius: 7, color: T.textSub, ...fontDisp, fontWeight: 700, fontSize: 12, textAlign: 'center' }}>🔒 Privada</div>
            </div>
          </div>
          <Btn primary full>{editMode ? 'Guardar cambios' : '🎲 Crear mesa'}</Btn>
          {editMode && <Btn ghost full><span style={{ color: T.red }}>Eliminar mesa</span></Btn>}
        </div>
      </div>
    </_PhoneFrame>
  );
}

// ===========================================================
// PROFILE — Desktop
// ===========================================================
function TKProfileDesktop() {
  const stats = [
    { label: 'PARTIDAS', value: '14' },
    { label: 'HOSTEADAS', value: '6' },
    { label: 'RATING', value: '4.8 ★' },
    { label: 'AMIGOS', value: '23' },
  ];
  const hostedTables = window.MOCK_TABLES.slice(0, 3);
  const badges = [
    { icon: '◆', label: 'Host estrella', color: T.accent },
    { icon: '✦', label: '10+ partidas', color: T.purple },
    { icon: '★', label: 'Puntual', color: T.green },
  ];
  return (
    <div style={{ width: 1280, height: 900, background: T.bg, color: T.text, display: 'flex', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <TKSidebar active="profile" />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* hero */}
        <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
          <_GameTile game="yago perfil" seed={5} size={'100%'} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(8,11,19,0.3), ${T.bg})` }} />
        </div>
        <div style={{ padding: '0 56px 56px', marginTop: -80, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, marginBottom: 28 }}>
            <_Meeple char="Y" size={120} color={T.accent} />
            <div style={{ flex: 1, paddingBottom: 12 }}>
              <div style={eyebrow()}>◆ PERFIL · ACTIVO DESDE 2024</div>
              <h1 style={{ ...fontDisp, fontSize: 42, fontWeight: 700, letterSpacing: '-0.04em', margin: '6px 0 4px' }}>Yago Perez</h1>
              <div style={{ color: T.textSub, fontSize: 14 }}>@yago · Palermo, CABA · 📞 Telegram conectado</div>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
              <Btn ghost>Compartir</Btn>
              <Btn primary>Editar perfil</Btn>
            </div>
          </div>

          {/* stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {stats.map(s => (
              <div key={s.label} style={{
                background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 12, padding: '18px 22px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: T.textMute, ...fontDisp, letterSpacing: '0.14em' }}>{s.label}</div>
                <div style={{ ...fontDisp, fontWeight: 700, fontSize: 30, letterSpacing: '-0.03em', marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div>
              <h3 style={{ ...fontDisp, fontWeight: 800, fontSize: 12, color: T.textMute, letterSpacing: '0.14em', margin: '0 0 12px' }}>MESAS HOSTEADAS · 6</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hostedTables.map(t => (
                  <div key={t.id} style={{
                    background: T.bgCard, border: `1px solid ${T.border}`,
                    borderRadius: 11, padding: 14, display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <div style={{ width: 56, height: 56, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
                      <_GameTile game={t.game} seed={t.seed} size={56} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...fontDisp, fontWeight: 700, fontSize: 15 }}>{t.game}</div>
                      <div style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>{t.weekday} {t.dateShort} · {t.players + 1}/{t.maxPlayers + 1} jugadores · {t.location}</div>
                    </div>
                    <span style={{ ...fontDisp, fontSize: 11, fontWeight: 700, color: T.green, letterSpacing: '0.08em' }}>4.8 ★</span>
                  </div>
                ))}
                <a style={{ ...fontDisp, fontWeight: 700, fontSize: 12, color: T.accentLight, textAlign: 'center', padding: 8 }}>Ver todas las mesas →</a>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h3 style={{ ...fontDisp, fontWeight: 800, fontSize: 12, color: T.textMute, letterSpacing: '0.14em', margin: '0 0 12px' }}>LOGROS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {badges.map(b => (
                    <div key={b.label} style={{
                      background: T.bgCard, border: `1px solid ${T.border}`,
                      borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${b.color}33`, color: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{b.icon}</div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 style={{ ...fontDisp, fontWeight: 800, fontSize: 12, color: T.textMute, letterSpacing: '0.14em', margin: '0 0 12px' }}>JUEGOS FAVORITOS</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Wingspan', 'Catan', 'Terraforming Mars', 'Spirit Island', '7 Wonders'].map(g => (
                    <span key={g} style={{
                      padding: '5px 10px', borderRadius: 999, background: T.bgCard,
                      border: `1px solid ${T.border}`, fontSize: 11, fontWeight: 600, color: T.textSub,
                    }}>{g}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// PROFILE — Mobile
// ===========================================================
function TKProfileMobile() {
  const stats = [['14', 'PARTIDAS'], ['6', 'HOST'], ['4.8★', 'RATING']];
  return (
    <_PhoneFrame theme={T.bg}>
      <div style={{ height: '100%', background: T.bg, color: T.text, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
          <_GameTile game="yago perfil mob" seed={5} size={'100%'} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(8,11,19,0.4), ${T.bg})` }} />
          <div style={{ position: 'absolute', top: 14, left: 14, fontSize: 13, color: '#fff' }}>←</div>
          <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 13, color: '#fff' }}>···</div>
        </div>
        <div style={{ padding: '0 22px 90px', marginTop: -56 }}>
          <_Meeple char="Y" size={86} color={T.accent} />
          <div style={{ marginTop: 12 }}>
            <h1 style={{ ...fontDisp, fontSize: 24, fontWeight: 700, letterSpacing: '-0.035em', margin: 0 }}>Yago Perez</h1>
            <div style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>@yago · Palermo · activo desde 2024</div>
          </div>
          <div style={{ display: 'flex', gap: 8, margin: '14px 0 18px' }}>
            <Btn primary sm full>Editar perfil</Btn>
            <Btn ghost sm>Compartir</Btn>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
            {stats.map(([v, l]) => (
              <div key={l} style={{
                background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: '12px 10px', textAlign: 'center',
              }}>
                <div style={{ ...fontDisp, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>{v}</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.textMute, ...fontDisp, letterSpacing: '0.12em', marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
          <h3 style={{ ...fontDisp, fontSize: 10, fontWeight: 800, color: T.textMute, letterSpacing: '0.14em', margin: '0 0 10px' }}>LOGROS</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto' }}>
            {[['◆', 'Host estrella', T.accent], ['✦', '10+ partidas', T.purple], ['★', 'Puntual', T.green]].map(([i, l, c]) => (
              <div key={l} style={{
                background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              }}>
                <span style={{ width: 26, height: 26, borderRadius: 6, background: `${c}33`, color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{i}</span>
                <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{l}</span>
              </div>
            ))}
          </div>
          <h3 style={{ ...fontDisp, fontSize: 10, fontWeight: 800, color: T.textMute, letterSpacing: '0.14em', margin: '0 0 10px' }}>MESAS HOSTEADAS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {window.MOCK_TABLES.slice(0, 2).map(t => (
              <div key={t.id} style={{
                background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  <_GameTile game={t.game} seed={t.seed} size={42} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...fontDisp, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.game}</div>
                  <div style={{ fontSize: 11, color: T.textSub }}>{t.weekday} {t.dateShort}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <TKBottomNav active="profile" />
      </div>
    </_PhoneFrame>
  );
}

// ===========================================================
// NOTIFICATIONS — Desktop
// ===========================================================
function TKNotificationsDesktop() {
  const items = [
    { type: 'accepted', who: 'Tomás', game: 'Wingspan', when: 'hace 5 min', preview: '¡Aceptado! Ya sos parte de la mesa.' },
    { type: 'request', who: 'Lucía', game: 'Catan', when: 'hace 23 min', preview: 'Lucía quiere unirse a tu mesa', count: 2 },
    { type: 'chat', who: 'Mariano', game: 'Spirit Island', when: 'hace 1 h', preview: 'Mariano: ¿alguien trae el manual de la expansión?' },
    { type: 'chat', who: 'Florencia', game: 'Terraforming Mars', when: 'hace 3 h', preview: 'Florencia: dale, me sumo el sábado a las 9', count: 4 },
    { type: 'accepted', who: 'Iván', game: '7 Wonders', when: 'ayer', preview: '¡Aceptado! Ya sos parte de la mesa.' },
    { type: 'request', who: 'Sofía', game: 'Root', when: 'ayer', preview: 'Sofía quiere unirse a tu mesa' },
  ];
  const meta = (type) => {
    if (type === 'accepted') return { color: T.green, label: 'ACEPTADA', icon: '✓' };
    if (type === 'request') return { color: T.accentLight, label: 'SOLICITUD', icon: '◆' };
    return { color: T.purple, label: 'CHAT', icon: '◈' };
  };
  return (
    <div style={{ width: 1280, height: 900, background: T.bg, color: T.text, display: 'flex', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <TKSidebar active="notif" />
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 56px' }}>
        <div style={{ maxWidth: 820 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <div style={eyebrow()}>◆ NOTIFICACIONES · 6 NUEVAS</div>
              <h1 style={{ ...fontDisp, fontSize: 40, fontWeight: 700, letterSpacing: '-0.04em', margin: '8px 0 0' }}>Tu actividad</h1>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn ghost sm>Marcar todas leídas</Btn>
              <Btn ghost sm>Configurar</Btn>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[['Todas', 6, true], ['Solicitudes', 2], ['Aceptadas', 2], ['Chat', 4]].map(([l, c, a]) => (
              <span key={l} style={{
                padding: '7px 14px', borderRadius: 999,
                background: a ? T.bgElev : T.bgCard,
                border: `1px solid ${a ? T.borderHi : T.border}`,
                color: a ? T.text : T.textSub,
                fontSize: 12, fontWeight: 700, ...fontDisp,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>{l}<span style={{ color: T.textMute, fontWeight: 600 }}>{c}</span></span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, i) => {
              const m = meta(it.type);
              const unread = i < 4;
              return (
                <div key={i} style={{
                  background: unread ? T.bgCard : 'transparent',
                  border: `1px solid ${unread ? T.borderHi : T.border}`,
                  borderRadius: 12, padding: 16, display: 'flex', gap: 14, alignItems: 'center',
                  borderLeft: `3px solid ${unread ? m.color : 'transparent'}`,
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, background: `${m.color}26`,
                    color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...fontDisp, fontWeight: 800, fontSize: 16, flexShrink: 0,
                  }}>{m.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ ...fontDisp, fontWeight: 700, fontSize: 13 }}>{it.game}</span>
                      <span style={{ ...fontDisp, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: m.color }}>{m.label}</span>
                      {it.count && (
                        <span style={{ background: T.red, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, ...fontDisp }}>{it.count}</span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMute }}>{it.when}</span>
                    </div>
                    <div style={{ fontSize: 13, color: T.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.preview}</div>
                  </div>
                  {it.type === 'request' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn sm>Rechazar</Btn>
                      <Btn primary sm>Aceptar</Btn>
                    </div>
                  ) : (
                    <Btn sm ghost>Ver mesa →</Btn>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// NOTIFICATIONS — Mobile
// ===========================================================
function TKNotificationsMobile() {
  const items = [
    { type: 'accepted', game: 'Wingspan', when: '5m', preview: 'Ya sos parte de la mesa.' },
    { type: 'request', game: 'Catan', when: '23m', preview: 'Lucía quiere unirse', count: 2 },
    { type: 'chat', game: 'Spirit Island', when: '1h', preview: 'Mariano: ¿alguien trae el manual?' },
    { type: 'chat', game: 'Terraforming Mars', when: '3h', preview: 'Flor: me sumo el sábado', count: 4 },
    { type: 'accepted', game: '7 Wonders', when: 'ayer', preview: 'Ya sos parte de la mesa.' },
  ];
  const meta = (type) => {
    if (type === 'accepted') return { color: T.green, icon: '✓' };
    if (type === 'request') return { color: T.accentLight, icon: '◆' };
    return { color: T.purple, icon: '◈' };
  };
  return (
    <_PhoneFrame theme={T.bg}>
      <div style={{ height: '100%', background: T.bg, color: T.text, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 18px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: T.textSub, fontSize: 13 }}>← Volver</span>
          <span style={{ ...fontDisp, fontWeight: 700, fontSize: 14 }}>Notificaciones</span>
          <span style={{ fontSize: 11, color: T.accentLight, fontWeight: 700 }}>Limpiar</span>
        </div>
        <div style={{ padding: '8px 18px 14px' }}>
          <div style={eyebrow()}>◆ 5 NUEVAS</div>
          <h1 style={{ ...fontDisp, fontSize: 26, fontWeight: 700, letterSpacing: '-0.035em', margin: '4px 0 0', lineHeight: 1 }}>Tu actividad</h1>
        </div>
        <div style={{ padding: '0 18px', display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
          {['Todas 5', 'Solicitudes 1', 'Aceptadas 2', 'Chat 2'].map((l, i) => (
            <span key={l} style={{
              padding: '6px 11px', borderRadius: 999,
              background: i === 0 ? T.accent : T.bgCard,
              border: `1px solid ${i === 0 ? T.accent : T.border}`,
              color: i === 0 ? '#fff' : T.textSub,
              fontSize: 11, fontWeight: 700, ...fontDisp, whiteSpace: 'nowrap',
            }}>{l}</span>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 90px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => {
            const m = meta(it.type);
            const unread = i < 4;
            return (
              <div key={i} style={{
                background: unread ? T.bgCard : 'transparent',
                border: `1px solid ${unread ? T.borderHi : T.border}`,
                borderRadius: 11, padding: 12, display: 'flex', gap: 10, alignItems: 'center',
                borderLeft: `3px solid ${unread ? m.color : 'transparent'}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, background: `${m.color}26`,
                  color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...fontDisp, fontWeight: 800, fontSize: 14, flexShrink: 0,
                }}>{m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ ...fontDisp, fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.game}</span>
                    {it.count && <span style={{ background: T.red, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999, ...fontDisp }}>{it.count}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: T.textMute }}>{it.when}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.preview}</div>
                </div>
              </div>
            );
          })}
        </div>
        <TKBottomNav active="notif" />
      </div>
    </_PhoneFrame>
  );
}

// ===========================================================
// FEED (/me) — Desktop
// ===========================================================
function TKFeedDesktop() {
  const next = window.MOCK_TABLES[0];
  const past = window.MOCK_TABLES.slice(1, 4);
  return (
    <div style={{ width: 1280, height: 900, background: T.bg, color: T.text, display: 'flex', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <TKSidebar active="feed" />
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 56px' }}>
        <div style={{ maxWidth: 920 }}>
          <div style={eyebrow()}>◆ MI FEED</div>
          <h1 style={{ ...fontDisp, fontSize: 40, fontWeight: 700, letterSpacing: '-0.04em', margin: '8px 0 4px' }}>Hola, Yago.</h1>
          <p style={{ color: T.textSub, fontSize: 14, margin: '0 0 28px' }}>Tu próxima partida es en 2 días. Y tenés 6 mesas hosteadas en total.</p>

          {/* Next game highlight */}
          <div style={{
            background: `linear-gradient(135deg, ${T.accentDim}, ${T.bgCard})`,
            border: `1px solid ${T.accent}`, borderRadius: 14, padding: 24,
            display: 'flex', gap: 22, alignItems: 'center', marginBottom: 28,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, opacity: 0.25 }}>
              <_GameTile game={next.game} seed={next.seed} size={'100%'} />
            </div>
            <div style={{ width: 110, height: 110, borderRadius: 14, overflow: 'hidden', flexShrink: 0, position: 'relative', zIndex: 1 }}>
              <_GameTile game={next.game} seed={next.seed} size={110} />
            </div>
            <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
              <span style={{ ...fontDisp, fontSize: 10, fontWeight: 800, color: T.accentLight, letterSpacing: '0.14em' }}>◆ PRÓXIMA MESA · EN 2 DÍAS</span>
              <div style={{ ...fontDisp, fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', margin: '6px 0 4px' }}>{next.game}</div>
              <div style={{ color: T.textSub, fontSize: 13 }}>{next.weekday} {next.dateShort} · {next.time} · {next.location} · {next.players + 1}/{next.maxPlayers + 1} jugadores</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Btn primary sm>Abrir mesa →</Btn>
                <Btn ghost sm>Chat (8 sin leer)</Btn>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['Todas', 14, true], ['Anfitrión', 6], ['Jugador', 8], ['Canceladas', 1]].map(([l, c, a]) => (
              <span key={l} style={{
                padding: '7px 14px', borderRadius: 999,
                background: a ? T.bgElev : T.bgCard,
                border: `1px solid ${a ? T.borderHi : T.border}`,
                color: a ? T.text : T.textSub,
                fontSize: 12, fontWeight: 700, ...fontDisp,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>{l}<span style={{ color: T.textMute, fontWeight: 600 }}>{c}</span></span>
            ))}
          </div>

          <h3 style={{ ...fontDisp, fontWeight: 800, fontSize: 12, color: T.textMute, letterSpacing: '0.14em', margin: '14px 0 12px' }}>HISTORIAL</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {past.map(t => (
              <div key={t.id} style={{
                background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 11, padding: 14, display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ width: 64, height: 64, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
                  <_GameTile game={t.game} seed={t.seed} size={64} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...fontDisp, fontWeight: 700, fontSize: 15 }}>{t.game}</span>
                    <span style={{
                      ...fontDisp, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                      padding: '2px 7px', borderRadius: 4,
                      background: t.hosted ? T.accentDim : `${T.green}26`,
                      color: t.hosted ? T.accentLight : T.green,
                    }}>{t.hosted ? 'HOST' : 'JUGADOR'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>{t.weekday} {t.dateShort} · {t.players + 1}/{t.maxPlayers + 1} jugadores · {t.location}</div>
                  <div style={{ fontSize: 11, color: T.textMute, marginTop: 4 }}>★ 4.{5 + (t.seed % 4)} · {3 + (t.seed % 5)} comentarios</div>
                </div>
                <Btn ghost sm>Ver →</Btn>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// FEED — Mobile
// ===========================================================
function TKFeedMobile() {
  const next = window.MOCK_TABLES[0];
  const past = window.MOCK_TABLES.slice(1, 3);
  return (
    <_PhoneFrame theme={T.bg}>
      <div style={{ height: '100%', background: T.bg, color: T.text, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 18px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={eyebrow()}>◆ MI FEED</div>
            <div style={{ ...fontDisp, fontSize: 22, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, marginTop: 4 }}>Hola, Yago.</div>
          </div>
          <_Meeple char="Y" size={36} color={T.accent} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px 90px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.accentDim}, ${T.bgCard})`,
            border: `1px solid ${T.accent}`, borderRadius: 14, padding: 14,
            marginBottom: 18, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, opacity: 0.3 }}>
              <_GameTile game={next.game} seed={next.seed} size={'100%'} />
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ ...fontDisp, fontSize: 9, fontWeight: 800, color: T.accentLight, letterSpacing: '0.14em' }}>◆ PRÓXIMA · 2 DÍAS</span>
              <div style={{ ...fontDisp, fontWeight: 700, fontSize: 19, letterSpacing: '-0.025em', margin: '4px 0' }}>{next.game}</div>
              <div style={{ fontSize: 12, color: T.textSub }}>{next.weekday} {next.dateShort} · {next.time}</div>
              <div style={{ fontSize: 11, color: T.textMute, marginTop: 2 }}>{next.location} · {next.players + 1}/{next.maxPlayers + 1}</div>
              <div style={{ marginTop: 10 }}>
                <Btn primary sm>Abrir mesa →</Btn>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
            {[['Todas', 14, true], ['Host', 6], ['Jugador', 8], ['Canc.', 1]].map(([l, c, a]) => (
              <span key={l} style={{
                padding: '5px 10px', borderRadius: 999,
                background: a ? T.accent : T.bgCard,
                border: `1px solid ${a ? T.accent : T.border}`,
                color: a ? '#fff' : T.textSub,
                fontSize: 11, fontWeight: 700, ...fontDisp, whiteSpace: 'nowrap',
              }}>{l} {c}</span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map(t => (
              <div key={t.id} style={{
                background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 11, padding: 10, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  <_GameTile game={t.game} seed={t.seed} size={48} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ ...fontDisp, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.game}</span>
                    <span style={{
                      ...fontDisp, fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                      padding: '1px 5px', borderRadius: 3,
                      background: t.hosted ? T.accentDim : `${T.green}26`,
                      color: t.hosted ? T.accentLight : T.green,
                    }}>{t.hosted ? 'HOST' : 'PLAYER'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>{t.weekday} {t.dateShort} · ★ 4.{5 + (t.seed % 4)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <TKBottomNav active="feed" />
      </div>
    </_PhoneFrame>
  );
}

Object.assign(window, {
  TKLoginDesktop, TKLoginMobile,
  TKCreateTableDesktop, TKCreateTableMobile,
  TKProfileDesktop, TKProfileMobile,
  TKNotificationsDesktop, TKNotificationsMobile,
  TKFeedDesktop, TKFeedMobile,
});
