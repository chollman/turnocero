/* global React, ReactDOM, TweaksPanel, TweakSection, TweakRadio, useTweaks */
const { useState } = React;

// ─── Icons ─────────────────────────────────────────────────────
const EIcon = {
  Home:    (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>,
  Back:    (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Retry:   (p={}) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Dice:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="8" cy="16" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/></svg>,
  Calendar:(p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Heart:   (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Mail:    (p={}) => <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>,
};

// ─── Brand lockup ──────────────────────────────────────────────
function Brand() {
  return (
    <div className="errBrand">
      <div className="errBrandMark">
        <div className="t"><div className="arm" /><div className="stem" /></div>
        <div className="ring" />
      </div>
      <span className="errBrandName">TurnoCero</span>
    </div>
  );
}

// ─── Scattered backdrop pieces ─────────────────────────────────
function meeple(fill, op = 1) {
  return <path d="M12 2c1.5 0 2.7 1.2 2.7 2.7 0 1-.5 1.8-1.3 2.3 2 .6 3.4 1.7 4 3.3l1.3 4c.2.7-.2 1.4-.9 1.6-.7.2-1.4-.2-1.6-.9l-.6-1.9V21a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-3h-.4v3a1 1 0 0 1-1 1H9.4a1 1 0 0 1-1-1v-7.8l-.6 1.9c-.2.7-.9 1.1-1.6.9-.7-.2-1.1-.9-.9-1.6l1.3-4c.6-1.6 2-2.7 4-3.3-.8-.5-1.3-1.3-1.3-2.3C9.3 3.2 10.5 2 12 2z" fill={fill} opacity={op}/>;
}

function Backdrop({ is500 }) {
  return (
    <div className="errBackdrop">
      {/* hex tile top-left */}
      <svg className="errPiece" style={{ top: '12%', left: '10%', '--r': '-8deg' }} width="90" height="90" viewBox="0 0 100 100">
        <polygon points="50,5 90,28 90,72 50,95 10,72 10,28" fill="none" stroke={is500 ? '#f5a623' : '#1888ef'} strokeWidth="2" opacity="0.5"/>
        <polygon points="50,22 73,35 73,65 50,78 27,65 27,35" fill={is500 ? 'rgba(245,166,35,0.08)' : 'rgba(24,136,239,0.08)'}/>
      </svg>
      {/* die top-right */}
      <svg className="errPiece" style={{ top: '16%', right: '12%', '--r': '12deg' }} width="64" height="64" viewBox="0 0 40 40">
        <rect x="3" y="3" width="34" height="34" rx="7" fill="#151c28" stroke={is500 ? '#f31d77' : '#00aeff'} strokeWidth="1.5"/>
        <circle cx="13" cy="13" r="2.4" fill={is500 ? '#f31d77' : '#00aeff'}/>
        <circle cx="27" cy="13" r="2.4" fill={is500 ? '#f31d77' : '#00aeff'}/>
        <circle cx="20" cy="20" r="2.4" fill={is500 ? '#f31d77' : '#00aeff'}/>
        <circle cx="13" cy="27" r="2.4" fill={is500 ? '#f31d77' : '#00aeff'}/>
        <circle cx="27" cy="27" r="2.4" fill={is500 ? '#f31d77' : '#00aeff'}/>
      </svg>
      {/* meeple mid-left */}
      <svg className="errPiece" style={{ top: '58%', left: '7%', '--r': '6deg' }} width="46" height="46" viewBox="0 0 24 24">{meeple('#00d984', 0.5)}</svg>
      {/* meeple bottom-right */}
      <svg className="errPiece" style={{ bottom: '14%', right: '9%', '--r': '-14deg' }} width="54" height="54" viewBox="0 0 24 24">{meeple('#b48cff', 0.45)}</svg>
      {/* small card bottom-left */}
      <svg className="errPiece" style={{ bottom: '12%', left: '14%', '--r': '10deg' }} width="50" height="68" viewBox="0 0 50 68">
        <rect x="2" y="2" width="46" height="64" rx="6" fill="#151c28" stroke={is500 ? '#f5a623' : '#1888ef'} strokeWidth="1.5" opacity="0.6"/>
        <circle cx="12" cy="12" r="3" fill={is500 ? '#f5a623' : '#1888ef'} opacity="0.6"/>
        <circle cx="38" cy="56" r="3" fill={is500 ? '#f5a623' : '#1888ef'} opacity="0.6"/>
      </svg>
      {/* meeple top-mid */}
      <svg className="errPiece" style={{ top: '8%', left: '46%', '--r': '-5deg' }} width="38" height="38" viewBox="0 0 24 24">{meeple('#f5a623', 0.4)}</svg>
    </div>
  );
}

// ─── Hero: 404 — die showing "?" landed off the board ──────────
function Hero404() {
  return (
    <div className="errHero">
      <svg viewBox="0 0 200 160">
        <defs>
          <linearGradient id="die404" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1d2532"/>
            <stop offset="100%" stopColor="#0e1320"/>
          </linearGradient>
        </defs>
        {/* shadow ellipse */}
        <ellipse cx="100" cy="142" rx="56" ry="9" fill="#000" opacity="0.3"/>
        {/* board edge line (the die fell off) */}
        <path d="M10 120 Q70 108 150 116" stroke="#1e2a3d" strokeWidth="2" fill="none" strokeDasharray="5 6"/>
        {/* die body, tilted */}
        <g transform="translate(100 72) rotate(-12)">
          <rect x="-46" y="-46" width="92" height="92" rx="18" fill="url(#die404)" stroke="#2a3a55" strokeWidth="2"/>
          {/* question mark face instead of pips */}
          <text x="0" y="2" textAnchor="middle" dominantBaseline="central" fontFamily="Poppins, sans-serif" fontSize="58" fontWeight="800" fill="#00aeff">?</text>
        </g>
        {/* sparkle / motion ticks */}
        <g stroke="#1888ef" strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
          <line x1="158" y1="40" x2="166" y2="32"/>
          <line x1="168" y1="54" x2="178" y2="50"/>
          <line x1="150" y1="26" x2="154" y2="16"/>
        </g>
      </svg>
    </div>
  );
}

// ─── Hero: 500 — toppled stack of pieces ───────────────────────
function Hero500() {
  return (
    <div className="errHero">
      <svg viewBox="0 0 200 160">
        <ellipse cx="100" cy="140" rx="62" ry="10" fill="#000" opacity="0.3"/>
        {/* fallen tower of tiles */}
        <g transform="translate(70 95) rotate(-18)">
          <rect x="-26" y="-14" width="52" height="28" rx="5" fill="#1d2532" stroke="#f31d77" strokeWidth="2"/>
        </g>
        <g transform="translate(120 100) rotate(14)">
          <rect x="-24" y="-13" width="48" height="26" rx="5" fill="#1d2532" stroke="#f5a623" strokeWidth="2"/>
        </g>
        <g transform="translate(96 70) rotate(-6)">
          <rect x="-22" y="-12" width="44" height="24" rx="5" fill="#1d2532" stroke="#00aeff" strokeWidth="2"/>
        </g>
        {/* rolling die with X face */}
        <g transform="translate(140 52) rotate(20)">
          <rect x="-22" y="-22" width="44" height="44" rx="10" fill="#151c28" stroke="#f31d77" strokeWidth="2"/>
          <g stroke="#f31d77" strokeWidth="3.5" strokeLinecap="round">
            <line x1="-9" y1="-9" x2="9" y2="9"/>
            <line x1="9" y1="-9" x2="-9" y2="9"/>
          </g>
        </g>
        {/* scatter ticks */}
        <g stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
          <line x1="40" y1="44" x2="32" y2="36"/>
          <line x1="30" y1="58" x2="20" y2="54"/>
        </g>
      </svg>
    </div>
  );
}

// ─── Error screen ──────────────────────────────────────────────
function ErrorApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "screen": "404",
    "tone": "playful"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [copied, setCopied] = useState(false);

  const is500 = t.screen === '500';
  const playful = t.tone === 'playful';

  const copy = {
    '404': {
      eyebrow: 'Error 404 · página no encontrada',
      title: playful ? <>Esta carta no está <em>en el mazo.</em></> : <>Página <em>no encontrada.</em></>,
      text: playful
        ? 'Buscamos en todas las cajas y no encontramos lo que pedías. Quizás la mesa se levantó, el link quedó viejo, o tipeaste un número de la suerte que no tocaba.'
        : 'La página que buscás no existe o fue movida. Revisá el enlace o volvé al inicio.',
    },
    '500': {
      eyebrow: 'Error 500 · algo se cayó de la mesa',
      title: playful ? <>Se nos <em>volcó el tablero.</em></> : <>Algo salió <em>mal.</em></>,
      text: playful
        ? 'No es culpa tuya — un error de nuestro lado dio vuelta las piezas. Ya estamos levantando todo. Probá de nuevo en un toque y deberíamos estar jugando otra vez.'
        : 'Tuvimos un problema procesando tu pedido. Ya estamos trabajando en eso. Probá de nuevo en unos segundos.',
    },
  }[t.screen];

  return (
    <div className={`app-root ${is500 ? '' : ''}`}>
      <div className={`errStage ${is500 ? 'is500' : ''}`}>
        <Backdrop is500={is500} />

        <div className="errCard">
          <Brand />

          {is500 ? <Hero500 /> : <Hero404 />}

          <h1 className="errCode">{t.screen}</h1>

          <span className="errEyebrow">{copy.eyebrow}</span>
          <h2 className="errTitle">{copy.title}</h2>
          <p className="errText">{copy.text}</p>

          <div className="errActions">
            {is500 ? (
              <>
                <button className="errBtn errBtnPrimary"><EIcon.Retry size={16}/> Reintentar</button>
                <button className="errBtn errBtnGhost"><EIcon.Home size={16}/> Ir al inicio</button>
              </>
            ) : (
              <>
                <button className="errBtn errBtnPrimary"><EIcon.Home size={16}/> Volver al inicio</button>
                <button className="errBtn errBtnGhost"><EIcon.Back size={16}/> Página anterior</button>
              </>
            )}
          </div>

          {/* 404: quick links · 500: incident code */}
          {is500 ? (
            <div className="errIncident">
              <span className="dot" />
              <span>Incidente <strong>#TC-5093-A1</strong> · 01 jun 2026, 14:07</span>
              <button className="errCopy" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? '✓ copiado' : 'copiar'}
              </button>
            </div>
          ) : (
            <div className="errLinks">
              <span className="errLinksLabel">◆ O probá una de estas mesas</span>
              <a className="errLink" href="#"><EIcon.Dice size={12}/> Mesas</a>
              <a className="errLink" href="#"><EIcon.Calendar size={12}/> Eventos</a>
              <a className="errLink" href="#"><EIcon.Heart size={12}/> Compartidas</a>
              <a className="errLink" href="#"><EIcon.Mail size={12}/> Contacto</a>
            </div>
          )}
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Pantalla" />
        <TweakRadio
          label="Código"
          value={t.screen}
          onChange={(v) => setTweak('screen', v)}
          options={[
            { value: '404', label: '404' },
            { value: '500', label: '500' },
          ]}
        />
        <TweakSection label="Tono del copy" />
        <TweakRadio
          label="Voz"
          value={t.tone}
          onChange={(v) => setTweak('tone', v)}
          options={[
            { value: 'playful', label: 'Lúdico' },
            { value: 'plain',   label: 'Directo' },
          ]}
        />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<ErrorApp />);
