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

const SKIN_STORAGE_KEY = "turnocero_skin";

const CommunityContext = createContext(null);

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

  // ── Motor de reskin ──────────────────────────────────────────────────
  // Inyecta/actualiza el <style id="community-skin"> con los overrides de la
  // comunidad-skin + setea `data-community`. En useLayoutEffect para que el CSS
  // aplique ANTES de que cualquier lector de getComputedStyle corra. Persiste a
  // localStorage para que el script FOUC de index.html lo reaplique sin flash.
  useLayoutEffect(() => {
    const root = document.documentElement;
    let styleEl = document.getElementById("community-skin");

    // Base o sin skin → sin override (la base usa los tokens estándar).
    if (!skinCommunity || skinCommunity.isBase) {
      root.removeAttribute("data-community");
      if (styleEl) styleEl.textContent = "";
      try {
        localStorage.removeItem(SKIN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    const slug = skinCommunity.slug;
    const css = buildSkinCss(slug, skinCommunity.skin);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "community-skin";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
    root.setAttribute("data-community", slug);
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify({ slug, css }));
    } catch {
      /* ignore */
    }
  }, [skinCommunity]);

  // Viewing efectivo: el subconjunto curado intersectado con las memberships;
  // vacío = todas (espeja la lógica del server).
  const effectiveViewing = useMemo(() => {
    const memberIds = memberships.map((m) => String(m.community._id));
    if (!viewing.length) return memberIds;
    return viewing.filter((v) => memberIds.includes(v));
  }, [viewing, memberships]);

  const savePrefs = useCallback(async (patch) => {
    const { data } = await axios.put(API.comunidades.PREFERENCIAS, patch);
    setViewing((data.viewing || []).map(String));
    setSkin(data.skin ? String(data.skin) : null);
    return data;
  }, []);

  const setViewingPref = useCallback(
    (ids) => savePrefs({ viewing: ids.map(String) }),
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
      const sections = skinCommunity?.sections;
      if (!sections) return true;
      return sections[key] !== false;
    },
    [skinCommunity],
  );

  // Identidad de marca de la comunidad-skin activa (nombre + logos), con
  // fallback a "TurnoCero" / assets base. Si solo se subió un logo, se usa para
  // ambos temas.
  const brand = useMemo(() => {
    const s = skinCommunity?.skin;
    return {
      name: s?.brandName || "TurnoCero",
      tagline: s?.tagline || "",
      logoLight: s?.logoLight?.url || s?.logoDark?.url || "",
      logoDark: s?.logoDark?.url || s?.logoLight?.url || "",
    };
  }, [skinCommunity]);

  const value = useMemo(
    () => ({
      memberships,
      viewing,
      effectiveViewing,
      skin,
      skinCommunity,
      brand,
      loaded,
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
      skin,
      skinCommunity,
      brand,
      loaded,
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
