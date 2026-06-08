import { hasDisplayableScore } from "./playerScore";

// Convierte el snapshot `playResult` guardado en una juntada (ver buildPlayResult)
// en los props del <Scorecard> en modo público. Recomputa lo viewer-relativo:
// `you` siempre false (un post lo ve cualquiera) y `leader` con la misma regla
// que PlayForm. `userMap: {}` ⇒ avatares por iniciales (sin fetch por tarjeta).
export function playResultToScorecardProps(playResult) {
  if (!playResult) return null;
  const mode = playResult.mode || "versus";
  const players = Array.isArray(playResult.players) ? playResult.players : [];

  // leader: equipos → el/los del equipo ganador (win); versus → la única fila en
  // posición 1 cuando hay algún score numérico; coop → ninguno (corona oculta).
  const anyNumeric = players.some(
    (p) =>
      hasDisplayableScore(p.score) &&
      Number.isFinite(Number(String(p.score).trim())),
  );
  const firstPlace = players
    .map((p, i) => (Number(p.position) === 1 ? i : -1))
    .filter((i) => i >= 0);
  const leaderIdx =
    mode === "versus" && anyNumeric && firstPlace.length === 1
      ? firstPlace[0]
      : -1;

  const rows = players.map((p, i) => ({
    key: `${i}-${p.username || p.name || "anon"}`,
    name: p.name || p.username || "Jugador",
    username: p.username,
    anonymous: !!p.anonymous,
    score: p.score,
    win: !!p.win,
    new: !!p.new,
    team: p.team || "",
    position: p.position,
    you: false,
    leader: mode === "equipos" ? !!p.win : i === leaderIdx,
  }));

  return {
    game: playResult.game || null,
    date: playResult.date || "",
    location: "",
    duration: playResult.duration ?? null,
    mode,
    // En publicView el Scorecard arma el banner desde los ganadores; estos quedan
    // por compatibilidad de props.
    hasResult: rows.some((r) => r.win),
    youWin: false,
    rows,
    notes: "",
    userMap: {},
    publicView: true,
  };
}
