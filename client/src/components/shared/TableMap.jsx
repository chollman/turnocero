import { useId } from "react";
import { hashStringToInt, AVATAR_PALETTE } from "../../utils/hash";
import { getUserDisplay } from "../../utils/userDisplay";
import styles from "./TableMap.module.css";

// Vista cenital de la mesa: elipse felted con asientos posicionados por
// trigonometría alrededor. Cada asiento es:
//   - host: naranja, con corona "♦ HOST" arriba
//   - you (vos): verde con halo punteado animado
//   - player: color derivado del id del usuario
//   - empty: círculo punteado transparente, "?" adentro
//
// El centro de la mesa muestra el nombre del juego truncado a 16 chars
// (el SVG tiene poco espacio horizontal disponible) y "MESA" debajo.
//
// El componente NO hace fetching ni mutación — sólo renderea. Es seguro
// pasar arrays vacíos / refs no populadas; el helper `getUserDisplay`
// detecta usuarios eliminados y rinde un asiento "fantasma" con ghost
// icon en su lugar.

const CX = 50;
const CY = 50;
const RX = 32;
const RY = 30;
const SEAT_OFFSET = 12;
const SEAT_RADIUS = 7;

// Token de color CSS variable → hex aprox (sólo para SVG; el SVG no resuelve
// `var()` dentro de `fill=`). Usamos el mismo mapeo que `AVATAR_PALETTE` para
// que el color del asiento coincida con el del Avatar del usuario.
const PALETTE_HEX = {
  "--amber": "#1888ef",
  "--red": "#f31d77",
  "--green": "#00d984",
  "--orange": "#f5a623",
  "--purple": "#b48cff",
};

function colorFor(user) {
  if (!user) return PALETTE_HEX["--amber"];
  const id = String(user._id || user.id || user.username || "anon");
  const tokenVar = AVATAR_PALETTE[hashStringToInt(id) % AVATAR_PALETTE.length];
  return PALETTE_HEX[tokenVar] || PALETTE_HEX["--amber"];
}

function initialOf(user) {
  if (!user) return "?";
  const d = getUserDisplay(user);
  if (d.isDeleted) return "?";
  const name = d.displayName || d.username || d.name || "";
  return name.charAt(0).toUpperCase() || "?";
}

function handleOf(user) {
  if (!user) return "lugar libre";
  const d = getUserDisplay(user);
  if (d.isDeleted) return "eliminado";
  return `@${d.username || d.displayName || "anon"}`;
}

function avatarUrlOf(user) {
  if (!user) return null;
  const d = getUserDisplay(user);
  if (d.isDeleted) return null;
  return d.avatar?.url || null;
}

export default function TableMap({
  host,
  players = [],
  maxPlayers,
  currentUserId,
  game = "",
  imageUrl = null,
}) {
  // Prefix único para los clipPaths de los avatares — evita colisiones si
  // hay más de un <TableMap> en el DOM (p. ej. listas de mesas).
  const clipPrefix = useId().replace(/:/g, "");
  const totalSeats = (maxPlayers || 0) + 1; // host counts
  // Build seats: [host, ...players, ...empty]
  const seats = [{ kind: "host", user: host }];
  for (const p of players) {
    const isYou =
      currentUserId && String(p?._id || p) === String(currentUserId);
    seats.push({ kind: isYou ? "you" : "player", user: p });
  }
  while (seats.length < totalSeats) {
    seats.push({ kind: "empty", user: null });
  }

  const positions = seats.map((s, i) => {
    const angle = (i / totalSeats) * 2 * Math.PI - Math.PI / 2;
    const x = CX + (RX + SEAT_OFFSET) * Math.cos(angle);
    const y = CY + (RY + SEAT_OFFSET) * Math.sin(angle);
    // Etiqueta SIEMPRE debajo del círculo — independiente del ángulo del
    // asiento. Esto da consistencia visual y evita el zigzag de etiquetas
    // del patrón "outward". Con `dominant-baseline: hanging` la `y` marca
    // el TOP del texto, así que el offset (+3) se traduce literalmente en
    // un gap de 3 unidades entre el borde del círculo y la primera línea
    // visible del texto.
    const lx = x;
    const ly = y + SEAT_RADIUS + 3;
    return { ...s, x, y, lx, ly, angle };
  });

  return (
    <svg
      // viewBox expandido (-12, -10, 124, 120) para que los labels (@user) y
      // la corona del host (♦ HOST), que se posicionan a distancia
      // RX+SEAT_OFFSET+6 = 50 del centro, no queden recortados en los
      // bordes. La mesa ocupa el centro; los labels viven en el padding.
      viewBox="-12 -10 124 120"
      preserveAspectRatio="xMidYMid meet"
      className={styles.svg}
      aria-label={
        game
          ? `Vista cenital de la mesa de ${game} con los jugadores`
          : "Vista cenital de la mesa con los jugadores"
      }
    >
      <defs>
        <radialGradient id="feltGradTable" cx="0.5" cy="0.5" r="0.6">
          {/* `stopColor` con var() — soportado en SVG moderno (Chrome 88+,
              Firefox 87+, Safari 14+). Se resuelve contra `.svg` que define
              los tokens por theme. */}
          <stop offset="0%" stopColor="var(--tm-felt-1)" />
          <stop offset="60%" stopColor="var(--tm-felt-2)" />
          <stop offset="100%" stopColor="var(--tm-felt-3)" />
        </radialGradient>
        <pattern
          id="feltDotsTable"
          patternUnits="userSpaceOnUse"
          width="2.5"
          height="2.5"
        >
          <circle cx="1.25" cy="1.25" r="0.3" fill="var(--tm-felt-dots)" />
        </pattern>
        <filter id="seatShadow">
          <feDropShadow
            dx="0"
            dy="0.6"
            stdDeviation="0.5"
            floodColor="#000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>

      {/* Wooden ring */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX + 4}
        ry={RY + 3}
        fill="var(--tm-wood)"
        stroke="var(--tm-wood-stroke)"
        strokeWidth="0.4"
      />
      {/* Felt surface */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX}
        ry={RY}
        fill="url(#feltGradTable)"
        stroke="var(--tm-felt-rim)"
        strokeWidth="0.3"
      />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="url(#feltDotsTable)" />
      {/* Inner decoration ring */}
      <ellipse
        cx={CX}
        cy={CY}
        rx={RX - 6}
        ry={RY - 5}
        fill="none"
        stroke="var(--tm-deco-ring)"
        strokeWidth="0.2"
        strokeDasharray="1.5 1.5"
      />

      {/* Center game tile — si hay imagen del juego (bggImage), la usamos
          como background del rect, clippeada al mismo rounded-rect, con
          un overlay oscuro encima para que el texto siga siendo legible.
          Sin imagen, fallback al rect oscuro original. */}
      <g transform={`translate(${CX} ${CY})`}>
        {imageUrl && (
          <>
            <defs>
              <clipPath id="centerTileClip">
                <rect x={-16} y={-16} width={32} height={32} rx={3} />
              </clipPath>
            </defs>
            {/* Bump sutil de brillo + saturación para que la imagen
                resalte contra el felt dark y se sienta como el "centro"
                vivo de la mesa. */}
            <image
              href={imageUrl}
              x={-16}
              y={-16}
              width={32}
              height={32}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#centerTileClip)"
              style={{ filter: "brightness(1.1) saturate(1.15)" }}
            />
            <rect
              x={-16}
              y={-16}
              width={32}
              height={32}
              rx={3}
              fill="var(--tm-tile-overlay)"
            />
          </>
        )}
        <rect
          x={-16}
          y={-16}
          width={32}
          height={32}
          rx={3}
          fill={imageUrl ? "transparent" : "var(--tm-tile-bg)"}
          stroke="var(--tm-tile-stroke)"
          strokeWidth="0.4"
        />
      </g>

      {/* Seats */}
      {positions.map((p, i) => {
        const isHost = p.kind === "host";
        const isYou = p.kind === "you";
        const isEmpty = p.kind === "empty";
        const color = isEmpty ? "transparent" : colorFor(p.user);
        const initial = isEmpty ? "?" : initialOf(p.user);
        const avatarUrl = isEmpty ? null : avatarUrlOf(p.user);
        const clipId = `${clipPrefix}-seat-${i}`;
        // Strokes / lines de los asientos — tokens theme-aware definidos
        // en TableMap.module.css. Los `colorFor(user)` siguen siendo brand
        // hex porque son colores derivados del avatar (estables across
        // themes).
        const stroke = isEmpty
          ? "var(--tm-empty-stroke)"
          : "var(--tm-seat-stroke)";
        const strokeDasharray = isEmpty ? "0.8 0.8" : "0";
        const lineColor = isEmpty ? "var(--tm-empty-line)" : colorFor(p.user);

        return (
          <g key={i} className={styles.seatGroup}>
            {/* Connection line */}
            <line
              x1={p.x}
              y1={p.y}
              x2={CX + RX * Math.cos(p.angle)}
              y2={CY + RY * Math.sin(p.angle)}
              stroke={lineColor}
              strokeWidth="0.4"
              strokeDasharray={isEmpty ? "0.4 0.4" : "0"}
              opacity={isEmpty ? 0.5 : 0.7}
            />
            {/* Halo for "you" */}
            {isYou && (
              <circle
                cx={p.x}
                cy={p.y}
                r={SEAT_RADIUS + 1.5}
                fill="none"
                stroke="#00d984"
                strokeWidth="0.8"
                strokeDasharray="1 1"
                opacity="0.7"
              >
                <animate
                  attributeName="opacity"
                  values="0.5;1;0.5"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            {/* Seat circle — fill con brand color (fallback) o avatar
                clippeado al círculo si el usuario lo tiene. El stroke se
                pinta encima como ring. */}
            {avatarUrl && (
              <defs>
                <clipPath id={clipId}>
                  <circle cx={p.x} cy={p.y} r={SEAT_RADIUS} />
                </clipPath>
              </defs>
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={SEAT_RADIUS}
              fill={color}
              filter={!isEmpty ? "url(#seatShadow)" : undefined}
            />
            {avatarUrl && (
              <image
                href={avatarUrl}
                x={p.x - SEAT_RADIUS}
                y={p.y - SEAT_RADIUS}
                width={SEAT_RADIUS * 2}
                height={SEAT_RADIUS * 2}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${clipId})`}
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={SEAT_RADIUS}
              fill="none"
              stroke={stroke}
              strokeWidth="0.5"
              strokeDasharray={strokeDasharray}
            />
            {/* Initial — sólo si no hay avatar. Filled: blanco sobre brand
                color; empty: var(--text-primary) que en light vira a
                oscuro y queda legible sobre el felt mint claro. */}
            {!avatarUrl && (
              <text
                x={p.x}
                y={p.y}
                className={styles.seatInitial}
                style={{
                  opacity: isEmpty ? 0.4 : 1,
                  fill: isEmpty ? "var(--text-primary)" : "#fff",
                }}
              >
                {initial}
              </text>
            )}
            {/* Host crown */}
            {isHost && (
              <text
                x={p.x}
                y={p.y - SEAT_RADIUS - 2.5}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize="2.4"
                fill="#f5a623"
                style={{ fontWeight: 700, letterSpacing: "0.06em" }}
              >
                ♦ HOST
              </text>
            )}
            {/* Name label */}
            <text
              x={p.lx}
              y={p.ly}
              className={`${styles.seatName} ${
                isHost
                  ? styles.seatName_host
                  : isYou
                    ? styles.seatName_you
                    : isEmpty
                      ? styles.seatName_empty
                      : ""
              }`}
            >
              {handleOf(p.user)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
