import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import styles from "./TableTutorials.module.css";

// "Andá preparado" — los primeros 3 tutoriales de YouTube para el board
// game de la mesa. Componente dumb: recibe `boardGame` y se renderiza
// solo si hay resultados. Fallos del server (key faltante, quota, network)
// devuelven items: [] → la sección no se muestra.
export default function TableTutorials({ boardGame }) {
  const [items, setItems] = useState(null); // null = loading, [] = vacío/error, [...] = ok
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!boardGame || !boardGame.trim()) {
      setItems([]);
      return undefined;
    }
    const controller = new AbortController();
    setItems(null);
    setErrored(false);
    axios
      .get(API.youtube.COMO_SE_JUEGA, {
        params: { juego: boardGame },
        signal: controller.signal,
      })
      .then((res) => setItems(res.data?.items || []))
      .catch((err) => {
        if (axios.isCancel(err) || err.name === "CanceledError") return;
        setErrored(true);
        setItems([]);
      });
    return () => controller.abort();
  }, [boardGame]);

  if (!boardGame || !boardGame.trim()) return null;
  if (errored) return null;
  if (items && items.length === 0) return null;

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionLabel}>◆ Andá preparado</span>
        <span className={styles.sectionRule} />
      </header>
      <p className={styles.tagline}>
        Aprendé cómo se juega <strong>{boardGame}</strong> antes de la mesa.
      </p>
      <div className={styles.grid}>
        {items === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`skel-${i}`}
                className={styles.cardSkeleton}
                aria-hidden="true"
              />
            ))
          : items.map((v) => (
              <a
                key={v.videoId}
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`}
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
                  <h3 className={styles.title}>{v.title}</h3>
                  <span className={styles.channel}>{v.channel}</span>
                </div>
              </a>
            ))}
      </div>
    </section>
  );
}
