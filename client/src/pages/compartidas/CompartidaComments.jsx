import { useEffect, useState } from "react";
import axios from "axios";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { API } from "../../api/endpoints";
import styles from "./CompartidaCard.module.css";

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

// Sección "Comentarios" de una compartida. Antes vivía DUPLICADA byte-por-byte
// en CompartidaCard.jsx (renders featured y normal, ~149 líneas idénticas
// cada uno) — un cambio en una sección requería replicarlo en la otra y
// era trivial olvidarse. Acá unifica:
//
// - State autocontenido: lista, input nuevo, inline edit, submitting.
// - Fetch lazy: corre al montar, así el padre puede controlar la visibilidad
//   con `{open && <CompartidaComments ... />}` y el child se ocupa del fetch.
// - `onCountChange` permite al padre mostrar el contador en el footer sin
//   tener que mantener un useState paralelo.
//
// `onRequireLogin` se llama si un anon intenta comentar.
export default function CompartidaComments({
  compartidaId,
  user,
  canDeleteOthers = false,
  onRequireLogin,
  onCountChange,
}) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCid, setEditingCid] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get(API.compartidas.COMMENTS(compartidaId))
      .then(({ data }) => {
        if (cancelled) return;
        setComments(data);
        onCountChange?.(data.length);
      })
      .catch(() => {
        /* silently — UI se mantiene utilizable */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [compartidaId, onCountChange]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await axios.post(
        API.compartidas.COMMENTS(compartidaId),
        { content: commentInput.trim() },
      );
      setComments((c) => {
        const next = [...c, data];
        onCountChange?.(next.length);
        return next;
      });
      setCommentInput("");
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos enviar el comentario"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (cid) => {
    if (!editContent.trim()) return;
    try {
      const { data } = await axios.put(
        API.compartidas.COMMENT_DETAIL(compartidaId, cid),
        { content: editContent.trim() },
      );
      setComments((cs) => cs.map((c) => (c._id === cid ? data : c)));
      setEditingCid(null);
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos editar el comentario"));
    }
  };

  const handleDelete = async (cid) => {
    try {
      await axios.delete(API.compartidas.COMMENT_DETAIL(compartidaId, cid));
      setComments((cs) => {
        const next = cs.filter((c) => c._id !== cid);
        onCountChange?.(next.length);
        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos eliminar el comentario"));
    }
  };

  return (
    <div className={styles.comments}>
      {loading ? (
        <div className={styles.commentsLoader}>
          <span className={styles.commentsLoaderDot} />
          <span className={styles.commentsLoaderDot} />
          <span className={styles.commentsLoaderDot} />
        </div>
      ) : comments.length === 0 ? (
        <p className={styles.noComments}>Sin comentarios aún. ¡Sé el primero!</p>
      ) : (
        <div className={styles.commentsHead}>
          ◆ Dejá tu comentario
          {comments.length > 1 ? ` (${comments.length})` : ""}
        </div>
      )}
      {error && <p className={styles.commentsError}>{error}</p>}
      {comments.map((c) => {
        const cAuthorInfo = getUserDisplay(c.author);
        const isOwn =
          user &&
          c.author &&
          (c.author._id || c.author).toString() === user._id.toString();
        const canDel = isOwn || canDeleteOthers;
        return (
          <div key={c._id} className={styles.comment}>
            <Avatar user={c.author} size="xs" />
            <div className={styles.commentBody}>
              <div className={styles.commentMeta}>
                <span className={styles.commentAuthor}>{cAuthorInfo.name}</span>
                <span className={styles.commentTime}>
                  {timeAgo(c.createdAt)}
                </span>
                {c.editedAt && (
                  <span className={styles.editedBadge}>editado</span>
                )}
              </div>
              {editingCid === c._id ? (
                <div className={styles.inlineEdit}>
                  <textarea
                    className={styles.inlineEditArea}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                    maxLength={500}
                  />
                  <div className={styles.inlineEditActions}>
                    <button
                      className={styles.btnSave}
                      onClick={() => handleEdit(c._id)}
                    >
                      Guardar
                    </button>
                    <button
                      className={styles.btnGhost}
                      onClick={() => setEditingCid(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className={styles.commentText}>{c.content}</p>
              )}
              {editingCid !== c._id && (
                <div className={styles.commentActions}>
                  {isOwn && (
                    <button
                      className={styles.commentActionBtn}
                      onClick={() => {
                        setEditingCid(c._id);
                        setEditContent(c.content);
                      }}
                    >
                      Editar
                    </button>
                  )}
                  {canDel && (
                    <button
                      className={`${styles.commentActionBtn} ${styles.commentActionDanger}`}
                      onClick={() => handleDelete(c._id)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {user ? (
        <form className={styles.commentForm} onSubmit={handleAdd}>
          <Avatar user={user} size="xs" />
          <input
            className={styles.commentInput}
            placeholder="Escribí un comentario…"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            maxLength={500}
            disabled={submitting}
          />
          <button
            type="submit"
            className={styles.commentSubmit}
            disabled={!commentInput.trim() || submitting}
            aria-label="Enviar comentario"
          >
            {submitting ? (
              "…"
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
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
      ) : (
        <button
          className={styles.guestCommentCta}
          onClick={() =>
            onRequireLogin?.("Iniciá sesión para comentar en esta compartida.")
          }
          type="button"
        >
          Iniciá sesión para comentar
        </button>
      )}
    </div>
  );
}
