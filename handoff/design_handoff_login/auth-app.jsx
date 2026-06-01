/* global React, ReactDOM, TweaksPanel, TweakSection, TweakRadio, useTweaks */
const { useState, useMemo, useEffect } = React;

// ─── Icons ─────────────────────────────────────────────────────
const AIcon = {
  Mail:   (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>,
  Lock:   (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  User:   (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Eye:    (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Check:  (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Dice:   (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="8" cy="16" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/></svg>,
  Google: (p={}) => <svg width={p.size||17} height={p.size||17} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>,
  Discord:(p={}) => <svg width={p.size||17} height={p.size||17} viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>,
};

const SWATCHES = ['#1888ef', '#00d984', '#f5a623', '#b48cff', '#f31d77', '#00aeff'];

// ─── Board-game flat-lay illustration (showcase backdrop) ──────
function ShowcaseScene() {
  // Meeple silhouette path (24x24)
  const MEEPLE = "M12 2a2.6 2.6 0 0 0-2.6 2.6c0 .8.36 1.5.92 2L9 8.5c-.3.5-.84.8-1.42.8H5.2C4 9.3 3 10.3 3 11.5c0 .6.24 1.14.64 1.54L6 15l-1.4 4.6A1.6 1.6 0 0 0 6.13 21.7H8.4l1.3-4.2c.2-.66.8-1.1 1.5-1.1h1.6c.7 0 1.3.44 1.5 1.1l1.3 4.2h2.27a1.6 1.6 0 0 0 1.53-2.1L18 15l2.36-1.96c.4-.4.64-.94.64-1.54 0-1.2-1-2.2-2.2-2.2h-2.38c-.58 0-1.12-.3-1.42-.8l-1.32-1.9c.56-.5.92-1.2.92-2A2.6 2.6 0 0 0 12 2z";
  const pip = (cx, cy) => <circle cx={cx} cy={cy} r="2.4" fill="#0a0d15" />;

  return (
    <svg className="sceneSvg" viewBox="0 0 600 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="sceneGlow" cx="0.5" cy="0.42" r="0.6">
          <stop offset="0%" stopColor="#1a2c48"/>
          <stop offset="55%" stopColor="#101a2e"/>
          <stop offset="100%" stopColor="#080b13"/>
        </radialGradient>
        <linearGradient id="cardFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2940"/>
          <stop offset="100%" stopColor="#141d30"/>
        </linearGradient>
        <filter id="sceneShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#000" floodOpacity="0.45"/>
        </filter>
      </defs>

      {/* base */}
      <rect width="600" height="820" fill="url(#sceneGlow)"/>

      {/* faint hex-tile cluster, top-right */}
      <g opacity="0.5" stroke="rgba(24,136,239,0.4)" strokeWidth="2" fill="none">
        {[[470,90],[524,122],[470,154],[524,186],[416,122],[416,186],[578,154]].map(([x,y],i)=>(
          <polygon key={i} points={hexPoints(x,y,32)} fill={i%3===0?'rgba(24,136,239,0.10)':'transparent'}/>
        ))}
      </g>

      {/* score-track dashed arc */}
      <path d="M40 250 Q 300 140 560 280" fill="none" stroke="rgba(0,174,255,0.22)" strokeWidth="2.5" strokeDasharray="3 12" strokeLinecap="round"/>

      {/* central fanned hand of cards */}
      <g filter="url(#sceneShadow)" transform="translate(330 470)">
        {[
          { r: -26, c: '#1888ef' },
          { r: -13, c: '#00d984' },
          { r: 0,   c: '#f5a623' },
          { r: 13,  c: '#b48cff' },
          { r: 26,  c: '#f31d77' },
        ].map((card, i) => (
          <g key={i} transform={`rotate(${card.r}) translate(0 -14)`}>
            <rect x="-58" y="-90" width="116" height="180" rx="12" fill="url(#cardFace)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5"/>
            <rect x="-58" y="-90" width="116" height="180" rx="12" fill="none" stroke={card.c} strokeWidth="2" opacity="0.55"/>
            {/* corner pips of mosaic */}
            <circle cx="-40" cy="-70" r="7" fill={card.c} opacity="0.9"/>
            <circle cx="40" cy="70" r="7" fill={card.c} opacity="0.9"/>
            {/* center motif */}
            <g transform="translate(0 0)" opacity="0.92">
              <polygon points={`0,-34 30,18 -30,18`} fill={card.c} opacity="0.32"/>
              <circle cx="0" cy="6" r="17" fill="none" stroke={card.c} strokeWidth="3" opacity="0.7"/>
            </g>
          </g>
        ))}
      </g>

      {/* dice */}
      <g filter="url(#sceneShadow)">
        <g transform="translate(122 486) rotate(-14)">
          <rect x="-34" y="-34" width="68" height="68" rx="14" fill="#f1f3f8"/>
          {pip(-13,-13)}{pip(13,-13)}{pip(-13,13)}{pip(13,13)}{pip(0,0)}
        </g>
        <g transform="translate(186 552) rotate(10)">
          <rect x="-26" y="-26" width="52" height="52" rx="11" fill="#00aeff"/>
          <circle cx="-9" cy="-9" r="5.5" fill="#06243a"/>
          <circle cx="9" cy="9" r="5.5" fill="#06243a"/>
        </g>
      </g>

      {/* meeples around */}
      <g filter="url(#sceneShadow)">
        <g transform="translate(476 548) scale(2.4)"><path d={MEEPLE} fill="#f5a623"/></g>
        <g transform="translate(104 610) scale(2.9)"><path d={MEEPLE} fill="#1888ef"/></g>
        <g transform="translate(508 668) scale(2.1)"><path d={MEEPLE} fill="#00d984"/></g>
        <g transform="translate(360 700) scale(2.0)" opacity="0.92"><path d={MEEPLE} fill="#b48cff"/></g>
      </g>

      {/* small scattered tiles bottom-left */}
      <g opacity="0.8" filter="url(#sceneShadow)">
        <rect x="60" y="700" width="56" height="56" rx="9" fill="#15233a" stroke="rgba(243,29,119,0.6)" strokeWidth="2" transform="rotate(-12 88 728)"/>
        <rect x="150" y="724" width="48" height="48" rx="8" fill="#15233a" stroke="rgba(0,217,132,0.6)" strokeWidth="2" transform="rotate(8 174 748)"/>
      </g>
    </svg>
  );
}

function hexPoints(cx, cy, r) {
  let pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

// ─── Rotating live mesa previews ───────────────────────────────
const PREVIEWS = [
  { game: 'Terraforming Mars', host: 'Martina V.', loc: 'Café Rivas · Palermo', initial: 'M', color: '#1888ef', filled: 3, total: 4, when: 'hoy 19:30' },
  { game: 'Catán · Otoño',     host: 'Fede O.',    loc: 'Casa de Fede · Caballito', initial: 'F', color: '#00d984', filled: 3, total: 4, when: 'mañana 21:00' },
  { game: 'Wingspan',          host: 'Cami R.',    loc: 'Bar Notable · Almagro', initial: 'C', color: '#f5a623', filled: 2, total: 4, when: 'jue 20:00' },
];

function PreviewCard({ p }) {
  const open = p.total - p.filled;
  return (
    <div className="authPreviewCard" key={p.game}>
      <div className="authPreviewLabel"><AIcon.Dice size={12}/> Mesa abierta cerca tuyo</div>
      <div className="authPreviewHead">
        <div className="authPreviewAv" style={{ background: p.color }}>{p.initial}</div>
        <div className="authPreviewInfo">
          <div className="authPreviewGame">{p.game}</div>
          <div className="authPreviewMeta">{p.host} · {p.loc}</div>
        </div>
      </div>
      <div className="authPreviewSeatTrack">
        <div className="authPreviewSeatFill" style={{ width: `${(p.filled / p.total) * 100}%` }} />
      </div>
      <div className="authPreviewFoot">
        <span className="authPreviewSeats">{open} {open === 1 ? 'lugar' : 'lugares'}</span>
        <span className="authPreviewWhen">{p.when}</span>
      </div>
    </div>
  );
}

// ─── Showcase pane ─────────────────────────────────────────────
function Showcase({ variant }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % PREVIEWS.length), 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="authShowcase">
      <div className="authShowcaseImg"><ShowcaseScene /></div>
      <div className="authShowcaseVignette" />

      <div className="authShowcaseTop">
        <div className="authShowcaseEyebrow"><span className="dot" /> En vivo · esta semana</div>
        <h2 className="authShowcaseHeadline">
          {variant === 'community'
            ? <>Tu mesa te <em>espera.</em></>
            : <>42 mesas activas <em>en tu zona.</em></>}
        </h2>
        <div className="authStatStrip">
          <div className="authStat"><span className="authStatValue accent">42</span><span className="authStatLabel">Mesas activas</span></div>
          <div className="authStat"><span className="authStatValue">1.2k</span><span className="authStatLabel">Jugadores</span></div>
          <div className="authStat"><span className="authStatValue">8</span><span className="authStatLabel">Eventos próximos</span></div>
        </div>
      </div>

      <div>
        <PreviewCard p={PREVIEWS[idx]} />
        <div className="authPreviewDots">
          {PREVIEWS.map((_, i) => (
            <button key={i} className={`authPreviewDot ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)} aria-label={`Preview ${i+1}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Password strength ─────────────────────────────────────────
function strengthOf(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABELS = ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];

// ─── Brand lockup ──────────────────────────────────────────────
function Brand() {
  return (
    <div className="authBrand">
      <div className="authBrandMark">
        <div className="t"><div className="arm" /><div className="stem" /></div>
        <div className="ring" />
      </div>
      <div className="authBrandText">
        <span className="authBrandName">TurnoCero</span>
        <span className="authBrandSub">◆ board game meetups</span>
      </div>
    </div>
  );
}

// ─── Main app ──────────────────────────────────────────────────
function AuthApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "mode": "login",
    "showcase": "stats",
    "accent": "#1888ef"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [mode, setMode] = useState(t.mode);
  useEffect(() => { setMode(t.mode); }, [t.mode]);

  // shared field state
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [pw, setPw] = useState(mode === 'register' ? '' : 'partida2026');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [color, setColor] = useState('#1888ef');

  const strength = useMemo(() => strengthOf(pw), [pw]);
  const isLogin = mode === 'login';
  const initial = (name.trim()[0] || handle.trim()[0] || '◆').toUpperCase();
  const canRegister = name.trim() && handle.trim() && pw.length >= 8 && terms;

  const setMode2 = (m) => { setMode(m); setTweak('mode', m); if (m === 'register') setPw(''); else setPw('partida2026'); };

  return (
    <div className="app-root" style={{ '--accent': t.accent, '--accent-glow': t.accent + '2e' }}>
      <div className="authStage">

        {/* LEFT · form */}
        <div className="authFormPane">
          <Brand />

          <div className="authBody">
            {/* Mobile hero (only < 900px) */}
            <div className="authMobileHero">
              <div className="authShowcaseEyebrow"><span className="dot" /> En vivo · esta semana</div>
              <h2 className="authShowcaseHeadline">42 mesas activas <em>en tu zona.</em></h2>
              <div className="authMobileHeroStats">
                <div className="authStat"><span className="authStatValue accent">42</span><span className="authStatLabel">Mesas</span></div>
                <div className="authStat"><span className="authStatValue">1.2k</span><span className="authStatLabel">Jugadores</span></div>
              </div>
            </div>

            {/* Toggle */}
            <div className="authSwitch">
              <button className={`authSwitchBtn ${isLogin ? 'active' : ''}`} onClick={() => setMode2('login')}>Iniciar sesión</button>
              <button className={`authSwitchBtn ${!isLogin ? 'active' : ''}`} onClick={() => setMode2('register')}>Crear cuenta</button>
            </div>

            <span className="authEyebrow">{isLogin ? '◆ Bienvenido de vuelta' : '◆ Sumate a la comunidad'}</span>
            <h1 className="authTitle">
              {isLogin ? <>Volvé a la <em>mesa.</em></> : <>Armá tu <em>lugar.</em></>}
            </h1>
            <p className="authSub">
              {isLogin
                ? 'Sumate a tu próxima partida o convocá la tuya.'
                : 'Creá tu cuenta en un minuto y empezá a jugar con gente de tu zona.'}
            </p>

            <div className="authFields">
              {/* Register: nombre */}
              {!isLogin && (
                <div className="authField">
                  <label>Nombre para mostrar</label>
                  <div className="authInputWrap">
                    <span className="lead"><AIcon.User /></span>
                    <input className="authInput" placeholder="Cami Rossi" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Register: @usuario */}
              {!isLogin && (
                <div className="authField">
                  <label>Nombre de usuario</label>
                  <div className="authInputWrap">
                    <span className="handlePrefix">@</span>
                    <input className="authInput" style={{ paddingLeft: 30 }} placeholder="camir" value={handle} onChange={e => setHandle(e.target.value.replace(/\s/g, '').toLowerCase())} />
                  </div>
                </div>
              )}

              {/* Email (both) */}
              <div className="authField">
                <label>{isLogin ? 'Usuario o email' : 'Email'}</label>
                <div className="authInputWrap">
                  <span className="lead"><AIcon.Mail /></span>
                  <input className="authInput" placeholder={isLogin ? 'vos@turnocero.club' : 'vos@email.com'} defaultValue={isLogin ? 'yago@turnocero.club' : ''} />
                </div>
              </div>

              {/* Password (both) */}
              <div className="authField">
                <div className="authLabelRow">
                  <label>Contraseña</label>
                  {isLogin && <button className="authForgot">¿Olvidaste tu contraseña?</button>}
                </div>
                <div className="authInputWrap">
                  <span className="lead"><AIcon.Lock /></span>
                  <input
                    className="authInput"
                    type={showPw ? 'text' : 'password'}
                    placeholder={isLogin ? '••••••••••' : 'Mínimo 8 caracteres'}
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                  />
                  <button className="authReveal" onClick={() => setShowPw(s => !s)} aria-label="Mostrar contraseña">
                    {showPw ? <AIcon.EyeOff /> : <AIcon.Eye />}
                  </button>
                </div>
                {!isLogin && pw.length > 0 && (
                  <div className="authStrength">
                    <div className="authStrengthBars">
                      {[1,2,3,4].map(n => (
                        <span key={n} className={`authStrengthBar ${strength >= n ? 'on' + strength : ''}`} />
                      ))}
                    </div>
                    <span className="authStrengthLabel">Seguridad: {STRENGTH_LABELS[strength] || 'muy débil'}</span>
                  </div>
                )}
              </div>

              {/* Register: avatar color */}
              {!isLogin && (
                <div className="authField">
                  <label>Tu avatar</label>
                  <div className="authAvatarRow">
                    <div className="authAvatarPreview" style={{ background: color }}>{initial}</div>
                    <div className="authSwatches">
                      {SWATCHES.map(c => (
                        <button
                          key={c}
                          className={`authSwatch ${color === c ? 'active' : ''}`}
                          style={{ background: c, color: c }}
                          onClick={() => setColor(c)}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Login: remember */}
              {isLogin && (
                <div className="authRememberRow">
                  <label className="authCheck" onClick={() => setRemember(r => !r)}>
                    <span className={`authCheckBox ${remember ? 'on' : ''}`}><AIcon.Check size={11}/></span>
                    Mantener sesión
                  </label>
                </div>
              )}

              {/* Register: terms */}
              {!isLogin && (
                <label className="authTerms" onClick={() => setTerms(x => !x)}>
                  <span className={`authCheckBox ${terms ? 'on' : ''}`} style={{ marginTop: 1 }}><AIcon.Check size={11}/></span>
                  <span>Acepto los <a onClick={e => e.preventDefault()}>términos</a> y la <a onClick={e => e.preventDefault()}>política de privacidad</a> de TurnoCero.</span>
                </label>
              )}

              {/* Submit */}
              <button className="authSubmit" disabled={!isLogin && !canRegister}>
                <AIcon.Dice size={16} />
                {isLogin ? 'Entrar' : 'Crear mi cuenta'}
              </button>
            </div>

            <div className="authDivider">o continuá con</div>
            <div className="authOauth">
              <button className="authOauthBtn"><AIcon.Google /> Google</button>
              <button className="authOauthBtn"><AIcon.Discord /> Discord</button>
            </div>

            <p className="authFootLine">
              {isLogin
                ? <>¿Todavía no tenés cuenta? <button onClick={() => setMode2('register')}>Crear cuenta →</button></>
                : <>¿Ya tenés cuenta? <button onClick={() => setMode2('login')}>Iniciar sesión →</button></>}
            </p>

            <div className="authLegal">
              <a onClick={e => e.preventDefault()}>Términos</a>
              <a onClick={e => e.preventDefault()}>Privacidad</a>
              <a onClick={e => e.preventDefault()}>Ayuda</a>
            </div>
          </div>
        </div>

        {/* RIGHT · showcase */}
        <Showcase variant={t.showcase} />
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Pantalla" />
        <TweakRadio
          label="Modo"
          value={t.mode}
          onChange={(v) => setMode2(v)}
          options={[
            { value: 'login',    label: 'Login' },
            { value: 'register', label: 'Registro' },
          ]}
        />
        <TweakSection label="Showcase" />
        <TweakRadio
          label="Titular"
          value={t.showcase}
          onChange={(v) => setTweak('showcase', v)}
          options={[
            { value: 'stats',     label: 'Stats' },
            { value: 'community', label: 'Comunidad' },
          ]}
        />
        <TweakSection label="Marca" />
        <TweakRadio
          label="Acento"
          value={t.accent}
          onChange={(v) => setTweak('accent', v)}
          options={[
            { value: '#1888ef', label: 'Azul' },
            { value: '#b48cff', label: 'Violeta' },
            { value: '#00d984', label: 'Verde' },
          ]}
        />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<AuthApp />);
