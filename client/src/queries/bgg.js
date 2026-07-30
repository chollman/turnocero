import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const bggKeys = {
  search: (q) => ["bgg", "search", q],
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
