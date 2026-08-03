import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const communityKeys = {
  mias: (userId) => ["community", "mias", userId ?? null],
  tenant: (slug) => ["community", "tenant", slug ?? null],
  adminList: () => ["community", "admin", "list"],
};

// Membresías + preferencias (viewing/skin) del user logueado.
export function useMyCommunityQuery(userId) {
  return useQuery({
    queryKey: communityKeys.mias(userId),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.comunidades.MIAS, { signal });
      return {
        memberships: data.memberships || [],
        viewing: (data.viewing || []).map(String),
        skin: data.skin ? String(data.skin) : null,
      };
    },
    enabled: !!userId,
    // Igual que el catch original: sección deshabilitada o error de red no es
    // un estado de error visible para el usuario, cae a "modo solo-base" —
    // los consumidores leen memberships/viewing/skin con `?? []`/`?? null`,
    // así que reintentar no aporta y solo demora el fallback.
    retry: false,
  });
}

// Comunidad del subdominio (modo tenant) — se resuelve una sola vez, el slug
// no cambia en runtime.
export function useTenantCommunityQuery(slug) {
  return useQuery({
    queryKey: communityKeys.tenant(slug),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.comunidades.DETAIL(slug), {
        signal,
      });
      return data?.subdomainEnabled ? data : null;
    },
    enabled: !!slug,
    staleTime: Infinity,
    retry: false,
  });
}

// ── Admin (CommunitiesAdmin, embebido en PanelAdmin) ────────────────────
// Distinto del resto del archivo: acá vive la gestión global de comunidades
// (crear/editar/borrar/skin/logo), no las preferencias del usuario logueado.

// Listado completo para el panel admin — sin paginación (el server devuelve
// todas de una).
export function useCommunitiesAdminListQuery() {
  return useQuery({
    queryKey: communityKeys.adminList(),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.comunidades.LIST, { signal });
      return data.comunidades || [];
    },
  });
}

// ── Admin writes ──
// Funciones planas — el caller (CommunitiesAdmin.jsx) invalida
// `communityKeys.adminList()` tras cada una, igual que el `await load()`
// manual que reemplazan.

export const createCommunity = (form) =>
  axios.post(API.comunidades.LIST, form);

export const deleteCommunity = (slug) =>
  axios.delete(API.comunidades.DETAIL(slug));

export const reassignCommunityToBase = (slug) =>
  axios.post(API.comunidades.REASSIGN_TO_BASE(slug));

export const updateCommunity = (slug, patch) =>
  axios.put(API.comunidades.DETAIL(slug), patch);

export const updateCommunitySkin = (slug, skin) =>
  axios.put(API.comunidades.SKIN(slug), skin);

export const uploadCommunityLogo = (slug, formData) =>
  axios.post(API.comunidades.LOGO(slug), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
