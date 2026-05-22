import { useEffect, useState } from "react";
import axios from "axios";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay, DELETED_USER_LABEL } from "../../utils/userDisplay";
import { getErrorMessage } from "../../utils/getErrorMessage";
import styles from "./TableDetail.module.css";

// Sección "¿Cómo estuvo la sesión?" — listado de ratings + form para
// que un participante deje su valoración (1-5 estrellas + comentario
// opcional). Solo se puede valorar después de la fecha de la mesa.
//
// State autocontenido: lista, avg/count, mi rating en edición, hover
// para el preview de estrellas, submitting/error. El fetch inicial
// también vive acá (antes estaba mezclado en un Promise.all del padre).
export default function TableRatings({
  tableId,
  user,
  canRate,
  className = "",
}) {
  const [ratings, setRatings] = useState([]);
  const [avg, setAvg] = useState(null);
  const [count, setCount] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [hoverScore, setHoverScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`/api/tables/${tableId}/ratings`)
      .then(({ data }) => {
        if (cancelled) return;
        setRatings(data.ratings);
        setAvg(data.avg);
        setCount(data.count);
        const mine =
          user &&
          data.ratings.find(
            (r) =>
              (r.rater?._id || r.rater)?.toString() === user._id.toString(),
          );
        if (mine) {
          setMyScore(mine.score);
          setMyComment(mine.comment || "");
        }
      })
      .catch(() => {
        /* ratings opcional — la sección sigue siendo usable vacía */
      });
    return () => {
      cancelled = true;
    };
  }, [tableId, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!myScore || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await axios.post(`/api/tables/${tableId}/ratings`, {
        score: myScore,
        comment: myComment,
      });
      setRatings((prev) => {
        const withoutMine = prev.filter(
          (r) =>
            (r.rater?._id || r.rater)?.toString() !== user._id.toString(),
        );
        return [data.rating, ...withoutMine];
      });
      setAvg(data.avg);
      setCount(data.count);
    } catch (err) {
      setError(getErrorMessage(err, "Error al enviar la valoración"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles.ratingsCard} ${className}`}>
      <div className={styles.sectionRow}>
        <span className={styles.eyebrow}>¿CÓMO ESTUVO LA SESIÓN?</span>
        {count > 0 && avg !== null && (
          <span className={styles.ratingsAvgBadge}>
            {"★".repeat(Math.round(avg))}
            {"☆".repeat(5 - Math.round(avg))} {avg.toFixed(1)} ({count})
          </span>
        )}
      </div>
      {canRate && (
        <form className={styles.ratingForm} onSubmit={handleSubmit}>
          <span className={styles.ratingLabel}>Tu puntuación</span>
          <div className={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`${styles.starBtn} ${star <= (hoverScore || myScore) ? styles.starActive : ""}`}
                onMouseEnter={() => setHoverScore(star)}
                onMouseLeave={() => setHoverScore(0)}
                onClick={() => setMyScore(star)}
                aria-label={`${star} estrellas`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className={styles.ratingTextarea}
            placeholder="Comentario opcional (máx. 300 caracteres)…"
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            maxLength={300}
            rows={2}
            disabled={submitting}
          />
          {error && <p className={styles.ratingError}>{error}</p>}
          <button
            className={styles.btnSubmitRating}
            type="submit"
            disabled={!myScore || submitting}
          >
            {submitting
              ? "…"
              : myScore
                ? "Enviar valoración"
                : "Seleccioná una puntuación"}
          </button>
        </form>
      )}
      {ratings.length === 0 ? (
        <p className={styles.ratingsEmpty}>Todavía no hay valoraciones.</p>
      ) : (
        <div className={styles.ratingsList}>
          {ratings.map((r) => {
            const raterInfo = getUserDisplay(r.rater);
            return (
              <div key={r._id} className={styles.ratingItem}>
                <Avatar user={r.rater} size="sm" />
                <div className={styles.ratingBody}>
                  <div className={styles.ratingMeta}>
                    <span className={styles.ratingUsername}>
                      {raterInfo.isDeleted
                        ? DELETED_USER_LABEL
                        : r.rater.username}
                    </span>
                    <span className={styles.ratingStars}>
                      {"★".repeat(r.score)}
                      {"☆".repeat(5 - r.score)}
                    </span>
                  </div>
                  {r.comment && (
                    <p className={styles.ratingComment}>{r.comment}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
