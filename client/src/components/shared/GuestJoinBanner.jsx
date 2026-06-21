import { Link } from "react-router-dom";
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

  // Mientras resolvemos la sesión no mostramos nada (evita un flash de la banda
  // a usuarios que sí están logueados).
  if (loading || user) return null;

  const isCard = variant === "card";

  return (
    <aside
      className={`${styles.banner} ${isCard ? styles.card : ""}`}
      aria-label={`Sumate a ${brandName}`}
    >
      <div className={styles.text}>
        <p className={styles.title}>
          Sumate a <strong>{brandName}</strong>
        </p>
        <p className={styles.sub}>
          Encontrá gente para jugar cerca tuyo y compartí tus partidas. Es
          gratis.
        </p>
      </div>
      <div className={styles.actions}>
        <Link to="/register" className={styles.primary}>
          Registrate gratis
        </Link>
        <Link to="/login" className={styles.secondary}>
          Ya tengo cuenta
        </Link>
      </div>
    </aside>
  );
}
