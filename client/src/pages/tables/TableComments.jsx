import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay, DELETED_USER_LABEL } from "../../utils/userDisplay";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { API } from "../../api/endpoints";
import styles from "./TableDetail.module.css";

// Mobile breakpoint para el placeholder del textarea — el sectionHead
// "Comentarios" se oculta en mobile (tab bar identifica la sección)
// y por eso el placeholder largo "Escribí un comentario…" queda redundante.
const MOBILE_BREAKPOINT = 980;

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Cuenta el total real de comentarios (top-level + respuestas anidadas).
const countAll = (list) =>
  list.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

// Sección "Comentarios" del detalle de mesa. Estado autocontenido:
// la lista, el input nuevo, el inline edit, las respuestas y los flags de
// submitting/error son todos internos. Los comentarios soportan respuestas
// de 1 nivel (estilo Facebook): cada top-level trae sus `replies` anidadas.
//
// Props:
//   - tableId, user, isHost: para los chequeos de ownership y delete.
//   - isAnon: si es true, el form se reemplaza por un CTA que abre el
//     LoginPromptModal (callback `onRequireLogin`).
//   - onCountChange(n): callback opcional que bubblea la cantidad total de
//     comentarios al padre (TableDetail lo usa para pintar el contador
//     en el sectionHead).
//   - className: para la regla responsive (oculto en mobile salvo en
//     el tab activo).
export default function TableComments({
  tableId,
  user,
  isHost,
  isAnon,
  canPost = true,
  onRequireLogin,
  onCountChange,
  className = "",
}) {
  const [comments, setComments] = useState([]); // top-level, cada uno con .replies
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // id del comentario al que se responde
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Bubble el total (top-level + respuestas) al padre cuando cambia.
  useEffect(() => {
    onCountChange?.(countAll(comments));
  }, [comments, onCountChange]);

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
      setComments((prev) => [...prev, { ...data, replies: [] }]);
      setCommentInput("");
    } catch (err) {
      setError(getErrorMessage(err, "Error al comentar"));
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir el form de respuesta. `toName` precarga "@usuario " cuando se
  // responde a una respuesta (para dejar claro a quién se le contesta).
  const openReply = (commentId, toName) => {
    setReplyingTo(commentId);
    setReplyText(toName ? `@${toName} ` : "");
  };

  const handleAddReply = async (parentClickedId) => {
    const content = replyText.trim();
    if (!content || replySubmitting) return;
    setReplySubmitting(true);
    setError("");
    try {
      const { data } = await axios.post(API.tables.COMMENTS(tableId), {
        content,
        parent: parentClickedId,
      });
      // El server aplana al raíz → data.parent es el comentario de nivel superior.
      setComments((cs) =>
        cs.map((c) =>
          c._id === data.parent
            ? { ...c, replies: [...(c.replies || []), data] }
            : c,
        ),
      );
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      setError(getErrorMessage(err, "Error al responder"));
    } finally {
      setReplySubmitting(false);
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
      setComments((prev) =>
        prev.map((c) => {
          if (c._id === commentId) return { ...data, replies: c.replies || [] };
          if (c.replies?.some((r) => r._id === commentId)) {
            return {
              ...c,
              replies: c.replies.map((r) => (r._id === commentId ? data : r)),
            };
          }
          return c;
        }),
      );
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
      const isTop = comments.some((c) => c._id === commentId);
      if (isTop) {
        // Comentario raíz → se borra con sus respuestas (cascada en el server).
        setComments((prev) => prev.filter((c) => c._id !== commentId));
      } else {
        setComments((prev) =>
          prev.map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r._id !== commentId),
          })),
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, "Error al eliminar"));
    }
  };

  // Render de un comentario individual (sirve para top-level y respuestas).
  const renderComment = (comment, { isReply = false } = {}) => {
    const authorInfo = getUserDisplay(comment.author);
    const isOwn =
      user &&
      comment.author &&
      (comment.author._id || comment.author).toString() === user._id.toString();
    const canDelete = isOwn || isHost || user?.isAdmin;
    return (
      <div key={comment._id} className={styles.commentItem}>
        <Avatar user={comment.author} size="sm" />
        <div className={styles.commentBody}>
          <div className={styles.commentMeta}>
            <span className={styles.commentAuthor}>
              {authorInfo.isDeleted ? (
                DELETED_USER_LABEL
              ) : (
                <Link
                  to={`/usuarios/${comment.author._id}`}
                  className={styles.userLink}
                >
                  {comment.author.username}
                </Link>
              )}
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
          {editingId !== comment._id && (
            <div className={styles.commentActions}>
              {user && canPost && (
                <button
                  className={styles.btnCommentReply}
                  onClick={() =>
                    openReply(comment._id, isReply ? authorInfo.name : null)
                  }
                >
                  Responder
                </button>
              )}
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
          {replyingTo === comment._id && (
            <form
              className={styles.replyForm}
              onSubmit={(e) => {
                e.preventDefault();
                handleAddReply(comment._id);
              }}
            >
              <input
                className={styles.replyInput}
                placeholder="Escribí una respuesta…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={500}
                disabled={replySubmitting}
                autoFocus
              />
              <button
                type="submit"
                className={styles.btnReplySend}
                disabled={!replyText.trim() || replySubmitting}
              >
                {replySubmitting ? "…" : "Responder"}
              </button>
              <button
                type="button"
                className={styles.btnCancelEdit}
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText("");
                }}
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      </div>
    );
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
          {comments.map((comment) => (
            <div key={comment._id} className={styles.commentThread}>
              {renderComment(comment)}
              {comment.replies?.length > 0 && (
                <div className={styles.replies}>
                  {comment.replies.map((r) =>
                    renderComment(r, { isReply: true }),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!canPost ? (
        <p className={styles.commentsLocked}>
          Los comentarios solo se pueden agregar en mesas públicas.
        </p>
      ) : isAnon ? (
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
            placeholder={isMobile ? "Escribí uno..." : "Escribí un comentario…"}
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
