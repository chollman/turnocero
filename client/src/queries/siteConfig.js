import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const siteConfigKeys = {
  all: ["site-config"],
};

// Cota superior para que un backend colgado (responde lento o nunca) no deje
// el splash girando para siempre.
const BOOT_TIMEOUT_MS = 8000;

// El boot pega a /api/site-config (pública, corre siempre) y sirve como
// health-check: retry:false porque un solo intento fallido (timeout/5xx/
// network) ya significa "backend caído" — reintentar automático solo
// demoraría la detección. staleTime Infinity porque las actualizaciones en
// vivo llegan por socket (site-config:updated → queryClient.setQueryData en
// SiteConfigContext), no por poll/refetch.
export function useSiteConfigQuery() {
  return useQuery({
    queryKey: siteConfigKeys.all,
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(API.siteConfig, {
        timeout: BOOT_TIMEOUT_MS,
        signal,
      });
      return data;
    },
    staleTime: Infinity,
    retry: false,
  });
}
