import { hasDisplayableScore } from "./playerScore";
import { getUserDisplay } from "../../utils/userDisplay";

// Convierte el snapshot `playResult` guardado en una juntada (ver buildPlayResult)
// en los props del <Scorecard> en modo público. Recomputa lo viewer-relativo:
// `you` siempre false (un post lo ve cualquiera) y `leader` con la misma regla
// que PlayForm.
//
// Identidad EN VIVO: cada jugador que es usuario de TurnoCero trae su `userId`
// poblado por el server (`{ _id, username, displayName, avatar }`). Para esos se
// usa el nombre + avatar ACTUAL del perfil (no el snapshot), así editar el perfil
// se refleja en juntadas viejas. Se arma un `userMap` (clave = @BGG en minúscula,
// la misma que mira el <Scorecard>) con esos usuarios; el resto cae a iniciales.
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

  const userMap = {};
  const rows = players.map((p, i) => {
    // `userId` poblado (objeto con `_id`) ⇒ usuario de TurnoCero vigente.
    const tcUser =
      p.userId && typeof p.userId === "object" && p.userId._id
        ? p.userId
        : null;
    if (tcUser && p.username) userMap[p.username.toLowerCase()] = tcUser;
    return {
      key: `${i}-${p.username || p.name || "anon"}`,
      name: tcUser ? getUserDisplay(tcUser).name : p.name || p.username || "Jugador",
      username: p.username,
      anonymous: !!p.anonymous,
      // Link al perfil público de TurnoCero (solo si es usuario) y a su BG Watch
      // (cualquier jugador con @BGG). El <Scorecard> los renderiza en publicView.
      profileHref: tcUser ? `/usuarios/${tcUser._id}` : null,
      bgwatchHref:
        !p.anonymous && p.username
          ? `/bg-watch/${encodeURIComponent(p.username)}`
          : null,
      score: p.score,
      win: !!p.win,
      new: !!p.new,
      team: p.team || "",
      position: p.position,
      you: false,
      leader: mode === "equipos" ? !!p.win : i === leaderIdx,
    };
  });

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
    userMap,
    publicView: true,
  };
}
