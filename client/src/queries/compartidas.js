import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

const PAGE_SIZE = 10;

export const compartidaKeys = {
  all: ["compartidas"],
  lists: () => [...compartidaKeys.all, "list"],
  list: (filters) => [...compartidaKeys.lists(), filters],
  stats: () => [...compartidaKeys.all, "stats"],
  byGame: (bggId) => [...compartidaKeys.all, "byGame", bggId],
  details: () => [...compartidaKeys.all, "detail"],
  detail: (id) => [...compartidaKeys.details(), id],
  comments: (id) => [...compartidaKeys.detail(id), "comments"],
};

// ── Reads ──────────────────────────────────────────────────────────────

// Feed principal (tabs todo/resena/juntada + búsqueda). page1 trae además
// `featured` (compartida del día) — vive en `pages[0].featured`.
export function useCompartidasFeedQuery({ category, q } = {}) {
  return useInfiniteQuery({
    queryKey: compartidaKeys.list({
      category: category || null,
      q: q?.trim() || "",
    }),
    queryFn: async ({ pageParam, signal }) => {
      const params = { page: pageParam, limit: PAGE_SIZE };
      if (category) params.category = category;
      if (q) params.q = q;
      const { data } = await axios.get(API.compartidas.LIST, {
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

// Stats globales del hero (total + últimos 7 días) — decoupladas del feed,
// un solo fetch por visita a la sección.
export function useCompartidaStatsQuery() {
  return useQuery({
    queryKey: compartidaKeys.stats(),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.compartidas.STATS, { signal });
      return data;
    },
  });
}

export function useCompartidaQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: compartidaKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.compartidas.DETAIL(id), {
        signal,
      });
      return data;
    },
    enabled: enabled && !!id,
    retry: false,
  });
}

// Reseñas por juego (página de descubrimiento /compartidas/juego/:bggId).
export function useReviewsByGameQuery(bggId) {
  return useInfiniteQuery({
    queryKey: compartidaKeys.byGame(bggId),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await axios.get(API.compartidas.BY_GAME(bggId), {
        params: { page: pageParam, limit: PAGE_SIZE },
        signal,
      });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: !!bggId,
    retry: false,
  });
}

// Comentarios (top-level con `.replies` anidadas, 1 nivel). Paginado
// incremental — el mismo patrón infinite que el feed, así las mutaciones
// (add/reply/edit/delete/like) parchean {pages:[...]} cross-page.
export function useCompartidaCommentsQuery(compartidaId) {
  return useInfiniteQuery({
    queryKey: compartidaKeys.comments(compartidaId),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await axios.get(
        API.compartidas.COMMENTS(compartidaId),
        { params: { page: pageParam, limit: PAGE_SIZE }, signal },
      );
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: !!compartidaId,
  });
}

// ── Writes ─────────────────────────────────────────────────────────────
// Funciones planas (no useMutation) — cada caller maneja su propio
// busy/error local, mismo criterio que Fases 2-6. La creación con imágenes
// (2 fases + cleanup) queda en ./compartidas/createJuntada.js — compartida
// también con el flujo de BG Watch "Compartí esta partida".

export const updateCompartida = (id, payload) =>
  axios.put(API.compartidas.DETAIL(id), payload);
export const deleteCompartida = (id) => axios.delete(API.compartidas.DETAIL(id));
export const toggleCompartidaLike = (id) => axios.post(API.compartidas.LIKE(id));

export const addCompartidaImage = (id, formData) =>
  axios.post(API.compartidas.IMAGES(id), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const removeCompartidaImage = (id, imgId) =>
  axios.delete(API.compartidas.IMAGE_DETAIL(id, imgId));

export const addCompartidaComment = (compartidaId, payload) =>
  axios.post(API.compartidas.COMMENTS(compartidaId), payload);
export const editCompartidaComment = (compartidaId, commentId, content) =>
  axios.put(API.compartidas.COMMENT_DETAIL(compartidaId, commentId), {
    content,
  });
export const deleteCompartidaComment = (compartidaId, commentId) =>
  axios.delete(API.compartidas.COMMENT_DETAIL(compartidaId, commentId));
export const toggleCompartidaCommentLike = (compartidaId, commentId) =>
  axios.post(API.compartidas.COMMENT_LIKE(compartidaId, commentId));

// Reintenta un target de cross-post a Instagram que falló — re-encola
// (status vuelve a "pending", el cron jobs/instagramPublish.js lo retoma).
// Único caller: el badge de estado en CompartidaCard.jsx.
export const retryInstagramPost = (compartidaId, target) =>
  axios.post(API.compartidas.INSTAGRAM_POST(compartidaId), {
    [target]: true,
  });
