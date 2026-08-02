import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const bggKeys = {
  search: (q) => ["bgg", "search", q],
  coleccion: (bggUsername) => ["bgg", "coleccion", bggUsername],
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
