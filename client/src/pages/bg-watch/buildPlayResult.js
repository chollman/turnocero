// Arma el snapshot de resultados (`playResult`) que se guarda en la juntada
// compartida y que renderiza el <Scorecard> (publicView). Se construye con los
// MISMOS datos que el preview en vivo (`scorecardRows`), así el widget guardado
// es idéntico al preview.
//
// Guarda `name`/`username` como snapshot. La IDENTIDAD del jugador (nombre +
// avatar de TurnoCero) NO se congela acá: el server vincula cada @BGG a su
// `userId` y el scorecard la resuelve en vivo al renderizar — ver
// `playResultToScorecard` + `routes/compartidas.js#sanitizePlayResult`.
//
// Descarta lo viewer-relativo (`you`/`leader`/`key`, que se recomputan al
// renderizar para cada visitante) y la ubicación (privacidad — igual que el
// snapshot del flujo de notif en bggPlayShare). Devuelve `null` si no hay juego
// o no hay jugadores (sin resultados que mostrar).
export function buildPlayResult({ scorecardRows, mode, game, details } = {}) {
  if (!game) return null;
  const rows = Array.isArray(scorecardRows) ? scorecardRows : [];
  if (rows.length === 0) return null;

  return {
    mode: mode || "versus",
    game: { name: game.name || "", thumbnail: game.thumbnail || "" },
    // Se conserva para que el server pueda re-resolver el thumbnail (mismo
    // modelo de confianza que `boardGames`).
    gameId: game.id != null ? Number(game.id) || null : null,
    date: details?.playdate || "",
    duration:
      details?.length != null && details.length !== ""
        ? Number(details.length) || null
        : null,
    players: rows.map((r) => ({
      name: r.name || "",
      username: r.username || "",
      anonymous: !!r.anonymous,
      score: r.score != null ? String(r.score) : "",
      win: !!r.win,
      new: !!r.new,
      team: r.team || "",
      position: r.position != null ? Number(r.position) || null : null,
    })),
  };
}
