import { Navigate } from "react-router-dom";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useCommunity } from "../../context/CommunityContext";
import { useSectionEnabled } from "../../hooks/useSectionEnabled";

export default function SectionGate({ section, children, redirectTo = "/" }) {
  const { loaded: configLoaded } = useSiteConfig();
  const { loaded: communityLoaded } = useCommunity();
  const sectionEnabled = useSectionEnabled();
  // Esperar a AMBOS contextos: el gating combina global (SiteConfig) + el
  // override de la comunidad-skin (CommunityContext).
  if (!configLoaded || !communityLoaded) return null;
  if (!sectionEnabled(section)) return <Navigate to={redirectTo} replace />;
  return children;
}
