import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import { API } from "../api/endpoints";
import { buildSkinCss } from "../utils/skin";
import { detectTenant } from "../utils/tenant";

const SKIN_STORAGE_KEY = "turnocero_skin";

// Slug del subdominio de comunidad, resuelto UNA vez (no cambia en runtime).
const TENANT_SLUG = detectTenant()?.slug || null;

// Nombre de marca del tenant, cacheado dentro del skin de localStorage (lo
// escribe el effect de skin). Se lee UNA vez, síncrono, al cargar el módulo:
// sirve de fallback mientras el GET del tenant está en vuelo, así el
// SplashScreen (y el wordmark) muestran el nombre de la comunidad en vez de
// "TurnoCero" en un subdominio (FOUC). Solo si el slug cacheado coincide.
const CACHED_TENANT_BRAND = (() => {
  if (!TENANT_SLUG) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(SKIN_STORAGE_KEY) || "null");
    return raw && raw.slug === TENANT_SLUG ? raw.brandName || null : null;
  } catch {
    return null;
  }
})();

// Exportado para que consumidores que son DESCENDIENTES del provider (p. ej.
// NotificationProvider) puedan leer el contexto de forma null-safe con
// useContext(CommunityContext) sin que `useCommunity()` tire si falta el
// provider (útil en tests que montan NotificationProvider aislado).
export const CommunityContext = createContext(null);

// Maneja la pertenencia del usuario a comunidades y sus preferencias de
// visualización (qué comunidades ve "juntas" + cuál skin aplica). Deriva del
// User (AuthContext es la fuente de verdad de las prefs) y trae los datos ricos
// (nombres/logos/sections) vía GET /api/comunidades/mias.
export function CommunityProvider({ children }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState([]); // [{ community, role, joinedAt }]
  const [viewing, setViewing] = useState([]); // ids (string)
  const [skin, setSkin] = useState(null); // id (string)
  const [loaded, setLoaded] = useState(false);
  // Se incrementa SOLO cuando el usuario cambia su `viewing` (los checks del
  // selector). Alimenta el `key` de las rutas en App.jsx para remontar la
  // página visible y re-fetchear su contenido con el nuevo scope, en tiempo
  // real. No se toca en la carga inicial ni al cambiar el skin (el skin no
  // afecta qué contenido se ve).
  const [viewingVersion, setViewingVersion] = useState(0);

  // ── Modo tenant (subdominio de comunidad) ────────────────────────────────
  // Si entramos por `<slug>.turnocero.com`, traemos esa comunidad (su skin /
  // sections / marca) aunque el visitante no sea miembro ni esté logueado, y
  // acotamos TODO a ella. `GET /:slug` es público (optionalAuth). Solo entramos
  // en modo tenant si la comunidad tiene `subdomainEnabled` (el server scopea
  // bajo esa misma condición — así cliente y server quedan en sync).
  const [tenantCommunity, setTenantCommunity] = useState(null);

  useEffect(() => {
    if (!TENANT_SLUG) return undefined;
    const ac = new AbortController();
    axios
      .get(API.comunidades.DETAIL(TENANT_SLUG), { signal: ac.signal })
      .then(({ data }) => {
        setTenantCommunity(data?.subdomainEnabled ? data : null);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setTenantCommunity(null);
      });
    return () => ac.abort();
  }, []);

  const isTenant = !!tenantCommunity;

  const userId = user?._id || null;

  const load = useCallback(async () => {
    if (!userId) {
      setMemberships([]);
      setViewing([]);
      setSkin(null);
      setLoaded(true);
      return;
    }
    try {
      const { data } = await axios.get(API.comunidades.MIAS);
      setMemberships(data.memberships || []);
      setViewing((data.viewing || []).map(String));
      setSkin(data.skin ? String(data.skin) : null);
    } catch {
      // Sección comunidades deshabilitada o error de red → modo solo-base.
      setMemberships([]);
      setViewing([]);
      setSkin(null);
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // La comunidad-skin resuelta (objeto completo) desde las memberships.
  const skinCommunity = useMemo(() => {
    if (!skin) return null;
    const m = memberships.find((mm) => String(mm.community._id) === skin);
    return m ? m.community : null;
  }, [skin, memberships]);

  // En modo tenant el skin / marca / sections salen SIEMPRE de la comunidad del
  // subdominio (forzado, incluso para no-miembros y anónimos). Si no, el skin
  // que el usuario eligió.
  const effectiveSkinCommunity = isTenant ? tenantCommunity : skinCommunity;

  // ── Motor de reskin ──────────────────────────────────────────────────
  // Inyecta/actualiza el <style id="community-skin"> con los overrides de la
  // comunidad-skin + setea `data-community`. En useLayoutEffect para que el CSS
  // aplique ANTES de que cualquier lector de getComputedStyle corra. Persiste a
  // localStorage para que el script FOUC de index.html lo reaplique sin flash.
  useLayoutEffect(() => {
    const root = document.documentElement;
    let styleEl = document.getElementById("community-skin");

    // Base o sin skin → sin override (la base usa los tokens estándar).
    if (!effectiveSkinCommunity || effectiveSkinCommunity.isBase) {
      root.removeAttribute("data-community");
      if (styleEl) styleEl.textContent = "";
      try {
        localStorage.removeItem(SKIN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    const slug = effectiveSkinCommunity.slug;
    const css = buildSkinCss(slug, effectiveSkinCommunity.skin);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "community-skin";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
    root.setAttribute("data-community", slug);
    // Cacheamos también el nombre de marca para el fallback síncrono del splash
    // (ver CACHED_TENANT_BRAND). Mismo valor que resuelve `brand.name`.
    const brandName =
      effectiveSkinCommunity.skin?.brandName ||
      effectiveSkinCommunity.name ||
      "";
    try {
      localStorage.setItem(
        SKIN_STORAGE_KEY,
        JSON.stringify({ slug, css, brandName }),
      );
    } catch {
      /* ignore */
    }
  }, [effectiveSkinCommunity]);

  // Viewing efectivo: el subconjunto curado intersectado con las memberships;
  // vacío = todas (espeja la lógica del server).
  const effectiveViewing = useMemo(() => {
    // Modo tenant: el contenido se acota SIEMPRE a la comunidad del subdominio.
    if (isTenant) return [String(tenantCommunity._id)];
    const memberIds = memberships.map((m) => String(m.community._id));
    if (!viewing.length) return memberIds;
    return viewing.filter((v) => memberIds.includes(v));
  }, [isTenant, tenantCommunity, viewing, memberships]);

  // Resolutor id → comunidad (objeto completo) desde las memberships. Lo usa
  // <ItemCommunityTag> para etiquetar cada item del feed combinado con su
  // comunidad. Cada item viene de una comunidad que el usuario integra (el
  // scoping del server lo garantiza), así que siempre resuelve.
  const communityById = useMemo(() => {
    const map = new Map(
      memberships.map((m) => [String(m.community._id), m.community]),
    );
    // En modo tenant los items vienen todos de la comunidad del subdominio, que
    // el visitante puede no integrar — asegurar que resuelva igual.
    if (isTenant) map.set(String(tenantCommunity._id), tenantCommunity);
    return map;
  }, [memberships, isTenant, tenantCommunity]);

  const savePrefs = useCallback(async (patch) => {
    const { data } = await axios.put(API.comunidades.PREFERENCIAS, patch);
    setViewing((data.viewing || []).map(String));
    setSkin(data.skin ? String(data.skin) : null);
    return data;
  }, []);

  const setViewingPref = useCallback(
    async (ids) => {
      const result = await savePrefs({ viewing: ids.map(String) });
      // Bump tras persistir → remonta la página actual con el scope nuevo.
      setViewingVersion((v) => v + 1);
      return result;
    },
    [savePrefs],
  );

  const setSkinPref = useCallback(
    (id) => savePrefs({ skin: String(id) }),
    [savePrefs],
  );

  const joinCommunity = useCallback(
    async (slug, code) => {
      const { data } = await axios.post(
        API.comunidades.JOIN(slug),
        code ? { code } : {},
      );
      await load();
      return data; // { status: 'joined' | 'pending' }
    },
    [load],
  );

  const leaveCommunity = useCallback(
    async (slug) => {
      await axios.delete(API.comunidades.LEAVE(slug));
      await load();
    },
    [load],
  );

  // Gating de sección por comunidad-skin: una sección está habilitada salvo que
  // la comunidad-skin la apague explícitamente en su override `sections`.
  const isSectionEnabledInSkin = useCallback(
    (key) => {
      const sections = effectiveSkinCommunity?.sections;
      if (!sections) return true;
      return sections[key] !== false;
    },
    [effectiveSkinCommunity],
  );

  // Identidad de marca de la comunidad-skin activa (nombre + logos), con
  // fallback a "TurnoCero" / assets base. Si solo se subió un logo, se usa para
  // ambos temas.
  const brand = useMemo(() => {
    const s = effectiveSkinCommunity?.skin;
    // En modo tenant (subdominio o ?tenant=<slug>), la marca del sidebar se
    // transforma en la de la comunidad: si su skin no definió un `brandName`,
    // usamos el nombre de la comunidad en vez de caer a "TurnoCero".
    // Mientras el GET del tenant está en vuelo (isTenant aún false), usamos el
    // nombre cacheado del subdominio para que el splash no muestre "TurnoCero".
    const fallbackName =
      (isTenant && effectiveSkinCommunity?.name) ||
      (TENANT_SLUG ? CACHED_TENANT_BRAND : null) ||
      "TurnoCero";
    return {
      name: s?.brandName || fallbackName,
      tagline: s?.tagline || "",
      logoLight: s?.logoLight?.url || s?.logoDark?.url || "",
      logoDark: s?.logoDark?.url || s?.logoLight?.url || "",
    };
  }, [isTenant, effectiveSkinCommunity]);

  const value = useMemo(
    () => ({
      memberships,
      viewing,
      effectiveViewing,
      communityById,
      skin,
      skinCommunity,
      // Modo tenant (subdominio de comunidad): `isTenant` lo consumen los
      // componentes para ocultar la UI cruzada (selector, directorio, "Publicar
      // en") y forzar la comunidad. `tenant` es el doc de esa comunidad.
      tenant: tenantCommunity,
      isTenant,
      brand,
      loaded,
      viewingVersion,
      setViewingPref,
      setSkinPref,
      joinCommunity,
      leaveCommunity,
      reload: load,
      isSectionEnabledInSkin,
    }),
    [
      memberships,
      viewing,
      effectiveViewing,
      communityById,
      skin,
      skinCommunity,
      tenantCommunity,
      isTenant,
      brand,
      loaded,
      viewingVersion,
      setViewingPref,
      setSkinPref,
      joinCommunity,
      leaveCommunity,
      load,
      isSectionEnabledInSkin,
    ],
  );

  return (
    <CommunityContext.Provider value={value}>
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx)
    throw new Error("useCommunity must be used within CommunityProvider");
  return ctx;
}
