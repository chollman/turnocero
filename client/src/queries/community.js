import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const communityKeys = {
  mias: (userId) => ["community", "mias", userId ?? null],
  tenant: (slug) => ["community", "tenant", slug ?? null],
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
