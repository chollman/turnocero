// Convierte el borrador ESPERADO de un caso en la llamada a create_play_draft
// que haría un agente perfecto. Lo usan el modo --dry del runner y los tests:
// si el esperado, pasado por las mismas tools, no da un borrador que coincide
// consigo mismo, el caso está mal escrito (no el modelo).

const fx = require("./fixtures");

function expectedToToolInput(expected, data = fx) {
  const game = data.gameById(expected.gameId);
  const known = new Map(data.CO_PLAYERS.map((p) => [p.username, p.name]));
  known.set(data.OWNER.username, data.OWNER.name);
  const expansionNames = new Map(
    Object.values(data.VARIANTS)
      .flatMap((v) => v.expansions)
      .map((e) => [e.id, e.name]),
  );

  return {
    gameId: expected.gameId,
    gameName: game?.name || "",
    playdate: expected.playdate,
    mode: expected.mode || "versus",
    ...(expected.coopResult ? { coopResult: expected.coopResult } : {}),
    ...(expected.variant ? { variant: expected.variant } : {}),
    ...(expected.length ? { length: expected.length } : {}),
    ...(expected.location ? { location: expected.location } : {}),
    ...(expected.notesIncludes ? { notes: expected.notesIncludes } : {}),
    ...(expected.expansions
      ? { expansions: expected.expansions.map((id) => ({ id, name: expansionNames.get(id) || id })) }
      : {}),
    players: (expected.players || []).map((p) => ({
      name: p.name || known.get(p.username) || p.username,
      username: p.username || "",
      ...(p.score !== undefined ? { score: p.score } : {}),
      ...(p.win !== undefined ? { win: p.win } : {}),
      ...(p.team ? { team: p.team } : {}),
      ...(p.faction ? { faction: p.faction } : {}),
    })),
  };
}

module.exports = { expectedToToolInput };
