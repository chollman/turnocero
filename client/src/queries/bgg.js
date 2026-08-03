import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const bggKeys = {
  search: (q) => ["bgg", "search", q],
  coleccion: (bggUsername) => ["bgg", "coleccion", bggUsername],
  homeStats: (bggUsername) => ["bgg", "homeStats", bggUsername],
};

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
export function useBggCollectionQuery(bggUsername, { enabled = true } = {}) {
  return useQuery({
    queryKey: bggKeys.coleccion(bggUsername),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.bgg.COLECCION(bggUsername), {
        signal,
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: enabled && !!bggUsername,
    staleTime: 5 * 60_000,
  });
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
