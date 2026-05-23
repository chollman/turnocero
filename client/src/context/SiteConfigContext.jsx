import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API } from '../api/endpoints';

const SECTION_KEYS = [
  'mesas',
  'compartidas',
  'noticias',
  'torneos',
  'eventos',
  'comunidad',
  'miFeed',
  'amigos',
  'dms',
  'bgwatch',
  'utilidades',
];

const DEFAULT_ENABLED = {
  mesas: false,
  torneos: false,
  miFeed: false,
};

const defaultFor = (key) => DEFAULT_ENABLED[key] !== false;

const defaultSections = () =>
  SECTION_KEYS.reduce((acc, key) => {
    acc[key] = { enabled: defaultFor(key) };
    return acc;
  }, {});

const SiteConfigContext = createContext(null);

export function SiteConfigProvider({ children }) {
  const { user } = useAuth();
  const [sections, setSections] = useState(defaultSections);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios.get(API.siteConfig)
      .then(({ data }) => {
        if (cancelled) return;
        setSections(data.sections || defaultSections());
        setUpdatedAt(data.updatedAt || null);
        setUpdatedBy(data.updatedBy || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // El user efectivo de AuthContext ya respeta viewAsUser (si admin con viewAsUser ON,
  // user.isAdmin === false). isSectionEnabled lo respeta automáticamente.
  const isSectionEnabled = useCallback((name) => {
    if (user?.isAdmin) return true;
    return sections?.[name]?.enabled !== false;
  }, [sections, user]);

  const applyServerConfig = useCallback((payload) => {
    if (!payload) return;
    if (payload.sections) setSections(payload.sections);
    if (payload.updatedAt) setUpdatedAt(payload.updatedAt);
    if (payload.updatedBy !== undefined) setUpdatedBy(payload.updatedBy);
  }, []);

  const updateConfig = useCallback(async (patch) => {
    const { data } = await axios.patch(API.siteConfig, { sections: patch });
    applyServerConfig(data);
    return data;
  }, [applyServerConfig]);

  const value = useMemo(() => ({
    sections,
    loaded,
    updatedAt,
    updatedBy,
    isSectionEnabled,
    updateConfig,
    applyServerConfig,
    SECTION_KEYS,
  }), [sections, loaded, updatedAt, updatedBy, isSectionEnabled, updateConfig, applyServerConfig]);

  return (
    <SiteConfigContext.Provider value={value}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error('useSiteConfig must be used within SiteConfigProvider');
  return ctx;
}
