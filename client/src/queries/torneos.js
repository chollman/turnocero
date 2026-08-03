import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

const PAGE_SIZE = 12;

export const torneoKeys = {
  all: ["torneos"],
  lists: () => [...torneoKeys.all, "list"],
  list: (filters) => [...torneoKeys.lists(), filters],
  details: () => [...torneoKeys.all, "detail"],
  detail: (id) => [...torneoKeys.details(), id],
  matches: (id) => [...torneoKeys.detail(id), "matches"],
  standings: (id) => [...torneoKeys.detail(id), "standings"],
  groups: (id, phase) => [...torneoKeys.detail(id), "groups", phase ?? null],
  nextPhasePreview: (id) => [...torneoKeys.detail(id), "next-phase-preview"],
};

// ── Reads ──────────────────────────────────────────────────────────────

// Portada /torneos: "Cargar más" acumula páginas por tab de status.
export function useTorneosQuery({ status } = {}) {
  return useInfiniteQuery({
    queryKey: torneoKeys.list({ status: status || null }),
    queryFn: async ({ pageParam, signal }) => {
      const params = { page: pageParam, limit: PAGE_SIZE };
      if (status) params.status = status;
      const { data } = await axios.get(API.torneos.LIST, { params, signal });
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });
}

export function useTorneoQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: torneoKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.torneos.DETAIL(id), { signal });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// League + single_elim únicamente — groups usa /groups en su lugar.
export function useTorneoMatchesQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: torneoKeys.matches(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.torneos.MATCHES(id), { signal });
      return data || [];
    },
    enabled: enabled && !!id,
  });
}

export function useTorneoStandingsQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: torneoKeys.standings(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.torneos.STANDINGS(id), {
        signal,
      });
      return data?.standings || [];
    },
    enabled: enabled && !!id,
  });
}

export function useTorneoGroupsQuery(id, phase, { enabled = true } = {}) {
  return useQuery({
    queryKey: torneoKeys.groups(id, phase),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.torneos.GROUPS(id), {
        params: { phase },
        signal,
      });
      return data;
    },
    enabled: enabled && !!id,
  });
}

export function useTorneoNextPhasePreviewQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: torneoKeys.nextPhasePreview(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.torneos.NEXT_PHASE_PREVIEW(id), {
        signal,
      });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// ── Writes ─────────────────────────────────────────────────────────────
// Funciones planas (no useMutation) — cada caller ya maneja su propio
// busy/error local alrededor del await, mismo criterio que mesas/noticias.

export const createTorneo = (formData) =>
  axios.post(API.torneos.LIST, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateTorneo = (id, formData) =>
  axios.put(API.torneos.DETAIL(id), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteTorneo = (id) => axios.delete(API.torneos.DETAIL(id));

export const changeTorneoStatus = (id, status) =>
  axios.patch(API.torneos.STATUS(id), { status });

export const resetTorneo = (id) => axios.post(API.torneos.RESET(id));

export const registerForTorneo = (id) => axios.post(API.torneos.REGISTER(id));
export const cancelTorneoRegistration = (id) =>
  axios.delete(API.torneos.REGISTER(id));

export const acceptRegistration = (id, userId) =>
  axios.post(API.torneos.REGISTRATION_ACCEPT(id, userId));
export const rejectRegistration = (id, userId) =>
  axios.post(API.torneos.REGISTRATION_REJECT(id, userId));

export const addParticipant = (id, userId) =>
  axios.post(API.torneos.PARTICIPANT(id, userId));
export const removeParticipant = (id, userId) =>
  axios.delete(API.torneos.PARTICIPANT(id, userId));

export const reorderSeeds = (id, participantIds) =>
  axios.patch(API.torneos.SEEDS(id), { participantIds });

export const recordMatchResult = (id, matchId, payload) =>
  axios.post(API.torneos.MATCH_RESULT(id, matchId), payload);
export const undoMatchResult = (id, matchId) =>
  axios.delete(API.torneos.MATCH_RESULT(id, matchId));

export const recordGameResult = (id, gameId, results) =>
  axios.post(API.torneos.GAME_RESULT(id, gameId), { results });
export const undoGameResult = (id, gameId) =>
  axios.delete(API.torneos.GAME_RESULT(id, gameId));

export const saveGroupAdvanced = (id, groupId, advancedPlayers) =>
  axios.patch(API.torneos.GROUP_ADVANCED(id, groupId), { advancedPlayers });

export const generateNextPhase = (id, payload) =>
  axios.post(API.torneos.NEXT_PHASE(id), payload || {});
