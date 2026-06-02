import { Helmet } from "react-helmet-async";
import Meeple from "../../components/shared/Meeple";
import styles from "./Legal.module.css";

/**
 * Layout compartido para los documentos legales (Términos, Privacidad).
 * Recibe el eyebrow, título, fecha de actualización y el cuerpo del documento.
 */
export default function LegalPage({
  eyebrow,
  title,
  updated,
  docTitle,
  children,
}) {
  return (
    <div className={styles.page}>
      <Helmet>
        <title>{docTitle} · TurnoCero</title>
      </Helmet>

      <header className={styles.hero}>
        <p className={styles.eyebrow}>
          <Meeple />
          {eyebrow}
        </p>
        <h1 className={styles.title}>{title}</h1>
        {updated && (
          <p className={styles.updated}>Última actualización: {updated}</p>
        )}
      </header>

      <div className={styles.body}>{children}</div>
    </div>
  );
}
