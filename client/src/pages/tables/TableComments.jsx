import { useEffect, useState } from "react";
import axios from "axios";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay, DELETED_USER_LABEL } from "../../utils/userDisplay";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { API } from "../../api/endpoints";
import styles from "./TableDetail.module.css";

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Sección "Comentarios" del detalle de mesa. Estado autocontenido:
// la lista, el input nuevo, el inline edit y los flags de submitting/
// error son todos internos. Antes el padre tenía 6 useStates dedicados
// solo a esto + 3 handlers, y el fetch inicial estaba mezclado en un
// Promise.all con messages y ratings.
//
// Props:
//   - tableId, user, isHost: para los chequeos de ownership y delete.
//   - isAnon: si es true, el form se reemplaza por un CTA que abre el
//     LoginPromptModal (callback `onRequireLogin`).
//   - onCountChange(n): callback opcional que bubblea la cantidad de
//     comentarios al padre (TableDetail lo usa para pintar el contador
//     en el sectionHead).
//   - className: para la regla responsive (oculto en mobile salvo en
//     el tab activo).
export default function TableComments({
  tableId,
  user,
  isHost,
  isAnon,
  onRequireLogin,
  onCountChange,
  className = "",
}) {
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState("");

  // Bubble la cantidad al padre cuando cambia.
  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(API.tables.COMMENTS(tableId))
      .then(({ data }) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const content = commentInput.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await axios.post(API.tables.COMMENTS(tableId), {
        content,
      });
      setComments((prev) => [...prev, data]);
      setCommentInput("");
    } catch (err) {
      setError(getErrorMessage(err, "Error al comentar"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId) => {
    const content = editingContent.trim();
    if (!content) return;
    setError("");
    try {
      const { data } = await axios.put(
        API.tables.COMMENT_DETAIL(tableId, commentId),
        { content },
      );
      setComments((prev) => prev.map((c) => (c._id === commentId ? data : c)));
      setEditingId(null);
      setEditingContent("");
    } catch (err) {
      setError(getErrorMessage(err, "Error al editar"));
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("¿Eliminar este comentario?")) return;
    setError("");
    try {
      await axios.delete(API.tables.COMMENT_DETAIL(tableId, commentId));
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      setError(getErrorMessage(err, "Error al eliminar"));
    }
  };

  return (
    <div className={`${styles.card} ${className}`}>
      {error && <p className={styles.commentError}>{error}</p>}
      {comments.length === 0 ? (
        <p className={styles.commentsEmpty}>
          Nadie comentó todavía. ¡Sé el primero!
        </p>
      ) : (
        <div className={styles.commentsList}>
          {comments.map((comment) => {
            const authorInfo = getUserDisplay(comment.author);
            const isOwn =
              user &&
              comment.author &&
              (comment.author._id || comment.author).toString() ===
                user._id.toString();
            const canDelete = isOwn || isHost || user?.isAdmin;
            return (
              <div key={comment._id} className={styles.commentItem}>
                <Avatar user={comment.author} size="sm" />
                <div className={styles.commentBody}>
                  <div className={styles.commentMeta}>
                    <span className={styles.commentAuthor}>
                      {authorInfo.isDeleted
                        ? DELETED_USER_LABEL
                        : comment.author.username}
                    </span>
                    <span className={styles.commentTime}>
                      {formatDate(comment.createdAt)}
                    </span>
                    {comment.editedAt && (
                      <span className={styles.editedBadge}>editado</span>
                    )}
                  </div>
                  {editingId === comment._id ? (
                    <div className={styles.editForm}>
                      <textarea
                        className={styles.editTextarea}
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        maxLength={500}
                        rows={2}
                      />
                      <div className={styles.editActions}>
                        <button
                          className={styles.btnSaveEdit}
                          onClick={() => handleEdit(comment._id)}
                        >
                          Guardar
                        </button>
                        <button
                          className={styles.btnCancelEdit}
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.commentContent}>{comment.content}</p>
                  )}
                </div>
                {editingId !== comment._id && (
                  <div className={styles.commentActions}>
                    {isOwn && (
                      <button
                        className={styles.btnCommentEdit}
                        onClick={() => {
                          setEditingId(comment._id);
                          setEditingContent(comment.content);
                        }}
                      >
                        Editar
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className={styles.btnCommentDelete}
                        onClick={() => handleDelete(comment._id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isAnon ? (
        <button
          className={styles.btnComment}
          onClick={() =>
            onRequireLogin?.("Iniciá sesión para comentar en esta mesa.")
          }
          type="button"
        >
          Iniciá sesión para comentar
        </button>
      ) : (
        <form className={styles.addCommentForm} onSubmit={handleAdd}>
          <textarea
            className={styles.commentTextarea}
            placeholder="Escribí un comentario…"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            maxLength={500}
            rows={1}
            disabled={submitting}
          />
          <button
            className={styles.btnComment}
            type="submit"
            disabled={!commentInput.trim() || submitting}
          >
            {submitting ? "…" : "Comentar"}
          </button>
        </form>
      )}
    </div>
  );
}
