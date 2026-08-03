import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const tableKeys = {
  all: ["tables"],
  lists: () => [...tableKeys.all, "list"],
  list: (filters) => [...tableKeys.lists(), filters],
  details: () => [...tableKeys.all, "detail"],
  detail: (id) => [...tableKeys.details(), id],
  messages: (id) => [...tableKeys.detail(id), "messages"],
  comments: (id) => [...tableKeys.detail(id), "comments"],
  ratings: (id) => [...tableKeys.detail(id), "ratings"],
};

// ── Reads ──────────────────────────────────────────────────────────────

// Lista paginada (Dashboard). Página por número (no infinite-scroll), así
// que un useQuery simple alcanza — cada combinación de filtros/página tiene
// su propia entrada de cache.
export function useTablesQuery({
  useMineEndpoint,
  page,
  search,
  radiusKm,
  enabled = true,
}) {
  return useQuery({
    queryKey: tableKeys.list({
      endpoint: useMineEndpoint ? "mine" : "list",
      page,
      search: search || "",
      radiusKm: radiusKm || 0,
    }),
    queryFn: async ({ signal }) => {
      const url = useMineEndpoint ? API.tables.MINE : API.tables.LIST;
      const params = { page, limit: 12 };
      if (search) params.search = search;
      if (radiusKm > 0) params.maxDistanceKm = radiusKm;
      const { data } = await axios.get(url, { params, signal });
      return data;
    },
    enabled,
  });
}

// "Top juegos" del sidebar de Compartidas — público (optionalAuth), prueba
// social de que la comunidad está activa.
export function useTopGamesQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: [...tableKeys.all, "topGames"],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.tables.TOP_GAMES, { signal });
      return data;
    },
    enabled,
  });
}

// "Tus mesas" del sidebar de Compartidas — próximas 3, personal. Query propia
// (no reutiliza useTablesQuery) para no forzar `limit` en su query key.
export function useMyUpcomingTablesQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: [...tableKeys.all, "myUpcoming"],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.tables.MINE, {
        params: { limit: 4 },
        signal,
      });
      return data.tables || [];
    },
    enabled,
  });
}

export function useTableQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: tableKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.tables.DETAIL(id), { signal });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// Cache-only, mismo patrón que notifications/dm (ver Fases 3 y 5): el chat
// de mesa arranca con un boot fetch explícito + se mantiene al día vía un
// socket propio (room por mesa, no el socket compartido de NotificationContext).
export function useTableMessagesQuery(tableId) {
  return useQuery({
    queryKey: tableKeys.messages(tableId),
    queryFn: () => [],
    enabled: false,
  });
}

export function useTableCommentsQuery(tableId) {
  return useQuery({
    queryKey: tableKeys.comments(tableId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.tables.COMMENTS(tableId), {
        signal,
      });
      return data;
    },
    enabled: !!tableId,
  });
}

export function useTableRatingsQuery(tableId) {
  return useQuery({
    queryKey: tableKeys.ratings(tableId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.tables.RATINGS(tableId), {
        signal,
      });
      return data; // { ratings, avg, count }
    },
    enabled: !!tableId,
  });
}

// ── Writes ─────────────────────────────────────────────────────────────
// Funciones planas (no useMutation) — cada caller ya maneja su propio
// busy/error local alrededor del await, mismo criterio que Fases 2-5.
// Quien las llama decide qué hacer con la cache (queryClient.setQueryData
// directo, o burbujear el resultado a través del prop callback que ya
// existía, según el caso).

export const joinTable = (id) => axios.post(API.tables.JOIN(id));
export const leaveTable = (id) => axios.post(API.tables.LEAVE(id));
export const cancelJoinRequest = (id) => axios.delete(API.tables.REQUEST(id));
export const cancelTable = (id) => axios.delete(API.tables.DETAIL(id));
export const followTable = (id) => axios.post(API.tables.FOLLOW(id));
export const acceptJoinRequest = (id, userId) =>
  axios.post(API.tables.REQUEST_ACCEPT(id, userId));
export const rejectJoinRequest = (id, userId) =>
  axios.post(API.tables.REQUEST_REJECT(id, userId));

export const createTable = (payload) => axios.post(API.tables.LIST, payload);
export const updateTable = (id, payload) =>
  axios.put(API.tables.DETAIL(id), payload);

export const sendTableMessage = (tableId, content) =>
  axios.post(API.tables.MESSAGES(tableId), { content });

export const addTableComment = (tableId, payload) =>
  axios.post(API.tables.COMMENTS(tableId), payload);
export const editTableComment = (tableId, commentId, content) =>
  axios.put(API.tables.COMMENT_DETAIL(tableId, commentId), { content });
export const deleteTableComment = (tableId, commentId) =>
  axios.delete(API.tables.COMMENT_DETAIL(tableId, commentId));
export const toggleTableCommentLike = (tableId, commentId) =>
  axios.post(API.tables.COMMENT_LIKE(tableId, commentId));

export const submitTableRating = (tableId, payload) =>
  axios.post(API.tables.RATINGS(tableId), payload);

export const uploadTableImage = (tableId, formData) =>
  axios.post(API.tables.IMAGES(tableId), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const deleteTableImage = (tableId, imageId) =>
  axios.delete(API.tables.IMAGE_DETAIL(tableId, imageId));
