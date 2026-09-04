import { createContext, useContext, useCallback, useMemo } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { API } from "../api/endpoints";
import { useSiteConfigQuery, siteConfigKeys } from "../queries/siteConfig";

const SECTION_KEYS = [
  "mesas",
  "compartidas",
  "noticias",
  "torneos",
  "eventos",
  "comunidad",
  "miFeed",
  "amigos",
  "dms",
  "bgwatch",
  "utilidades",
  "colabora",
  "calendario",
  "mathtrade",
  "comunidades",
  "instagramCrosspost",
];

const DEFAULT_ENABLED = {
  mesas: false,
  torneos: false,
  miFeed: false,
  mathtrade: false,
  instagramCrosspost: false,
};

const defaultFor = (key) => DEFAULT_ENABLED[key] !== false;

const defaultSections = () =>
  SECTION_KEYS.reduce((acc, key) => {
    acc[key] = { enabled: defaultFor(key) };
    return acc;
  }, {});

const SiteConfigContext = createContext(null);

// El boot pega a /api/site-config (request pública que corre siempre). Si falla
// por caída del backend lo usamos como health-check: sin respuesta (connection
// refused / timeout / CORS) o un 5xx ⇒ backend caído. Un 4xx significa que el
// server está vivo (solo rechazó la request) y NO se trata como caída.
const isBackendDown = (err) => !err?.response || err.response.status >= 500;

export function SiteConfigProvider({ children }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, error, isFetching, refetch } = useSiteConfigQuery();
  const sections = data?.sections ?? defaultSections();
  const updatedAt = data?.updatedAt ?? null;
  const updatedBy = data?.updatedBy ?? null;

  // `isFetching` cubre tanto la carga inicial como un refetch manual (retry) —
  // así loaded/backendDown se resetean optimistamente durante CUALQUIER
  // (re)intento, igual que el useState+useEffect que reemplazan (que hacía
  // setLoaded(false); setBackendDown(false) al arrancar cada fetch). React
  // Query mantiene el `error` viejo visible mientras refetchea, por eso
  // backendDown también chequea `!isFetching` — si no, el reintento seguiría
  // mostrando la pantalla 500 vieja hasta que resuelva.
  const loaded = !isFetching;
  const backendDown = !isFetching && !!error && isBackendDown(error);

  // Reintenta el health-check de boot (botón "Reintentar" de la pantalla 500).
  const retryConnection = useCallback(() => {
    refetch();
  }, [refetch]);

  // El user efectivo de AuthContext ya respeta viewAsUser (si admin con viewAsUser ON,
  // user.isAdmin === false). isSectionEnabled lo respeta automáticamente.
  const isSectionEnabled = useCallback(
    (name) => {
      if (user?.isAdmin) return true;
      return sections?.[name]?.enabled !== false;
    },
    [sections, user],
  );

  // Recibe el config empujado por socket (site-config:updated) o el resultado
  // de updateConfig — escribe directo al cache de TanStack Query.
  const applyServerConfig = useCallback(
    (payload) => {
      if (!payload) return;
      queryClient.setQueryData(siteConfigKeys.all, (prev) => ({
        sections: payload.sections ?? prev?.sections,
        updatedAt: payload.updatedAt ?? prev?.updatedAt,
        updatedBy:
          payload.updatedBy !== undefined ? payload.updatedBy : prev?.updatedBy,
      }));
    },
    [queryClient],
  );

  const updateConfig = useCallback(
    async (patch) => {
      const { data: res } = await axios.patch(API.siteConfig, {
        sections: patch,
      });
      applyServerConfig(res);
      return res;
    },
    [applyServerConfig],
  );

  const value = useMemo(
    () => ({
      sections,
      loaded,
      backendDown,
      retryConnection,
      updatedAt,
      updatedBy,
      isSectionEnabled,
      updateConfig,
      applyServerConfig,
      SECTION_KEYS,
    }),
    [
      sections,
      loaded,
      backendDown,
      retryConnection,
      updatedAt,
      updatedBy,
      isSectionEnabled,
      updateConfig,
      applyServerConfig,
    ],
  );

  return (
    <SiteConfigContext.Provider value={value}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx)
    throw new Error("useSiteConfig must be used within SiteConfigProvider");
  return ctx;
}
