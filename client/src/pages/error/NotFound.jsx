import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSiteConfig } from "../../context/SiteConfigContext";
import ErrorScreen from "./ErrorScreen";

// Quick links candidatos. Se muestran sólo los de secciones habilitadas en
// SiteConfig, así no mandamos al usuario a una sección apagada. El label sale
// de i18n (key `error:links.*`).
const CANDIDATE_LINKS = [
  { to: "/mesas", labelKey: "mesas", icon: "dice", section: "mesas" },
  { to: "/eventos", labelKey: "eventos", icon: "calendar", section: "eventos" },
  { to: "/compartidas", labelKey: "compartidas", icon: "heart", section: "compartidas" },
  { to: "/colabora", labelKey: "colabora", icon: "mail", section: "colabora" },
];

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isSectionEnabled } = useSiteConfig();

  const links = CANDIDATE_LINKS.filter(
    (l) => !l.section || isSectionEnabled(l.section),
  ).map((l) => ({ ...l, label: t(`error:links.${l.labelKey}`) }));

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
