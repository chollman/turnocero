import { useNavigate } from "react-router-dom";
import { useSiteConfig } from "../../context/SiteConfigContext";
import ErrorScreen from "./ErrorScreen";

// Quick links candidatos. Se muestran sólo los de secciones habilitadas en
// SiteConfig, así no mandamos al usuario a una sección apagada.
const CANDIDATE_LINKS = [
  { to: "/mesas", label: "Mesas", icon: "dice", section: "mesas" },
  { to: "/eventos", label: "Eventos", icon: "calendar", section: "eventos" },
  { to: "/compartidas", label: "Compartidas", icon: "heart", section: "compartidas" },
  { to: "/colabora", label: "Colaborá", icon: "mail", section: "colabora" },
];

export default function NotFound() {
  const navigate = useNavigate();
  const { isSectionEnabled } = useSiteConfig();

  const links = CANDIDATE_LINKS.filter(
    (l) => !l.section || isSectionEnabled(l.section),
  );

  const goBack = () => {
    // history.state.idx > 0 ⇒ hay navegación previa in-app; si entraron
    // directo al 404, caemos al inicio.
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/");
  };

  return (
    <ErrorScreen
      variant="404"
      links={links}
      onPrimary={() => navigate("/")}
      onSecondary={goBack}
    />
  );
}
