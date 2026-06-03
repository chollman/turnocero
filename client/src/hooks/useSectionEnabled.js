import { useCallback } from "react";
import { useSiteConfig } from "../context/SiteConfigContext";
import { useCommunity } from "../context/CommunityContext";
import { useAuth } from "../context/AuthContext";

// Gating combinado de secciones: una sección se muestra si está habilitada
// GLOBALMENTE (SiteConfig) Y en la comunidad-skin activa (override por
// comunidad). El admin efectivo (respeta view-as-user) bypassea siempre.
//
// La comunidad-skin (no el set `viewing`) decide el shell, manteniendo un único
// "lente" coherente. Un toggle de comunidad solo puede restringir sobre el
// global, nunca habilitar algo globalmente apagado.
export function useSectionEnabled() {
  const { isSectionEnabled } = useSiteConfig();
  const { isSectionEnabledInSkin } = useCommunity();
  const { user } = useAuth();

  return useCallback(
    (key) => {
      if (user?.isAdmin) return true;
      return isSectionEnabled(key) && isSectionEnabledInSkin(key);
    },
    [isSectionEnabled, isSectionEnabledInSkin, user],
  );
}
