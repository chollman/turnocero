// Ilustración flat-lay de juego de mesa que oficia de fondo del panel derecho
// (showcase) en las pantallas de auth. Cero imágenes externas: cartas en
// eslint-disable-next-line no-warning-comments
// abanico, dados, meeples, hexágonos y tiles, todo SVG inline.
//
// Es una superficie inmersiva "forzada-oscura" (como /utilidades): ignora el
// tema activo y usa colores literales a propósito — misma convención que el
// resto del bloque .showcase en Auth.module.css. Los hex coinciden con la
// paleta de marca (#1888ef amber, #00d984 green, etc.).

const MEEPLE =
  "M12 2a2.6 2.6 0 0 0-2.6 2.6c0 .8.36 1.5.92 2L9 8.5c-.3.5-.84.8-1.42.8H5.2C4 9.3 3 10.3 3 11.5c0 .6.24 1.14.64 1.54L6 15l-1.4 4.6A1.6 1.6 0 0 0 6.13 21.7H8.4l1.3-4.2c.2-.66.8-1.1 1.5-1.1h1.6c.7 0 1.3.44 1.5 1.1l1.3 4.2h2.27a1.6 1.6 0 0 0 1.53-2.1L18 15l2.36-1.96c.4-.4.64-.94.64-1.54 0-1.2-1-2.2-2.2-2.2h-2.38c-.58 0-1.12-.3-1.42-.8l-1.32-1.9c.56-.5.92-1.2.92-2A2.6 2.6 0 0 0 12 2z";

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(
      `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`,
    );
  }
  return pts.join(" ");
}

const pip = (cx, cy) => (
  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill="#0a0d15" />
);

const HEXES = [
  [470, 90],
  [524, 122],
  [470, 154],
  [524, 186],
  [416, 122],
  [416, 186],
  [578, 154],
];

const CARDS = [
  { r: -26, c: "#1888ef" },
  { r: -13, c: "#00d984" },
  { r: 0, c: "#f5a623" },
  { r: 13, c: "#b48cff" },
  { r: 26, c: "#f31d77" },
];

export default function AuthShowcaseScene() {
  return (
    <svg
      viewBox="0 0 600 820"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="authSceneGlow" cx="0.5" cy="0.42" r="0.6">
          <stop offset="0%" stopColor="#1a2c48" />
          <stop offset="55%" stopColor="#101a2e" />
          <stop offset="100%" stopColor="#080b13" />
        </radialGradient>
        <linearGradient id="authCardFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2940" />
          <stop offset="100%" stopColor="#141d30" />
        </linearGradient>
        <filter
          id="authSceneShadow"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="10"
            stdDeviation="14"
            floodColor="#000"
            floodOpacity="0.45"
          />
        </filter>
      </defs>

      {/* base */}
      <rect width="600" height="820" fill="url(#authSceneGlow)" />

      {/* faint hex-tile cluster, top-right */}
      <g
        opacity="0.5"
        stroke="rgba(24,136,239,0.4)"
        strokeWidth="2"
        fill="none"
      >
        {HEXES.map(([x, y], i) => (
          <polygon
            key={`${x}-${y}`}
            points={hexPoints(x, y, 32)}
            fill={i % 3 === 0 ? "rgba(24,136,239,0.10)" : "transparent"}
          />
        ))}
      </g>

      {/* score-track dashed arc */}
      <path
        d="M40 250 Q 300 140 560 280"
        fill="none"
        stroke="rgba(0,174,255,0.22)"
        strokeWidth="2.5"
        strokeDasharray="3 12"
        strokeLinecap="round"
      />

      {/* central fanned hand of cards */}
      <g filter="url(#authSceneShadow)" transform="translate(330 470)">
        {CARDS.map((card) => (
          <g key={card.r} transform={`rotate(${card.r}) translate(0 -14)`}>
            <rect
              x="-58"
              y="-90"
              width="116"
              height="180"
              rx="12"
              fill="url(#authCardFace)"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
            />
            <rect
              x="-58"
              y="-90"
              width="116"
              height="180"
              rx="12"
              fill="none"
              stroke={card.c}
              strokeWidth="2"
              opacity="0.55"
            />
            <circle cx="-40" cy="-70" r="7" fill={card.c} opacity="0.9" />
            <circle cx="40" cy="70" r="7" fill={card.c} opacity="0.9" />
            <g opacity="0.92">
              <polygon points="0,-34 30,18 -30,18" fill={card.c} opacity="0.32" />
              <circle
                cx="0"
                cy="6"
                r="17"
                fill="none"
                stroke={card.c}
                strokeWidth="3"
                opacity="0.7"
              />
            </g>
          </g>
        ))}
      </g>

      {/* dice */}
      <g filter="url(#authSceneShadow)">
        <g transform="translate(122 486) rotate(-14)">
          <rect x="-34" y="-34" width="68" height="68" rx="14" fill="#f1f3f8" />
          {pip(-13, -13)}
          {pip(13, -13)}
          {pip(-13, 13)}
          {pip(13, 13)}
          {pip(0, 0)}
        </g>
        <g transform="translate(186 552) rotate(10)">
          <rect x="-26" y="-26" width="52" height="52" rx="11" fill="#00aeff" />
          <circle cx="-9" cy="-9" r="5.5" fill="#06243a" />
          <circle cx="9" cy="9" r="5.5" fill="#06243a" />
        </g>
      </g>

      {/* meeples */}
      <g filter="url(#authSceneShadow)">
        <g transform="translate(476 548) scale(2.4)">
          <path d={MEEPLE} fill="#f5a623" />
        </g>
        <g transform="translate(104 610) scale(2.9)">
          <path d={MEEPLE} fill="#1888ef" />
        </g>
        <g transform="translate(508 668) scale(2.1)">
          <path d={MEEPLE} fill="#00d984" />
        </g>
        <g transform="translate(360 700) scale(2.0)" opacity="0.92">
          <path d={MEEPLE} fill="#b48cff" />
        </g>
      </g>

      {/* small scattered tiles bottom-left */}
      <g opacity="0.8" filter="url(#authSceneShadow)">
        <rect
          x="60"
          y="700"
          width="56"
          height="56"
          rx="9"
          fill="#15233a"
          stroke="rgba(243,29,119,0.6)"
          strokeWidth="2"
          transform="rotate(-12 88 728)"
        />
        <rect
          x="150"
          y="724"
          width="48"
          height="48"
          rx="8"
          fill="#15233a"
          stroke="rgba(0,217,132,0.6)"
          strokeWidth="2"
          transform="rotate(8 174 748)"
        />
      </g>
    </svg>
  );
}
