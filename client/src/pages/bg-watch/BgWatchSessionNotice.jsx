import { Link } from "react-router-dom";
import styles from "./BgWatchSessionNotice.module.css";

const WarnIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/**
 * Aviso solo para el dueño, en su propio BG Watch, cuando su sesión de BGG
 * caducó (`bggInvalid`) — típicamente porque cambió su contraseña en BGG.com.
 * El password sigue guardado pero dejó de servir, así que el botón de cargar
 * partidas desaparece; este banner explica por qué y lo guía a /perfil a
 * reconectar (ahí está el form que vuelve a poner `invalid = false`).
 */
export default function BgWatchSessionNotice() {
  return (
    <div className={styles.notice} role="alert">
      <span className={styles.icon} aria-hidden="true">
        <WarnIcon />
      </span>
      <div className={styles.copy}>
        <p className={styles.title}>Tu sesión con BoardGameGeek caducó</p>
        <p className={styles.body}>
          Seguramente cambiaste tu contraseña en BoardGameGeek. Reingresá tu
          password para volver a cargar y editar partidas.
        </p>
      </div>
      <Link to="/perfil" className={styles.cta}>
        Reconectar
        <ArrowIcon />
      </Link>
    </div>
  );
}
