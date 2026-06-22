import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
import styles from "./GuestJoinBanner.module.css";

// Banda de adquisición para visitantes anónimos. Cobra el tráfico viral: los
// links de compartidas que llegan por WhatsApp/Telegram aterrizan en
// /compartidas/:id sin contexto ni propuesta de valor. Esta banda le contesta
// al visitante frío "qué es esto y por qué registrarme" en el momento de mayor
// interés (justo después de ver el contenido que le mandó un amigo) con un CTA
// de registro conectado al contenido. Se auto-oculta para usuarios logueados.
//
// `variant`:
//   - "banner" (default): banda horizontal full-width (feed + página de post).
//   - "card": tarjeta vertical para columnas angostas (sidebar).
export default function GuestJoinBanner({ variant = "banner" }) {
  const { user, loading } = useAuth();
  const brandName = useBrandName();
  const { t } = useTranslation();

  // Mientras resolvemos la sesión no mostramos nada (evita un flash de la banda
  // a usuarios que sí están logueados).
  if (loading || user) return null;

  const isCard = variant === "card";

  return (
    <aside
      className={`${styles.banner} ${isCard ? styles.card : ""}`}
      aria-label={t("shared:guestJoin.aria", { brand: brandName })}
    >
      <div className={styles.text}>
        <p className={styles.title}>
          <Trans
            i18nKey="shared:guestJoin.title"
            values={{ brand: brandName }}
            components={[<span key="0" />, <strong key="1" />]}
          />
        </p>
        <p className={styles.sub}>{t("shared:guestJoin.sub")}</p>
      </div>
      <div className={styles.actions}>
        <Link to="/register" className={styles.primary}>
          {t("shared:guestJoin.register")}
        </Link>
        <Link to="/login" className={styles.secondary}>
          {t("shared:guestJoin.haveAccount")}
        </Link>
      </div>
    </aside>
  );
}
