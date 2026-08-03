import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const bggKeys = {
  search: (q) => ["bgg", "search", q],
  coleccion: (bggUsername) => ["bgg", "coleccion", bggUsername],
  coleccionCooldown: (bggUsername) => ["bgg", "coleccionCooldown", bggUsername],
  homeStats: (bggUsername) => ["bgg", "homeStats", bggUsername],
  game: (gameId) => ["bgg", "game", gameId],
};

function readCooldownMs(headers) {
  return Number(headers?.["x-refresh-cooldown-ms"] || 0);
}

// Autocomplete de juegos BGG — el mismo patrón vivía duplicado (debounce +
// cache manual en un Map + AbortController) en MesaForm.jsx y en el flujo
// "mesa dentro de un evento" de CreateTable.jsx. `enabled` lo decide el
// caller (mínimo de caracteres, no researchear post-selección).
export function useBggSearchQuery(query, { enabled = true } = {}) {
  const trimmed = (query || "").trim();
  return useQuery({
    queryKey: bggKeys.search(trimmed.toLowerCase()),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.SEARCH, {
        params: { q: query },
        signal,
      });
      return data;
    },
    enabled: enabled && trimmed.length >= 3,
    staleTime: 5 * 60_000,
  });
}

// Colección BGG del user — usada por EventoLudotecaPicker (tab "Mi
// colección"). El L2 cache real (Mongo, TTL 6h) ya vive server-side
// (BggCollection) — acá solo evitamos un refetch por cada apertura del
// picker dentro de la misma sesión de navegación.
// Every GET (not just an explicit "Actualizar") carries the server-enforced
// cooldown header — stashed into a companion cache entry so ColeccionPanel
// can sync its countdown on the initial load too, not only after a manual
// refresh. Kept as a SEPARATE cache entry (not embedded in `data`) so other
// consumers of this query (e.g. EventoLudotecaPicker) keep the plain-array
// shape they expect.
export function useBggCollectionQuery(bggUsername, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: bggKeys.coleccion(bggUsername),
    queryFn: async ({ signal }) => {
      const { data, headers } = await axios.get(
        API.bgg.COLECCION(bggUsername),
        { signal },
      );
      const cooldownMs = readCooldownMs(headers);
      queryClient.setQueryData(
        bggKeys.coleccionCooldown(bggUsername),
        cooldownMs > 0 ? Date.now() + cooldownMs : 0,
      );
      return Array.isArray(data) ? data : [];
    },
    enabled: enabled && !!bggUsername,
    staleTime: 5 * 60_000,
  });
}

// Cache-only companion of `useBggCollectionQuery` — never fetches on its
// own (`enabled:false`); it's populated as a side effect of that query's
// queryFn and by `refreshBggCollection`'s caller.
export function useBggCollectionCooldownQuery(bggUsername) {
  return useQuery({
    queryKey: bggKeys.coleccionCooldown(bggUsername),
    queryFn: () => 0,
    enabled: false,
    initialData: 0,
  });
}

// "Actualizar" manual de la colección (ColeccionPanel) — bypassea la cache
// del server (`refresh:1`) y devuelve el cooldown (header `x-refresh-cooldown-ms`,
// también presente en el 429) para que el caller arme la cuenta regresiva. El
// caller escribe el resultado en `bggKeys.coleccion` con `queryClient.setQueryData`
// — comparte cache con `useBggCollectionQuery` (misma key), no un cache aparte.
export async function refreshBggCollection(bggUsername) {
  try {
    const { data, headers } = await axios.get(API.bgg.COLECCION(bggUsername), {
      params: { refresh: 1 },
    });
    return {
      data: Array.isArray(data) ? data : [],
      cooldownMs: readCooldownMs(headers),
    };
  } catch (err) {
    err.cooldownMs = readCooldownMs(err.response?.headers);
    throw err;
  }
}

// Stats resumen del widget "BG Watch" en el home de Compartidas: total del
// año + del mes + juego más jugado. `mostPlayed.name` puede venir vacío (raro
// — jugada sin nombre de juego cacheado); el fallback de texto se aplica en
// el componente vía i18n, no acá (queryFn no tiene acceso a `t`).
export function useBgWatchHomeStatsQuery(bggUsername, { enabled = true } = {}) {
  return useQuery({
    queryKey: bggKeys.homeStats(bggUsername),
    queryFn: async ({ signal }) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const url = API.bgg.PARTIDAS(bggUsername);
      const [yearRes, monthRes] = await Promise.all([
        axios.get(url, { params: { page: 1, mindate: `${year}-01-01` }, signal }),
        axios.get(url, {
          params: { page: 1, mindate: `${year}-${month}-01` },
          signal,
        }),
      ]);
      const yearPlays = yearRes.data?.plays || [];
      const totalYear =
        typeof yearRes.data?.total === "number"
          ? yearRes.data.total
          : yearPlays.length;
      const totalMonth =
        typeof monthRes.data?.total === "number"
          ? monthRes.data.total
          : (monthRes.data?.plays || []).reduce(
              (sum, p) => sum + (p.quantity || 1),
              0,
            );
      const tally = {};
      for (const p of yearPlays) {
        if (!p.gameId) continue;
        const qty = p.quantity || 1;
        if (!tally[p.gameId]) tally[p.gameId] = { name: p.gameName || "", count: 0 };
        tally[p.gameId].count += qty;
      }
      const mostPlayed =
        Object.values(tally).sort((a, b) => b.count - a.count)[0] || null;
      return { totalYear, thisMonth: totalMonth, mostPlayed };
    },
    enabled: enabled && !!bggUsername,
  });
}

// Detalle de un juego BGG (nombre/imagen/año/tiempos de juego). Genuinamente
// compartido dentro de bg-watch: la vista por-juego, el form de carga de
// partida (duración sugerida) y "cargar con ?juego=" pueden pedir el MISMO
// gameId en la misma sesión.
export function useBggGameQuery(gameId, { enabled = true } = {}) {
  return useQuery({
    queryKey: bggKeys.game(gameId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.GAME(gameId), { signal });
      return data;
    },
    enabled: enabled && !!gameId,
    staleTime: 5 * 60_000,
  });
}
