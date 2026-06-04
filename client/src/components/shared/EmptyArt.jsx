// Ilustraciones SVG inline para los empty states (lenguaje de juego de mesa,
// consistente con las pantallas de error y el showcase del login). NO usar
// emoji — siempre estas ilustraciones.
//
// Los colores de marca (--amber/--amber-light/--orange/--green) son iguales en
// ambos temas; los neutros estructurales (card/border/bg/text) usan variables
// CSS para adaptarse a claro/oscuro (misma convención que ErrorScreen). Algunos
// "materiales" (fieltro verde, papel polaroid, oro del trofeo) quedan literales
// a propósito porque son el color del objeto, no del tema.
//
// Todas son `viewBox="0 0 150 120"` y decorativas (`aria-hidden` lo pone el
// contenedor `.emptyArt` del EmptyState).

// Silueta de meeple reutilizable.
function meeple(x, y, s, fill, op = 1) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      opacity={op}
      d="M5 0a2.4 2.4 0 0 1 2.1 3.6c1.4.5 2.4 1.5 2.9 2.9l.4 1.2c.2.6-.2 1.1-.8 1.1H7.9c.3.7.5 1.6.6 2.7.05.5-.35.9-.85.9H2.35c-.5 0-.9-.4-.85-.9.1-1.1.3-2 .6-2.7H1.4c-.6 0-1-.5-.8-1.1l.4-1.2c.5-1.4 1.5-2.4 2.9-2.9A2.4 2.4 0 0 1 5 0z"
      fill={fill}
    />
  );
}

// 1. MESAS — mesa felteada vacía con sillas libres + dado central tenue.
export function ArtMesa() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="esFelt" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#1d3a2a" />
          <stop offset="60%" stopColor="#15281e" />
          <stop offset="100%" stopColor="#0e1a14" />
        </radialGradient>
      </defs>
      <ellipse cx="75" cy="64" rx="50" ry="34" fill="#2a1f15" />
      <ellipse
        cx="75"
        cy="60"
        rx="50"
        ry="34"
        fill="url(#esFelt)"
        stroke="var(--amber-30)"
        strokeWidth="0.8"
      />
      <ellipse
        cx="75"
        cy="60"
        rx="40"
        ry="26"
        fill="none"
        stroke="var(--overlay-soft)"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      {/* dado central tenue */}
      <g transform="translate(75 60)" opacity="0.5">
        <rect
          x="-7"
          y="-7"
          width="14"
          height="14"
          rx="2"
          fill="none"
          stroke="var(--amber-50)"
          strokeWidth="1"
        />
        <circle cx="-3" cy="-3" r="1.1" fill="var(--amber)" />
        <circle cx="3" cy="3" r="1.1" fill="var(--amber)" />
      </g>
      {/* sillas vacías punteadas alrededor */}
      {[
        [75, 18],
        [123, 42],
        [123, 82],
        [75, 104],
        [27, 82],
        [27, 42],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="9"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.4"
          strokeDasharray="2.5 2.5"
          opacity="0.7"
        />
      ))}
    </svg>
  );
}

// 2. EVENTOS — ticket / calendario con perforación, fecha "??".
export function ArtEvento() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="esShadowE">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="3"
            floodColor="#000"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      <g filter="url(#esShadowE)" transform="rotate(-5 75 60)">
        <rect
          x="34"
          y="30"
          width="82"
          height="60"
          rx="8"
          fill="var(--bg-card)"
          stroke="var(--border-strong)"
          strokeWidth="1.5"
        />
        <rect x="34" y="30" width="82" height="20" rx="8" fill="var(--bg-elevated)" />
        <rect x="34" y="42" width="82" height="8" fill="var(--bg-elevated)" />
        <line
          x1="34"
          y1="50"
          x2="116"
          y2="50"
          stroke="var(--border-strong)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <circle cx="34" cy="50" r="4" fill="var(--bg-dark)" />
        <circle cx="116" cy="50" r="4" fill="var(--bg-dark)" />
        <text
          x="75"
          y="74"
          textAnchor="middle"
          fontFamily="Poppins, sans-serif"
          fontSize="22"
          fontWeight="800"
          fill="var(--amber-light)"
          letterSpacing="-0.04em"
        >
          ??
        </text>
        <text
          x="75"
          y="84"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="6"
          fill="var(--text-muted)"
          letterSpacing="0.2em"
        >
          SIN FECHA
        </text>
        <circle cx="46" cy="40" r="2" fill="var(--orange)" />
        <rect x="52" y="38" width="28" height="4" rx="2" fill="var(--border-strong)" />
      </g>
    </svg>
  );
}

// 3. TORNEOS — bracket vacío (slots punteados) + trofeo central con "?".
export function ArtTorneo() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <g
        stroke="var(--text-muted)"
        strokeWidth="1.4"
        fill="none"
        strokeDasharray="2.5 2.5"
        opacity="0.65"
      >
        <path d="M20 30 H40 V50 H56" />
        <path d="M20 70 H40 V50" />
        <path d="M130 30 H110 V50 H94" />
        <path d="M130 70 H110 V50" />
      </g>
      {[
        [20, 30],
        [20, 70],
        [130, 30],
        [130, 70],
      ].map(([x, y], i) => (
        <rect
          key={i}
          x={x - 14}
          y={y - 7}
          width="28"
          height="14"
          rx="3"
          fill="var(--bg-card)"
          stroke="var(--border-strong)"
          strokeWidth="1"
        />
      ))}
      <g transform="translate(75 56)">
        <path d="M-10 -14 h20 v6 a10 10 0 0 1 -20 0 z" fill="var(--orange)" />
        <path
          d="M-10 -12 h-5 a5 5 0 0 0 5 7 z M10 -12 h5 a5 5 0 0 1 -5 7 z"
          fill="none"
          stroke="var(--orange)"
          strokeWidth="1.6"
        />
        <rect x="-2.5" y="-4" width="5" height="9" fill="#d48800" />
        <rect x="-9" y="5" width="18" height="4" rx="1.5" fill="var(--orange)" />
        <text
          x="0"
          y="-6.5"
          textAnchor="middle"
          fontFamily="Poppins, sans-serif"
          fontSize="8"
          fontWeight="800"
          fill="#1a1208"
        >
          ?
        </text>
      </g>
    </svg>
  );
}

// 4. COMPARTIDAS — polaroid vacía con cámara + caption Caveat + cinta.
// La polaroid es un objeto físico (papel crema) → colores literales a propósito.
export function ArtCompartida() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="esShadowP">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="4"
            floodColor="#000"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      <g filter="url(#esShadowP)" transform="rotate(-6 75 60)">
        <rect x="44" y="26" width="62" height="74" rx="2" fill="#f4eeda" />
        <rect x="50" y="32" width="50" height="48" rx="1" fill="#1a2335" />
        <rect
          x="50"
          y="32"
          width="50"
          height="48"
          rx="1"
          fill="none"
          stroke="#0e1320"
          strokeWidth="0.5"
        />
        <g
          transform="translate(75 56)"
          stroke="#5a6178"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="-11" y="-7" width="22" height="16" rx="3" />
          <circle cx="0" cy="1" r="4.5" />
          <rect x="-3" y="-10" width="6" height="3" rx="1" />
        </g>
        <text
          x="75"
          y="92"
          textAnchor="middle"
          fontFamily="Caveat, cursive"
          fontSize="12"
          fill="#2c2620"
        >
          tu primera foto
        </text>
      </g>
      <rect
        x="60"
        y="20"
        width="30"
        height="10"
        rx="1"
        fill="rgba(232,220,180,0.6)"
        transform="rotate(-8 75 25)"
      />
    </svg>
  );
}

// 5. COMUNIDAD — meeples (siluetas) + sombra elíptica.
export function ArtComunidad() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      {meeple(56, 30, 3.2, "var(--amber)", 0.9)}
      {meeple(88, 38, 2.6, "var(--orange)", 0.8)}
      {meeple(40, 50, 2.2, "var(--green)", 0.7)}
      <ellipse cx="75" cy="100" rx="46" ry="8" fill="var(--amber-10)" />
    </svg>
  );
}

// 6. NOTIFICACIONES — campana verde + badge check "al día".
export function ArtNotif() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <g
        transform="translate(75 56)"
        stroke="var(--green)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M16 8A16 16 0 0 0 -16 8c0 18-8 23-8 23h48s-8-5-8-23"
          fill="var(--green-10)"
        />
        <path d="M4 38a6 6 0 0 1-8 0" />
      </g>
      <g transform="translate(102 36)">
        <circle r="12" fill="var(--green)" />
        <path
          d="M-5 0 L-1.5 4 L6 -5"
          stroke="#001712"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

// 8. NOTICIAS — hoja de diario con masthead + columnas (no estaba en el set
// original del handoff; creada en el mismo lenguaje para cubrir la sección).
export function ArtNoticia() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="esShadowN">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="3"
            floodColor="#000"
            floodOpacity="0.4"
          />
        </filter>
      </defs>
      <g filter="url(#esShadowN)" transform="rotate(-4 75 60)">
        <rect
          x="44"
          y="24"
          width="62"
          height="74"
          rx="4"
          fill="var(--bg-card)"
          stroke="var(--border-strong)"
          strokeWidth="1.5"
        />
        {/* masthead */}
        <rect x="44" y="24" width="62" height="17" rx="4" fill="var(--bg-elevated)" />
        <rect x="44" y="33" width="62" height="8" fill="var(--bg-elevated)" />
        <text
          x="75"
          y="36"
          textAnchor="middle"
          fontFamily="Poppins, sans-serif"
          fontSize="7"
          fontWeight="800"
          fill="var(--amber-light)"
          letterSpacing="0.12em"
        >
          NOTICIAS
        </text>
        <line
          x1="50"
          y1="46"
          x2="100"
          y2="46"
          stroke="var(--border-strong)"
          strokeWidth="1"
        />
        {/* headline + thumb */}
        <rect x="50" y="50" width="34" height="5" rx="2" fill="var(--border-strong)" />
        <rect x="50" y="58" width="26" height="4" rx="2" fill="var(--border-strong)" />
        <rect x="50" y="68" width="24" height="22" rx="2" fill="var(--bg-elevated)" />
        {/* column lines */}
        <g fill="var(--bg-elevated)">
          <rect x="80" y="68" width="20" height="3.2" rx="1.6" />
          <rect x="80" y="74" width="20" height="3.2" rx="1.6" />
          <rect x="80" y="80" width="20" height="3.2" rx="1.6" />
          <rect x="80" y="86" width="14" height="3.2" rx="1.6" />
        </g>
        {/* accent dot */}
        <circle cx="98" cy="33" r="2.4" fill="var(--orange)" />
      </g>
    </svg>
  );
}

// 9. FILTERED (todas) — lupa cyan sobre un dado con "?".
export function ArtSearch() {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid meet">
      <g transform="translate(64 52)" opacity="0.85">
        <rect
          x="-20"
          y="-20"
          width="40"
          height="40"
          rx="6"
          fill="var(--bg-card)"
          stroke="var(--border-strong)"
          strokeWidth="1.5"
          transform="rotate(-8)"
        />
        <text
          x="0"
          y="2"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Poppins, sans-serif"
          fontSize="22"
          fontWeight="800"
          fill="var(--text-muted)"
          transform="rotate(-8)"
        >
          ?
        </text>
      </g>
      <g
        transform="translate(88 74)"
        stroke="var(--amber-light)"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      >
        <circle cx="0" cy="0" r="13" fill="rgba(0,174,255,0.08)" />
        <line x1="9.5" y1="9.5" x2="20" y2="20" />
      </g>
    </svg>
  );
}
