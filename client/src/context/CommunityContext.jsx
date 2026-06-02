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

  const value = useMemo(
    () => ({
      memberships,
      viewing,
      effectiveViewing,
      skin,
      skinCommunity,
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
