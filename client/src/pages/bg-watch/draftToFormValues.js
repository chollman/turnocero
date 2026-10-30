import { composeComments } from "./playComments";

// Convierte el borrador que devuelve el agente de carga (POST /api/bgg/agente)
// en `initialValues` para PlayForm. Variante y expansiones viajan dentro de
// `details.comments` (mismo formato que BGG): PlayForm las parsea de vuelta a
// chips. La facción va en `color` (como en BGG); en modo equipos `color` es el
// equipo ("Equipo A").
//
// `fromAgent: true` le dice a PlayForm que el ganador ya lo decidió el agente
// (no reasignarlo solo al cambiar un puntaje).
export function draftToFormValues(draft) {
  if (!draft?.game?.id) return null;
  const mode = ["versus", "coop", "equipos"].includes(draft.mode)
    ? draft.mode
    : "versus";

  const players = (draft.players || []).map((p) => ({
    name: p.name || p.username || "",
    username: p.username || "",
    score: mode === "coop" ? "" : (p.score ?? ""),
    win: !!p.win,
    color:
      mode === "equipos" ? (p.team ? `Equipo ${p.team}` : "") : p.faction || "",
  }));

  return {
    game: {
      id: Number(draft.game.id),
      name: draft.game.name || "",
      thumbnail: draft.game.thumbnail || null,
      image: draft.game.image || null,
      year: draft.game.year || null,
    },
    details: {
      playdate: draft.details?.playdate || undefined,
      length: draft.details?.length ?? "",
      location: draft.details?.location || "",
      comments: composeComments({
        notes: draft.details?.comments || "",
        expansions: draft.expansions || [],
        variant: draft.variant || "",
      }),
    },
    players,
    mode,
    coopWin: draft.coopResult !== "lost",
    fromAgent: true,
  };
}
