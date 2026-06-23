import Meeple from "../../components/shared/Meeple";
import { useTranslation, Trans } from "react-i18next";
import styles from "./TableBga.module.css";

// "Probá el juego online" — render condicional al lado de TableTutorials.
// Si el host configuró un URL de Board Game Arena en el Paso 5 "Extras",
// renderizamos una card CTA grande que abre el link en pestaña nueva.
//
// Sin estado, sin fetches — la URL ya viene validada del server (que
// la rechaza si no es boardgamearena.com). Si `bgaUrl` es null/empty,
// el componente se auto-oculta.
export default function TableBga({ boardGame, bgaUrl }) {
  const { t } = useTranslation("tables");
  if (!bgaUrl || typeof bgaUrl !== "string" || !bgaUrl.trim()) return null;

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionLabel}><Meeple />{t("bga.sectionLabel")}</span>
        <span className={styles.sectionRule} />
      </header>
      <a
        href={bgaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.card}
      >
        <img
          src="/bga-logo.png"
          alt={t("bga.logoAlt")}
          className={styles.logo}
          loading="lazy"
        />
        <div className={styles.body}>
          <h3 className={styles.title}>
            <Trans
              i18nKey="bga.title"
              t={t}
              values={{ game: boardGame || t("bga.gameFallback") }}
              components={{ 1: <strong /> }}
            />
          </h3>
          <p className={styles.sub}>{t("bga.sub")}</p>
        </div>
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </a>
    </section>
  );
}
