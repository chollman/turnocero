import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./CommentLikeButton.module.css";

// Botón de "me gusta" para un comentario o respuesta. El corazón togglea el
// like (optimistic, manejado por el caller via `onToggle`); el número, cuando
// hay al menos un like, es clickeable y dispara `onShowLikers` (abre el modal
// "¿a quién le gustó?"). Reutilizable en Compartidas y Mesas.
//
// Props:
//  - liked:        boolean — si el usuario actual likeó
//  - count:        number  — cantidad de likes
//  - onToggle:     fn      — al clickear el corazón
//  - onShowLikers: fn      — al clickear el número (solo si count > 0)
//  - disabled:     boolean — deshabilita el toggle (ej. en mesa no pública)
export default function CommentLikeButton({
  liked,
  count = 0,
  onToggle,
  onShowLikers,
  disabled = false,
}) {
  const { t } = useTranslation();
  // Animación "pop" al pasar de no-liked a liked (350ms), igual que el like
  // del post.
  const [popping, setPopping] = useState(false);
  const prevLiked = useRef(liked);
  const popTimer = useRef(null);

  useEffect(() => {
    if (liked && !prevLiked.current) {
      setPopping(true);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopping(false), 350);
    }
    prevLiked.current = liked;
  }, [liked]);

  useEffect(
    () => () => {
      if (popTimer.current) clearTimeout(popTimer.current);
    },
    [],
  );

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={`${styles.heartBtn} ${liked ? styles.liked : ""}`}
        onClick={onToggle}
        disabled={disabled}
        aria-label={
          liked ? t("shared:commentLike.remove") : t("shared:commentLike.like")
        }
        aria-pressed={liked}
      >
        <span className={`${styles.heart} ${popping ? styles.pop : ""}`}>
          {liked ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          )}
        </span>
        <span className={styles.label}>{t("shared:commentLike.like")}</span>
      </button>
      {count > 0 &&
        (onShowLikers ? (
          <button
            type="button"
            className={styles.countBtn}
            onClick={onShowLikers}
            aria-label={t("shared:commentLike.showLikers", { count })}
          >
            {count}
          </button>
        ) : (
          <span className={styles.count}>{count}</span>
        ))}
    </span>
  );
}
