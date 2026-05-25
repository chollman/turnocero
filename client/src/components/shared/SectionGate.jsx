import { Navigate } from "react-router-dom";
import { useSiteConfig } from "../../context/SiteConfigContext";

export default function SectionGate({ section, children, redirectTo = "/" }) {
  const { loaded, isSectionEnabled } = useSiteConfig();
  if (!loaded) return null;
  if (!isSectionEnabled(section)) return <Navigate to={redirectTo} replace />;
  return children;
}
