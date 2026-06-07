// Mapea el snapshot embebido de una notif `bgg_play_shared` al shape de
// `initialValues` que consume `PlayForm` (mismo contrato que `EditPlay`). Lo usa
// la rama "cargar con correcciones": precarga el form con los datos del autor.

export function snapshotToInitialValues(snapshot) {
  const snap = snapshot || {};
  const players = Array.isArray(snap.players) ? snap.players : [];
  return {
    game: {
      id: snap.gameId,
      name: snap.gameName || "",
      thumbnail: snap.gameThumbnail || snap.gameImage || null,
    },
    details: {
      playdate: snap.date || "",
      length: snap.duration != null ? String(snap.duration) : "",
      location: snap.location || "",
      quantity: snap.quantity || 1,
      comments: snap.comments || "",
      incomplete: !!snap.incomplete,
      nowinstats: !!snap.nowinstats,
    },
    players: players.map((p) => ({
      name: p.name || "",
      username: p.username || "",
      score: p.score != null ? String(p.score) : "",
      win: !!p.win,
      new: !!p.new,
    })),
  };
}
