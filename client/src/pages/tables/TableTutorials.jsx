import Meeple from "../../components/shared/Meeple";
import { useTranslation, Trans } from "react-i18next";
import { useTableTutorialsQuery } from "../../queries/youtube";
import { youtubeWatchUrl } from "../../utils/youtube";
import styles from "./TableTutorials.module.css";

// "Andá preparado" — sección de tutoriales de YouTube en TableDetail.
// El host elige el modo en MesaForm Paso 5:
//   - "none":   no se muestra nada.
//   - "auto":   3 primeros resultados de "Como se juega <boardGame>".
//               (Default para mesas creadas antes de la feature.)
//   - "manual": 1 video específico recomendado por el host (tutorialVideoId).
//
// Fallback degradado: si el server devuelve items vacíos / falla, la
// sección no renderiza — sin toasts ni mensajes (es nice-to-have).
export default function TableTutorials({
  boardGame,
  tutorialMode,
  tutorialVideoId,
}) {
  const { t } = useTranslation("tables");
  // Mesas viejas (sin campo en el doc) → tratamos como auto para
  // preservar el comportamiento original.
  const mode = tutorialMode || "auto";

  // items === undefined mientras carga; [] = vacío/error; [...] = ok.
  const { data: items, isError: errored } = useTableTutorialsQuery(
    mode,
    boardGame,
    tutorialVideoId,
  );

  if (mode === "none") return null;
  if (mode === "manual" && !tutorialVideoId) return null;
  if (mode === "auto" && (!boardGame || !boardGame.trim())) return null;
  if (errored) return null;
  if (items && items.length === 0) return null;

  const skeletonCount = mode === "manual" ? 1 : 3;
  const isSingle = mode === "manual";
  const tagline =
    mode === "manual" ? (
      t("tutorials.taglineManual")
    ) : (
      <Trans
        i18nKey="tutorials.taglineAuto"
        t={t}
        values={{ game: boardGame }}
        components={{ 1: <strong /> }}
      />
    );

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionLabel}><Meeple />{t("tutorials.sectionLabel")}</span>
        <span className={styles.sectionRule} />
      </header>
      <p className={styles.tagline}>{tagline}</p>
      <div
        className={`${styles.grid} ${isSingle ? styles.gridSingle : ""}`.trim()}
      >
        {items === undefined
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div
                key={`skel-${i}`}
                className={styles.cardSkeleton}
                aria-hidden="true"
              />
            ))
          : items.map((v) => (
              <a
                key={v.videoId}
                href={youtubeWatchUrl(v.videoId)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.card}
              >
                <div className={styles.thumbWrap}>
                  {v.thumbnail && (
                    <img
                      src={v.thumbnail}
                      alt=""
                      loading="lazy"
                      className={styles.thumb}
                    />
                  )}
                  <span className={styles.playOverlay} aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.7)" />
                      <path d="M19 16 L33 24 L19 32 Z" fill="#fff" />
                    </svg>
                  </span>
                  {v.duration && (
                    <span className={styles.duration}>{v.duration}</span>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.title}>
                    {v.title || t("tutorials.titleFallback")}
                  </h3>
                  {v.channel && (
                    <span className={styles.channel}>{v.channel}</span>
                  )}
                </div>
              </a>
            ))}
      </div>
    </section>
  );
}
