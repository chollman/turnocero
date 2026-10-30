import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

// Panel admin — usuarios habilitados para features en piloto
// (server/config/betaFeatures.js).
export const betaKeys = {
  all: ["admin", "beta"],
  users: (feature) => [...betaKeys.all, feature, "users"],
};

// ── Reads ──────────────────────────────────────────────────────────────

export function useBetaUsersQuery(feature) {
  return useQuery({
    queryKey: betaKeys.users(feature),
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.admin.BETA_USERS(feature), {
        signal,
      });
      return data || [];
    },
  });
}

// ── Writes (el caller invalida `betaKeys.users(feature)`) ──────────────

export async function addBetaUser(feature, userId) {
  const { data } = await axios.put(API.admin.BETA_USER(feature, userId));
  return data;
}

export async function removeBetaUser(feature, userId) {
  const { data } = await axios.delete(API.admin.BETA_USER(feature, userId));
  return data;
}
