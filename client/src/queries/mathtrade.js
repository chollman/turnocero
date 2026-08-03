import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

const PAGE_SIZE = 12;

export const mathtradeKeys = {
  all: ["mathtrade"],
  lists: () => [...mathtradeKeys.all, "list"],
  list: (filters) => [...mathtradeKeys.lists(), filters],
  details: () => [...mathtradeKeys.all, "detail"],
  detail: (id) => [...mathtradeKeys.details(), id],
  items: (id) => [...mathtradeKeys.detail(id), "items"],
  myItems: (id) => [...mathtradeKeys.detail(id), "myItems"],
  results: (id) => [...mathtradeKeys.detail(id), "results"],
};

// ── Reads ──────────────────────────────────────────────────────────────

// Portada /math-trade: "Cargar más" acumula páginas por tab de status —
// mismo patrón que useTorneosQuery/useEventosQuery.
export function useMathTradesQuery({ status } = {}) {
  return useInfiniteQuery({
    queryKey: mathtradeKeys.list({ status: status || null }),
    queryFn: async ({ pageParam, signal }) => {
      const params = { page: pageParam, limit: PAGE_SIZE };
      if (status) params.status = status;
      const { data } = await axios.get(API.mathtrade.LIST, {
        params,
        signal,
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });
}

export function useMathTradeQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: mathtradeKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.mathtrade.DETAIL(id), { signal });
      return data;
    },
    enabled: enabled && !!id,
    retry: false,
  });
}

export function useMathTradeItemsQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: mathtradeKeys.items(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.mathtrade.ITEMS(id), { signal });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// Solo tiene sentido con user logueado — el caller pasa `enabled: !!user`.
export function useMathTradeMyItemsQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: mathtradeKeys.myItems(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.mathtrade.MY_ITEMS(id), {
        signal,
      });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// Solo se pide cuando el trade está en status results/finished — el caller
// controla `enabled` con esa condición.
export function useMathTradeResultsQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: mathtradeKeys.results(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.mathtrade.RESULTS(id), {
        signal,
      });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// ── Writes ─────────────────────────────────────────────────────────────
// Funciones planas (no useMutation) — cada caller maneja su propio
// busy/error local alrededor del await, mismo criterio que el resto de la
// Fase 6.

export const createMathTrade = (formData) =>
  axios.post(API.mathtrade.LIST, formData);

export const updateMathTrade = (id, formData) =>
  axios.put(API.mathtrade.DETAIL(id), formData);

export const deleteMathTrade = (id) => axios.delete(API.mathtrade.DETAIL(id));

export const updateMathTradeStatus = (id, status) =>
  axios.patch(API.mathtrade.STATUS(id), { status });

export const runMathTradeMatching = (id, payload) =>
  axios.post(API.mathtrade.RUN_MATCHING(id), payload);

export const runMathTradeMatchingPreview = (id, payload) =>
  axios.post(API.mathtrade.RUN_MATCHING_PREVIEW(id), payload);

export const createMathTradeItem = (id, payload) =>
  axios.post(API.mathtrade.ITEMS(id), payload);

export const updateMathTradeItem = (id, itemId, payload) =>
  axios.put(API.mathtrade.ITEM(id, itemId), payload);

export const deleteMathTradeItem = (id, itemId) =>
  axios.delete(API.mathtrade.ITEM(id, itemId));
