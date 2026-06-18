/* global React, ReactDOM, Icon, Switcher */
/* global TweaksPanel, TweakSection, TweakRadio, TweakToggle, useTweaks */
const { useState, useEffect, useRef, useCallback } = React;

// ─── Local icons not in tc-shared ──────────────────────────────
const Moon = (p = {}) => <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
const Sun = (p = {}) => <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>;
const Bell = (p = {}) => <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;

// ─── Mock account ──────────────────────────────────────────────
const ACCOUNT = {
  username: 'camir',
  email: 'cami.rossi@gmail.com',
  displayName: 'Cami Rossi',
  nombre: 'Camila',
  apellido: 'Rossi',
  telegram: 'camir',
  celular: '+54 9 11 5512-3344',
  bggUsername: 'camir',
  direccionTexto: 'Av. Santa Fe 3253, Palermo, CABA',
  lat: -34.5889, lng: -58.4106,
  bggConnectedAt: '2024-11-02',
  bggLastFull: 'hace 2 d · 87 partidas',
  bggLastProbe: 'hace 4 h · ✓ Sin cambios',
  bgw: { partidas: 87, juegos: 138, ultima: '14 may 2026' },
};

const AVATAR_COLORS = ['#1888ef', '#f5a623', '#b48cff', '#00d984', '#f31d77', '#00aeff'];

const COMMUNITIES = [
  { id: 'base', name: 'Turnocero', isBase: true, role: 'member' },
  { id: 'c2', name: 'Dados de Palermo', isBase: false, role: 'subadmin' },
  { id: 'c3', name: 'Ludoteca Sur', isBase: false, role: 'member' },
];

const SECTIONS = [
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'avatar', label: 'Avatar' },
  { id: 'datos', label: 'Datos personales' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'bgg', label: 'BoardGameGeek' },
  { id: 'comunidades', label: 'Comunidades' },
  { id: 'ubicacion', label: 'Ubicación' },
  { id: 'recordatorios', label: 'Recordatorios' },
];

// ─── Custom controls ───────────────────────────────────────────
const Check = ({ on }) => <span className={`cbox ${on ? 'on' : ''}`}>{on && <Icon.Check size={11} />}</span>;
const Radio = ({ on }) => <span className={`rdo ${on ? 'on' : ''}`} />;

// ─── Index rail with click-scroll + scrollspy ──────────────────
function Rail({ active, onJump, saving, saved, onSave }) {
  return (
    <div className="railWrap">
      <nav className="railNav">
        {SECTIONS.map(s => (
          <button key={s.id} className={`railItem ${active === s.id ? 'active' : ''}`} onClick={() => onJump(s.id)}>
            <span className="railDot" /> {s.label}
          </button>
        ))}
      </nav>
      <button className="railSave" disabled={saving} onClick={onSave}>
        {saving ? 'Guardando…' : <><Icon.Check size={14} /> Guardar cambios</>}
      </button>
      {saved && <div className="railSaved">✓ Perfil guardado</div>}
    </div>
  );
}

// ─── BGG connection panel ──────────────────────────────────────
function BggPanel({ state, setState, username }) {
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState('');

  const connect = () => {
    if (!pass) return;
    setBusy(true);
    setTimeout(() => { setState('connected'); setPass(''); setBusy(false); }, 500);
  };
  const disconnect = () => { setState('disconnected'); setSynced(''); };
  const sync = () => {
    setBusy(true);
    setTimeout(() => { setSynced('Reconciliadas 87 partidas (2 nuevas, 1 actualizada)'); setBusy(false); }, 700);
  };

  return (
    <div className="sec fadeIn" id="bgg">
      <div className="secHead"><span className="secNum">06</span><h2 className="secTitle">Conexión con BoardGameGeek</h2></div>
      <p className="secHint">Conectá tu cuenta de BGG para cargar, editar y eliminar partidas directamente desde Turnocero. Tu password se guarda cifrada (AES-256-GCM) y nunca se envía al navegador.</p>

      <div className="bggWarn">⚠️ Usamos el endpoint interno de BGG (no oficial). Si BGG cambia su web, la integración puede dejar de funcionar hasta una actualización. Podés desconectar cuando quieras.</div>

      {state === 'none' && (
        <p className="secHint" style={{ margin: 0 }}>Primero configurá tu <strong style={{ color: 'var(--text-primary)' }}>Usuario en BGG</strong> arriba y guardá el perfil.</p>
      )}

      {state === 'connected' && (
        <>
          <div className="bggStatusGrid">
            <div className="bggStatusCell"><span className="bggStatusLabel">Conectado como</span><span className="bggStatusValue green">@{username}</span></div>
            <div className="bggStatusCell"><span className="bggStatusLabel">Desde</span><span className="bggStatusValue">2 nov 2024</span></div>
            <div className="bggStatusCell"><span className="bggStatusLabel">Última reconciliación</span><span className="bggStatusValue">{ACCOUNT.bggLastFull}</span></div>
            <div className="bggStatusCell"><span className="bggStatusLabel">Última verificación</span><span className="bggStatusValue">{ACCOUNT.bggLastProbe}</span></div>
          </div>
          <p className="bggSyncHint">Tu historial se actualiza automáticamente cuando entrás a BG Watch. Reconciliá manualmente sólo si editaste partidas viejas en BGG.com.</p>
          <div className="bggActions">
            <button className="btnPrimary" disabled={busy} onClick={sync}>{busy ? 'Reconciliando…' : <><Icon.Refresh size={14} /> Reconciliar todo</>}</button>
            <button className="btnGhost" disabled={busy} onClick={disconnect}>Desconectar</button>
          </div>
          {synced && <div className="toastNote ok">{synced}</div>}
        </>
      )}

      {(state === 'disconnected' || state === 'invalid') && (
        <>
          {state === 'invalid' && <div className="bggInvalid">Tu sesión BGG caducó (probablemente cambiaste el password en BGG.com). Reingresá tu password para reconectar.</div>}
          <div className="connForm">
            <div className="field">
              <label className="label">Password de BGG para @{username}</label>
              <div className="passWrap">
                <input className="input" type={show ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} placeholder="Tu password de BoardGameGeek" />
                <button type="button" className="passToggle" onClick={() => setShow(s => !s)}>{show ? 'OCULTAR' : 'VER'}</button>
              </div>
            </div>
            <button className="btnPrimary" disabled={busy || !pass} onClick={connect}>{busy ? 'Validando…' : state === 'invalid' ? 'Reconectar' : 'Conectar'}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────
function CuentaApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "bggState": "connected",
    "hasAvatar": false,
    "pushState": "available",
    "theme": "dark"
  }/*EDITMODE-END*/;

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [form, setForm] = useState({ ...ACCOUNT });
  const [avatarColor, setAvatarColor] = useState('#f5a623');
  const [theme, setTheme] = useState(t.theme);
  const [pushOn, setPushOn] = useState(false);
  const [bgg, setBgg] = useState(t.bggState);
  const [active, setActive] = useState('apariencia');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(false);
  const [viewing, setViewing] = useState(new Set());
  const [skin, setSkin] = useState('base');

  useEffect(() => { setBgg(t.bggState); }, [t.bggState]);
  useEffect(() => { setTheme(t.theme); }, [t.theme]);

  const ch = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const jump = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80);
    // Native smooth-scroll is ignored in some embeds — animate manually via rAF.
    const start = window.scrollY;
    const dist = target - start;
    if (Math.abs(dist) < 2) { window.scrollTo(0, target); return; }
    const dur = 420;
    const t0 = performance.now();
    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, start + dist * ease(p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  // scrollspy
  useEffect(() => {
    const onScroll = () => {
      let cur = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 120) cur = s.id;
      }
      setActive(cur);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const save = () => {
    setSaving(true); setSaved(false);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }, 600);
  };

  const toggleViewing = (id) => setViewing(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const hasUsername = bgg !== 'none';
  const connected = bgg === 'connected';
  const initial = form.displayName?.charAt(0)?.toUpperCase() || 'C';

  return (
    <div className="app-root">
      <Switcher crumb="Mi Perfil · Reimagined" tabs={[{ id: 'cuenta', label: 'Mi cuenta' }]} active="cuenta" onTab={() => {}} pill="v2 · configuración" />

      <div className="page cuenta">
        {/* Identity header */}
        <div className="acctHead fadeIn">
          <div className="acctAvatar" style={{ background: t.hasAvatar ? 'var(--bg-elevated)' : avatarColor }}>
            {t.hasAvatar ? <Icon.Image size={30} /> : initial}
          </div>
          <div className="acctIdent">
            <div className="acctEyebrow">◆ Mi perfil</div>
            <h1 className="acctName">
              @{form.username}
              {connected && <span className="bgwChip"><Icon.Dice size={11} /> BG Watch <span className="check">✓</span></span>}
            </h1>
            <p className="acctEmail">{form.email}</p>
          </div>
        </div>

        <div className="acctLayout">
          <div className="acctContent">
            {/* BG Watch band OR promo */}
            {connected ? (
              <div className="bgwBand fadeIn">
                <div className="bgwAvatar">{form.bggUsername.charAt(0).toUpperCase()}<span className="die"><Icon.Dice size={12} /></span></div>
                <div className="bgwInfo">
                  <div className="bgwKicker"><Icon.Dice size={11} /> Mi BG Watch</div>
                  <div className="bgwUser">@{form.bggUsername}</div>
                  <div className="bgwConn"><span className="dot" /> Conectado a BoardGameGeek</div>
                </div>
                <div className="bgwStats">
                  <div className="bgwStat"><span className="bgwStatV">{ACCOUNT.bgw.partidas}</span><span className="bgwStatL">Partidas</span></div>
                  <div className="bgwStat"><span className="bgwStatV">{ACCOUNT.bgw.juegos}</span><span className="bgwStatL">Colección</span></div>
                  <span className="bgwGo">Ver completo <Icon.ChevronR size={14} /></span>
                </div>
              </div>
            ) : !hasUsername && !promoDismissed ? (
              <div className="promo fadeIn">
                <span className="promoIcon"><Icon.Dice size={20} /></span>
                <div className="promoBody">
                  <div className="promoTitle">¿Llevás partidas en BoardGameGeek?</div>
                  <div className="promoSub">Activá BG Watch para registrar todas tus partidas desde Turnocero.</div>
                </div>
                <button className="promoCta" onClick={() => jump('bgg')}>Activá ahora →</button>
                <button className="promoX" onClick={() => setPromoDismissed(true)} aria-label="Ocultar">✕</button>
              </div>
            ) : null}

            {/* 01 Apariencia */}
            <div className="sec fadeIn" id="apariencia">
              <div className="secHead"><span className="secNum">01</span><h2 className="secTitle">Apariencia</h2></div>
              <p className="secHint">Elegí cómo querés ver Turnocero. Tu preferencia se guarda en este dispositivo.</p>
              <div className="themeToggle">
                <button className={`themeOpt ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}><Moon /> Oscuro</button>
                <button className={`themeOpt ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}><Sun /> Claro</button>
              </div>
            </div>

            {/* 02 Notificaciones */}
            <div className="sec fadeIn" id="notificaciones">
              <div className="secHead"><span className="secNum">02</span><h2 className="secTitle">Notificaciones push</h2></div>
              <p className="secHint">Recibí un aviso en este dispositivo cuando pase algo importante (un mensaje, una solicitud, un recordatorio), aunque Turnocero esté cerrada.</p>
              {t.pushState === 'unsupported' ? (
                <p className="secHint" style={{ margin: 0, color: 'var(--text-muted)' }}>Tu navegador no soporta notificaciones push.</p>
              ) : t.pushState === 'denied' ? (
                <p className="secHint" style={{ margin: 0, color: 'var(--orange)' }}>Bloqueaste las notificaciones. Habilitalas desde la configuración del navegador para este sitio.</p>
              ) : pushOn ? (
                <button className="btnGhost" onClick={() => setPushOn(false)}><Bell size={14} /> Desactivar notificaciones</button>
              ) : (
                <button className="btnPrimary" onClick={() => setPushOn(true)}><Bell size={14} /> Activar notificaciones</button>
              )}
            </div>

            {/* 03 Avatar */}
            <div className="sec fadeIn" id="avatar">
              <div className="secHead"><span className="secNum">03</span><h2 className="secTitle">Avatar</h2></div>
              <p className="secHint">Subí una foto cuadrada para que te identifiquen en mesas, comentarios y chats.</p>
              <div className="avatarRow">
                <div className="avatarBig" style={{ background: t.hasAvatar ? 'var(--bg-elevated)' : avatarColor }}>
                  {t.hasAvatar ? <Icon.Image size={32} /> : initial}
                </div>
                <div className="avatarActions">
                  <button className="btnGhost">{t.hasAvatar ? 'Cambiar avatar' : 'Subir avatar'}</button>
                  {t.hasAvatar && <button className="btnGhost">Quitar avatar</button>}
                </div>
              </div>
              {!t.hasAvatar && (
                <div className="colorBlock">
                  <div className="label">Color del avatar</div>
                  <p className="secHint" style={{ margin: '6px 0 0' }}>Mientras no subas una foto, tu inicial se muestra sobre este color.</p>
                  <div className="swatches">
                    <span className={`swatch auto ${avatarColor === 'auto' ? 'sel' : ''}`} onClick={() => setAvatarColor('auto')}>AUTO</span>
                    {AVATAR_COLORS.map(c => (
                      <span key={c} className={`swatch ${avatarColor === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setAvatarColor(c)} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 04 Datos personales */}
            <div className="sec fadeIn" id="datos">
              <div className="secHead"><span className="secNum">04</span><h2 className="secTitle">Información personal</h2></div>
              <div className="field" style={{ marginTop: 8 }}>
                <label className="label">Nombre para mostrar</label>
                <input className="input" name="displayName" value={form.displayName} onChange={ch} placeholder="Como querés que te vean otros usuarios" />
              </div>
              <div className="twoCol">
                <div className="field"><label className="label">Nombre</label><input className="input" name="nombre" value={form.nombre} onChange={ch} placeholder="Tu nombre" /></div>
                <div className="field"><label className="label">Apellido</label><input className="input" name="apellido" value={form.apellido} onChange={ch} placeholder="Tu apellido" /></div>
              </div>
            </div>

            {/* 05 Contacto */}
            <div className="sec fadeIn" id="contacto">
              <div className="secHead"><span className="secNum">05</span><h2 className="secTitle">Contacto</h2></div>
              <div className="twoCol" style={{ marginTop: 8 }}>
                <div className="field">
                  <label className="label">Telegram</label>
                  <div className="inputPrefix"><span className="prefix">@</span><input className="input inputWithPrefix" name="telegram" value={form.telegram} onChange={ch} placeholder="tu_usuario" /></div>
                </div>
                <div className="field"><label className="label">Celular</label><input className="input" name="celular" value={form.celular} onChange={ch} placeholder="+54 9 11 1234-5678" /></div>
              </div>
              <div className="field">
                <label className="label">Usuario en BGG</label>
                <div className="inputPrefix"><span className="prefix">BGG</span><input className="input inputWithPrefix" name="bggUsername" value={form.bggUsername} onChange={ch} placeholder="tu_usuario_bgg" /></div>
              </div>
            </div>

            {/* 06 BGG connection */}
            <BggPanel state={bgg} setState={setBgg} username={form.bggUsername || ACCOUNT.bggUsername} />

            {/* 07 Comunidades */}
            <div className="sec fadeIn" id="comunidades">
              <div className="secHead"><span className="secNum">07</span><h2 className="secTitle">Comunidades</h2></div>
              <p className="secHint">Elegí qué comunidades ver en conjunto y cuál usar para el aspecto del sitio.</p>
              <div className="commList">
                {COMMUNITIES.map(c => (
                  <div className="commRow" key={c.id}>
                    <label className="commCheck" onClick={() => toggleViewing(c.id)}>
                      <Check on={viewing.has(c.id)} />
                      <span className="commName">{c.name}</span>
                      {c.role === 'subadmin' && <span className="roleTag">Subadmin</span>}
                    </label>
                    <label className="skinRadio" onClick={() => setSkin(c.id)}>
                      <Radio on={skin === c.id} /> Skin
                    </label>
                    {!c.isBase && <button className="commLeave">Salir</button>}
                  </div>
                ))}
              </div>
              <p className="commNote">Si no marcás ninguna en "ver juntas", ves todas.</p>
            </div>

            {/* 08 Ubicación */}
            <div className="sec fadeIn" id="ubicacion">
              <div className="secHead"><span className="secNum">08</span><h2 className="secTitle">Dirección</h2></div>
              <p className="secHint">Empezá a escribir y elegí una opción del menú, o cliqueá en el mapa para marcar tu ubicación.</p>
              <div className="geoRow">
                <input className="input" name="direccionTexto" value={form.direccionTexto} onChange={ch} placeholder="Ej: Av. Corrientes 1234, Buenos Aires" />
                <button className="btnGhost">Buscar</button>
              </div>
              {form.lat && <p className="coords">📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</p>}
              <div className="mapPh">
                <Icon.Pin size={34} className="mapPin" />
                <span className="mapNote">mapa interactivo · arrastrá el marcador</span>
              </div>
            </div>

            {/* 09 Recordatorios */}
            <div className="sec fadeIn" id="recordatorios">
              <div className="secHead"><span className="secNum">09</span><h2 className="secTitle">Recordatorios de eventos</h2></div>
              <p className="secHint">Cuándo querés que te avisemos sobre los eventos donde estás inscripto. Aplica sólo a eventos pagos o con cupo confirmado.</p>
              <div className="field" style={{ maxWidth: 280 }}>
                <label className="label">Avisarme</label>
                <select className="input" defaultValue="24">
                  <option value="24">24 horas antes</option>
                  <option value="2">2 horas antes</option>
                  <option value="0">No quiero recordatorios</option>
                </select>
              </div>
            </div>
          </div>

          <Rail active={active} onJump={jump} saving={saving} saved={saved} onSave={save} />
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Estado de la cuenta" />
        <TweakRadio label="Conexión BGG" value={t.bggState}
          options={[{ value: 'none', label: 'Sin usuario' }, { value: 'disconnected', label: 'Sin conectar' }, { value: 'connected', label: 'Conectado' }, { value: 'invalid', label: 'Caducó' }]}
          onChange={(v) => setTweak('bggState', v)} />
        <TweakToggle label="Tiene foto de avatar" value={t.hasAvatar} onChange={(v) => setTweak('hasAvatar', v)} />
        <TweakSection label="Dispositivo" />
        <TweakRadio label="Push" value={t.pushState}
          options={[{ value: 'available', label: 'Disponible' }, { value: 'denied', label: 'Bloqueado' }, { value: 'unsupported', label: 'No soporta' }]}
          onChange={(v) => setTweak('pushState', v)} />
        <TweakRadio label="Tema" value={t.theme}
          options={[{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }]}
          onChange={(v) => setTweak('theme', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<CuentaApp />);
