import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { API } from "../api/endpoints";

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
];

const DEFAULT_ENABLED = {
  mesas: false,
  torneos: false,
  miFeed: false,
  mathtrade: false,
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

// Cota superior para que un backend colgado (responde lento o nunca) no deje el
// splash girando para siempre: a los 8s el request aborta y dispara backendDown.
const BOOT_TIMEOUT_MS = 8000;

export function SiteConfigProvider({ children }) {
  const { user } = useAuth();
  const [sections, setSections] = useState(defaultSections);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Reintenta el health-check de boot (botón "Reintentar" de la pantalla 500).
  // Re-dispara el effect, que vuelve a poner loaded=false (splash) y reevalúa.
  const retryConnection = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setBackendDown(false);
    axios
      .get(API.siteConfig, { timeout: BOOT_TIMEOUT_MS })
      .then(({ data }) => {
        if (cancelled) return;
        setSections(data.sections || defaultSections());
        setUpdatedAt(data.updatedAt || null);
        setUpdatedBy(data.updatedBy || null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isBackendDown(err)) setBackendDown(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // El user efectivo de AuthContext ya respeta viewAsUser (si admin con viewAsUser ON,
  // user.isAdmin === false). isSectionEnabled lo respeta automáticamente.
  const isSectionEnabled = useCallback(
    (name) => {
      if (user?.isAdmin) return true;
      return sections?.[name]?.enabled !== false;
    },
    [sections, user],
  );

  const applyServerConfig = useCallback((payload) => {
    if (!payload) return;
    if (payload.sections) setSections(payload.sections);
    if (payload.updatedAt) setUpdatedAt(payload.updatedAt);
    if (payload.updatedBy !== undefined) setUpdatedBy(payload.updatedBy);
  }, []);

  const updateConfig = useCallback(
    async (patch) => {
      const { data } = await axios.patch(API.siteConfig, { sections: patch });
      applyServerConfig(data);
      return data;
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
