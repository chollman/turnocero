import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const userKeys = {
  all: ["users"],
  lists: () => [...userKeys.all, "list"],
  list: (params) => [...userKeys.lists(), params],
  search: (search) => [...userKeys.all, "search", search],
  details: () => [...userKeys.all, "detail"],
  detail: (id) => [...userKeys.details(), id],
};

// ── Reads ──────────────────────────────────────────────────────────────

// Listado general /usuarios (UsersList), y variantes acotadas reutilizadas
// por widgets de otros dominios (ChatLauncher/Messages piden solo amigos).
export function useUsersListQuery(params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.users.LIST, { params, signal });
      return data || [];
    },
    enabled,
  });
}

// Búsqueda genérica de usuarios — usada por AddParticipantModal (torneos,
// admin_only inscription mode). Vivía en queries/torneos.js; se mudó acá al
// migrar el dominio usuarios (mismo endpoint que useUsersListQuery, con su
// propia key porque el caller debounea el input y no quiere pisar la cache
// del listado general).
export function useUserSearchQuery(search) {
  const trimmed = search?.trim() || "";
  return useQuery({
    queryKey: userKeys.search(trimmed),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.users.LIST, {
        params: trimmed ? { search: trimmed } : {},
        signal,
      });
      return data || [];
    },
    staleTime: 30_000,
  });
}

// Perfil público /usuarios/:id (UserProfilePublic) — también usado por
// MeFeed (friendsCount) y DirectChat (info de contacto).
export function useUserDetailQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.users.DETAIL(id), { signal });
      return data;
    },
    enabled: enabled && !!id,
  });
}

// ── Writes ─────────────────────────────────────────────────────────────
// Funciones planas (no useMutation) — cada caller maneja su propio
// busy/error local alrededor del await, mismo criterio que el resto de la
// Fase 6.

export const banUser = (userId, { banned, reason }) =>
  axios.patch(API.admin.USER_BAN(userId), { banned, reason });

export const deleteUser = (userId) => axios.delete(API.admin.USER_DELETE(userId));

export const sendFriendRequest = (id) => axios.post(API.friends.REQUEST(id));
export const cancelFriendRequest = (id) => axios.delete(API.friends.REQUEST(id));
export const acceptFriendRequest = (id) => axios.post(API.friends.ACCEPT(id));
export const rejectFriendRequest = (id) => axios.post(API.friends.REJECT(id));
export const unfriend = (id) => axios.delete(API.friends.UNFRIEND(id));

// Geocode manual (fallback del autocomplete de dirección en /perfil) — vive
// acá porque su único caller es UserProfile.jsx, aunque el endpoint sea
// genérico (no namespaced bajo /api/users).
export const geocodeAddress = (q) =>
  axios.get(API.geocode, { params: { q } }).then((r) => r.data);

// Conexión BGG + avatar (/perfil, sección "Conexión con BoardGameGeek" y
// "Avatar") — endpoints de /api/auth y /api/bgg, pero únicos callers en
// UserProfile.jsx. Cada una dispara `refreshUser()` del AuthContext después
// del await (mecanismo de invalidación existente, sin tocar).
export const connectBgg = (password) =>
  axios.post(API.auth.BGG_CONNECT, { password });
export const syncBgg = () => axios.post(API.bgg.SYNC).then((r) => r.data);
export const disconnectBgg = () => axios.delete(API.auth.BGG_CONNECTION);
export const uploadAvatar = (formData) =>
  axios.put(API.auth.AVATAR, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const removeAvatar = () => axios.delete(API.auth.AVATAR);
