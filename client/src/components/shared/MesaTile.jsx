// Banner determinístico para las mesas. Si la mesa tiene `bggImage` reusamos
// la imagen real (fallback objectFit: cover, mismo crop que GameTile). Si no,
// generamos un mosaico geométrico determinístico desde el seed del juego —
// permite que cada juego tenga "identidad visual" aunque no haya thumbnail.
//
// El algoritmo del mosaico viene del handoff (mesas-shared.jsx → MesaTile):
// paleta de 6 trios indexada por seed, grid 6×4 con PRNG simple (mulberry-ish)
// que decide por celda si va triángulo / círculo / rect / vacío. Cada celda
// usa colors[colorIdx] con opacity 0.5-1.

const PALETTES = [
  ["#1888ef", "#0076d1", "#00aeff"], // azul
  ["#b48cff", "#7a4dff", "#d4baff"], // violeta
  ["#f5a623", "#d48800", "#ffcd6b"], // naranja
  ["#00d984", "#00a565", "#5dffbe"], // verde
  ["#f31d77", "#b50054", "#ff6cb0"], // rosa
  ["#00aeff", "#1888ef", "#9ad3ff"], // cyan
];

const GRID_COLS = 6;
const GRID_ROWS = 4;

// PRNG simple sembrado por un entero. Avanza determinísticamente.
// Es estable a través de runs porque no usa Math.random ni Date.
function makePrng(seed) {
  let state = (seed | 0) >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function renderCell(prng, x, y, w, h, colors, key) {
  const r = prng();
  // Color de la celda — escogemos uno de los 3 colores de la paleta.
  const colorIdx = Math.floor(prng() * 3);
  const fill = colors[colorIdx];

  if (r > 0.7) {
    // Triángulo apuntando hacia una de 4 direcciones.
    const dir = Math.floor(prng() * 4);
    const points = (() => {
      switch (dir) {
        case 0:
          return `${x},${y + h} ${x + w / 2},${y} ${x + w},${y + h}`;
        case 1:
          return `${x},${y} ${x + w},${y + h / 2} ${x},${y + h}`;
        case 2:
          return `${x},${y} ${x + w},${y} ${x + w / 2},${y + h}`;
        default:
          return `${x + w},${y} ${x + w},${y + h} ${x},${y + h / 2}`;
      }
    })();
    const opacity = 0.7 + prng() * 0.3;
    return <polygon key={key} points={points} fill={fill} opacity={opacity} />;
  }
  if (r > 0.45) {
    // Círculo centrado.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rad = Math.min(w, h) * 0.35;
    const opacity = 0.6 + prng() * 0.35;
    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={rad}
        fill={fill}
        opacity={opacity}
      />
    );
  }
  if (r > 0.25) {
    // Rect con 15% de padding.
    const pad = 0.15;
    const opacity = 0.5 + prng() * 0.4;
    return (
      <rect
        key={key}
        x={x + w * pad}
        y={y + h * pad}
        width={w * (1 - 2 * pad)}
        height={h * (1 - 2 * pad)}
        rx="2"
        fill={fill}
        opacity={opacity}
      />
    );
  }
  // Vacío.
  return null;
}

export default function MesaTile({
  game = "",
  seed = 0,
  imageUrl = null,
  ariaHidden = true,
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={ariaHidden ? "" : game}
        aria-hidden={ariaHidden}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 30%",
          display: "block",
        }}
      />
    );
  }

  const nameHash = hashName(game);
  const effectiveSeed = ((seed || 0) ^ nameHash) >>> 0;
  const colors = PALETTES[effectiveSeed % PALETTES.length];
  const prng = makePrng(effectiveSeed + 1);

  const W = 100;
  const H = 67; // mantiene aspect 100/67 ≈ 16/9; el container clipea con xMidYMid slice
  const cellW = W / GRID_COLS;
  const cellH = H / GRID_ROWS;

  const cells = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = renderCell(
        prng,
        col * cellW,
        row * cellH,
        cellW,
        cellH,
        colors,
        `${row}-${col}`,
      );
      if (cell) cells.push(cell);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      style={{ display: "block" }}
      aria-hidden={ariaHidden}
    >
      <defs>
        <linearGradient
          id={`mesaTileBg-${effectiveSeed}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor={colors[1]} />
          <stop offset="100%" stopColor="#0a0d15" />
        </linearGradient>
      </defs>
      <rect
        width={W}
        height={H}
        fill={`url(#mesaTileBg-${effectiveSeed})`}
      />
      {cells}
    </svg>
  );
}
