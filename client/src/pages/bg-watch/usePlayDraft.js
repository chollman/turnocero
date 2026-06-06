import { useCallback, useMemo } from "react";

// Borrador local del form de cargar partida (#4). Persiste el form en progreso
// ({ game, details, players }) en localStorage, por usuario, para no perder lo
// cargado si se sale sin querer. El hook solo expone load/save/clear — PlayForm
// orquesta CUÁNDO guardar (en cada cambio), ofrecer (al montar) y limpiar (al
// guardar/cancelar/descartar).

export function draftKey(bggUsername) {
  return `turnocero_play_draft:${(bggUsername || "").toLowerCase()}`;
}

// ¿Vale la pena ofrecer este borrador? Solo si tiene contenido real — un juego,
// más de un jugador, o detalles/puntajes cargados — no un form recién abierto
// con el dueño prellenado.
export function isDraftMeaningful(draft) {
  if (!draft) return false;
  if (draft.game) return true;
  const players = draft.players || [];
  if (players.length > 1) return true;
  if (players.some((p) => (p.score || "").trim() || p.win)) return true;
  const d = draft.details || {};
  return !!((d.location || "").trim() || (d.comments || "").trim() || d.length);
}

export default function usePlayDraft(bggUsername) {
  const key = useMemo(() => draftKey(bggUsername), [bggUsername]);

  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [key]);

  const save = useCallback(
    (draft) => {
      try {
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        /* quota / modo privado → best-effort */
      }
    },
    [key],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  return { load, save, clear };
}
