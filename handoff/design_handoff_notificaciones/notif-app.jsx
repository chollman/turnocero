/* global React, ReactDOM, NIcon, NOTIF_TYPES, NOTIF_FILTERS, NOTIFS, NOTIF_BUCKETS, NOTIF_PREFS, notifTimeAgo, notifBucket */
/* global TweaksPanel, TweakSection, TweakRadio, TweakToggle, useTweaks */
const { useState, useMemo } = React;

// ─── Single notification row ───────────────────────────────────
function NotifRow({ n, i, density, onResolve, onMarkRead, onDismiss }) {
  const meta = NOTIF_TYPES[n.type];
  const DomainIcon = NIcon[meta.icon];
  const isActionable = !!n.action && !n.resolved;

  const rowClass = [
    'notifRow',
    n.unread && 'unread',
    isActionable && 'actionable',
  ].filter(Boolean).join(' ');

  // Left visual: grouped avatars / single actor avatar+pip / domain icon
  let leftVisual;
  if (n.grouped && n.actors.length > 1) {
    const shown = n.actors.slice(0, 3);
    const extra = (n.actors.length - shown.length) + (n.extraCount || 0);
    leftVisual = (
      <div className="notifGroupWrap">
        <div className="notifGroupAvatars">
          {shown.map((a, j) => (
            <div key={j} className="gAv" style={{ background: a.color }}>{a.initial}</div>
          ))}
          {extra > 0 && <div className="gAv more">+{extra}</div>}
        </div>
        <div className="notifGroupPip"><DomainIcon size={12} /></div>
      </div>
    );
  } else if (n.system) {
    leftVisual = <div className="notifIcon"><DomainIcon size={19} /></div>;
  } else {
    const a = n.actors[0];
    leftVisual = (
      <div className="notifAvatarStack">
        <div className="mainAv" style={{ background: a.color }}>{a.initial}</div>
        <div className="domainPip" style={{ background: meta.color }}><DomainIcon size={11} /></div>
      </div>
    );
  }

  return (
    <div className={rowClass} style={{ '--rowColor': meta.color, '--i': i }}>
      {leftVisual}

      <div className="notifBody">
        <div className="notifTopline">
          {n.unread && <span className="unreadDot" />}
          <span className="notifDomainTag">{meta.label}</span>
          {n.target && <span className="notifTarget">{n.target}</span>}
          {n.badge && <span className="notifCountBadge">{n.badge}</span>}
          <span className="notifTime">{notifTimeAgo(n.date)}</span>
        </div>
        <span className="notifTitle">{n.title}</span>
        {density !== 'compact' && n.body && (
          <span className={`notifText ${n.body.startsWith('"') ? 'quote' : ''}`}>{n.body}</span>
        )}

        {/* Inline actions */}
        {isActionable ? (
          <div className="notifRowActions">
            <button className="notifBtnReject" onClick={() => onResolve(n.id, 'reject')}>
              {n.action === 'evento_pending' ? 'Después' : 'Rechazar'}
            </button>
            <button className="notifBtnAccept" onClick={() => onResolve(n.id, 'accept')}>
              <NIcon.Check size={12} />
              {n.action === 'evento_pending' ? 'Revisar' : 'Aceptar'}
            </button>
          </div>
        ) : n.cta ? (
          <div className="notifRowActions">
            <button className="notifBtnGhost">{n.cta} <NIcon.Arrow size={12} /></button>
          </div>
        ) : null}
      </div>

      {/* Hover affordances */}
      <div className="notifHoverActions">
        {n.unread && (
          <button className="notifHoverBtn" title="Marcar leída" onClick={() => onMarkRead(n.id)}>
            <NIcon.Check size={12} />
          </button>
        )}
        <button className="notifHoverBtn" title="Descartar" onClick={() => onDismiss(n.id)}>
          <NIcon.X size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Resolved (post-action) inline confirmation ────────────────
function ResolvedRow({ n, verb }) {
  const meta = NOTIF_TYPES[n.type];
  const color = verb === 'accept' ? '#00d984' : '#5a6178';
  return (
    <div className="notifRow" style={{ '--rowColor': color, opacity: 0.7 }}>
      <div className="notifIcon" style={{ '--rowColor': color }}>
        {verb === 'accept' ? <NIcon.Check size={19} /> : <NIcon.X size={19} />}
      </div>
      <div className="notifBody">
        <div className="notifTopline">
          <span className="notifDomainTag" style={{ color }}>{meta.label}</span>
          <span className="notifTime">recién</span>
        </div>
        <span className="notifTitle">
          {verb === 'accept'
            ? (n.action === 'friend_request' ? `Ahora sos amigo de ${n.actors[0].name}`
               : n.action === 'evento_pending' ? 'Abriendo revisión de inscripciones…'
               : `Aceptaste a ${n.actors[0].name} en ${n.target}`)
            : 'Listo, lo descartamos'}
        </span>
      </div>
    </div>
  );
}

// ─── Side panel: daily digest + preferences ────────────────────
function SidePanel({ counts, prefs, setPref }) {
  const total = NOTIFS.length;
  const breakdown = useMemo(() => {
    const m = {};
    NOTIFS.forEach(n => { m[n.type] = (m[n.type] || 0) + 1; });
    const max = Math.max(...Object.values(m));
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([type, c]) => ({ type, c, pct: (c / max) * 100, meta: NOTIF_TYPES[type] }));
  }, []);

  return (
    <aside className="notifSide">
      {/* Digest */}
      <div className="sideCard">
        <div className="digestHead">
          <div className="digestEyebrow">◆ Resumen · sáb 30 may</div>
          <div className="digestTitle">Tu día en TurnoCero</div>
        </div>
        <div className="digestStats">
          <div className="digestStat">
            <span className="digestStatValue red">{counts.unread}</span>
            <span className="digestStatLabel">Sin leer</span>
          </div>
          <div className="digestStat">
            <span className="digestStatValue orange">{counts.actionable}</span>
            <span className="digestStatLabel">Requieren acción</span>
          </div>
          <div className="digestStat">
            <span className="digestStatValue accent">{counts.today}</span>
            <span className="digestStatLabel">Hoy</span>
          </div>
          <div className="digestStat">
            <span className="digestStatValue green">{total}</span>
            <span className="digestStatLabel">Total activas</span>
          </div>
        </div>
        <div className="digestBreakdown">
          {breakdown.map(b => {
            const Ico = NIcon[b.meta.icon];
            return (
              <div key={b.type} className="breakdownRow" style={{ '--bdColor': b.meta.color }}>
                <span className="breakdownIcon"><Ico size={13} /></span>
                <span className="breakdownTrack"><span className="breakdownFill" style={{ width: `${b.pct}%` }} /></span>
                <span className="breakdownCount">{b.c}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preferences */}
      <div className="sideCard prefCard">
        <div className="prefHead">
          <div className="prefHeadTitle"><NIcon.Gear size={14} /> Preferencias</div>
          <button className="prefHeadLink">Ver todas</button>
        </div>
        <div className="prefTableHead">
          <span>Categoría</span>
          <span>Push</span>
          <span>Email</span>
        </div>
        {prefs.map((p, i) => {
          const meta = NOTIF_TYPES[p.type];
          return (
            <div key={p.type} className="prefRow">
              <div className="prefRowLabel">
                <span className="prefRowDot" style={{ background: meta.color }} />
                <span className="prefRowName">{meta.label}</span>
              </div>
              <div className="prefToggleCell">
                <button className={`prefToggle ${p.push ? 'on' : ''}`} onClick={() => setPref(i, 'push')} aria-label="push" />
              </div>
              <div className="prefToggleCell">
                <button className={`prefToggle ${p.email ? 'on' : ''}`} onClick={() => setPref(i, 'email')} aria-label="email" />
              </div>
            </div>
          );
        })}
        <div className="quietNote">
          <span className="moon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </span>
          <span><strong>Horario tranquilo</strong> activo · 23:00 – 08:00. No te molestamos de noche.</span>
        </div>
      </div>
    </aside>
  );
}

// ─── Main app ──────────────────────────────────────────────────
function NotifApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "density": "comfy",
    "accent": "#1888ef"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState(NOTIFS);
  const [resolved, setResolved] = useState({}); // id -> verb
  const [prefs, setPrefs] = useState(NOTIF_PREFS);

  const setPref = (i, key) => {
    setPrefs(prefs.map((p, j) => j === i ? { ...p, [key]: !p[key] } : p));
  };

  const markRead = (id) => setItems(items.map(n => n.id === id ? { ...n, unread: false } : n));
  const markAllRead = () => setItems(items.map(n => ({ ...n, unread: false })));
  const dismiss = (id) => setItems(items.filter(n => n.id !== id));
  const resolve = (id, verb) => {
    setResolved({ ...resolved, [id]: verb });
    setTimeout(() => {
      setItems(prev => prev.map(n => n.id === id ? { ...n, unread: false, resolved: true } : n));
    }, 1800);
  };

  // Counts
  const counts = useMemo(() => ({
    all: items.length,
    unread: items.filter(n => n.unread).length,
    actionable: items.filter(n => n.action && !n.resolved).length,
    today: items.filter(n => notifBucket(n.date) === 'today').length,
    mesa: items.filter(n => n.type === 'mesa').length,
    evento: items.filter(n => n.type === 'evento').length,
    torneo: items.filter(n => n.type === 'torneo').length,
    amigo: items.filter(n => n.type === 'amigo').length,
    compartida: items.filter(n => n.type === 'compartida').length,
    sistema: items.filter(n => n.type === 'sistema' || n.type === 'noticia' || n.type === 'bgwatch').length,
  }), [items]);

  // Apply filter
  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter(n => n.unread);
    if (filter === 'actionable') return items.filter(n => n.action && !n.resolved);
    if (filter === 'sistema') return items.filter(n => ['sistema', 'noticia', 'bgwatch'].includes(n.type));
    return items.filter(n => n.type === filter);
  }, [items, filter]);

  // Group by time bucket
  const groups = useMemo(() => {
    const m = new Map();
    NOTIF_BUCKETS.forEach(b => m.set(b.key, []));
    filtered.forEach(n => {
      const b = notifBucket(n.date);
      if (m.has(b)) m.get(b).push(n);
    });
    return NOTIF_BUCKETS
      .map(b => ({ ...b, items: m.get(b.key) || [] }))
      .filter(g => g.items.length > 0);
  }, [filtered]);

  let globalIdx = 0;

  return (
    <div className="app-root" style={{ '--accent': t.accent, '--accent-glow': t.accent + '2e' }}>
      <div className="app-shell">
        <div className="switcher">
          <div className="switcherLogo"><span>◆</span><span>turnocero</span></div>
          <div className="switcherCrumb">Notificaciones · Reimagined</div>
          <div className="switcherSpacer" />
          <span className="switcherPill">v2 · reimaginación</span>
        </div>

        <div className="page">
          <div className="notifLayout">
            <div className="notifMain">
              {/* Hero */}
              <div className="notifHero">
                <div className="notifHeroLeft">
                  <div className="notifHeroEyebrow">
                    <span className="liveDot" />
                    Bandeja · {counts.unread} sin leer
                  </div>
                  <h1 className="notifHeroTitle">Tu <em>actividad.</em></h1>
                </div>
                <div className="notifHeroActions">
                  <button className="notifActionBtn" onClick={markAllRead}>
                    <NIcon.DoubleCheck size={14} /> Marcar todas
                  </button>
                  <button className="notifActionBtn primary">
                    <NIcon.Gear size={14} /> Preferencias
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="notifFilters">
                {NOTIF_FILTERS.map(f => {
                  const c = counts[f.value] ?? 0;
                  const isAlert = f.value === 'actionable';
                  return (
                    <button
                      key={f.value}
                      className={`notifChip ${filter === f.value ? 'active' : ''} ${isAlert && c > 0 ? 'alert' : ''}`}
                      onClick={() => setFilter(f.value)}
                    >
                      {f.label}
                      {c > 0 && <span className="chipCount">· {c}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Feed */}
              {groups.length === 0 ? (
                <div className="notifEmpty">
                  <div className="notifEmptyIcon"><NIcon.Inbox size={28} /></div>
                  <div className="notifEmptyTitle">Bandeja al día</div>
                  <div className="notifEmptyText">No hay notificaciones para este filtro</div>
                </div>
              ) : (
                groups.map(g => (
                  <section key={g.key}>
                    <div className="bucketHeader">
                      <span className="bucketLabel">{g.label}</span>
                      <span className="bucketRule" />
                      <span className="bucketCount">{g.items.length}</span>
                    </div>
                    <div className="notifList">
                      {g.items.map(n => {
                        const idx = globalIdx++;
                        if (resolved[n.id]) {
                          return <ResolvedRow key={n.id} n={n} verb={resolved[n.id]} />;
                        }
                        return (
                          <NotifRow
                            key={n.id}
                            n={n}
                            i={idx}
                            density={t.density}
                            onResolve={resolve}
                            onMarkRead={markRead}
                            onDismiss={dismiss}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>

            <SidePanel counts={counts} prefs={prefs} setPref={setPref} />
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Bandeja" />
        <TweakRadio
          label="Densidad"
          value={t.density}
          onChange={(v) => setTweak('density', v)}
          options={[
            { value: 'compact', label: 'Compacta' },
            { value: 'comfy',   label: 'Cómoda' },
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
        <TweakSection label="Demo" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <button onClick={() => setFilter('actionable')} style={demoBtn(filter === 'actionable')}>Ver accionables</button>
          <button onClick={() => { setItems(NOTIFS); setResolved({}); setFilter('all'); }} style={demoBtn(false)}>Reset bandeja</button>
        </div>
      </TweaksPanel>
    </div>
  );
}

function demoBtn(active) {
  return {
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
    padding: '7px 10px', borderRadius: 6,
    fontFamily: 'var(--font-mono)', fontSize: 10,
    letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
  };
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<NotifApp />);
