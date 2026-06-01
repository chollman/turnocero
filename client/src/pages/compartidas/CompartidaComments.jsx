import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { API } from "../../api/endpoints";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import styles from "./CompartidaCard.module.css";

const PAGE_SIZE = 10;

// Comentarios muestran fecha+hora absoluta en formato dd/MM/aa HH:mm
// (ej. "05/01/26 14:30"). Lo armamos a mano para fijar el separador exacto
// (espacio) que toLocaleString variaría a coma según la locale.
function formatDateTime(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const MM = pad(d.getMonth() + 1);
  const aa = pad(d.getFullYear() % 100);
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${dd}/${MM}/${aa} ${HH}:${mm}`;
}

// Sección "Comentarios" de una compartida. Carga incremental (lazy) por
// comentarios de NIVEL SUPERIOR; cada uno trae sus respuestas anidadas
// (1 nivel, estilo Facebook). El form de comentar va arriba y los comentarios
// nuevos se prependean. `onCountChange` reporta el TOTAL real (top-level +
// respuestas). `onRequireLogin` se llama si un anon intenta comentar.
export default function CompartidaComments({
  compartidaId,
  user,
  canDeleteOthers = false,
  onRequireLogin,
  onCountChange,
}) {
  const [comments, setComments] = useState([]); // top-level, cada uno con .replies
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCid, setEditingCid] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // id del comentario al que se responde
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const loadComments = useCallback(
    async (pageNum, replace, signal) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const { data } = await axios.get(
          API.compartidas.COMMENTS(compartidaId),
          { params: { page: pageNum, limit: PAGE_SIZE }, signal },
        );
        setComments((prev) =>
          replace ? data.comments : [...prev, ...data.comments],
        );
        setTotal(data.total);
        setPages(data.pages);
        setPage(pageNum);
        onCountChange?.(data.total);
      } catch (err) {
        if (axios.isCancel(err)) return;
        /* silently — la UI se mantiene utilizable */
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [compartidaId, onCountChange],
  );

  useEffect(() => {
    const ac = new AbortController();
    setComments([]);
    setPage(1);
    setPages(1);
    loadComments(1, true, ac.signal);
    return () => ac.abort();
  }, [compartidaId, loadComments]);

  const hasMore = page < pages;

  const onLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) loadComments(page + 1, false);
  }, [loadingMore, hasMore, page, loadComments]);

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    enabled: hasMore,
    root: scrollRef,
    rootMargin: "80px",
  });

  const bumpTotal = (delta) => {
    const next = Math.max(0, total + delta);
    setTotal(next);
    onCountChange?.(next);
  };

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
      setComments((c) => [{ ...data, replies: [] }, ...c]); // más nuevo arriba
      bumpTotal(1);
      setCommentInput("");
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos enviar el comentario"));
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
    if (!replyText.trim() || replySubmitting) return;
    setReplySubmitting(true);
    setError("");
    try {
      const { data } = await axios.post(
        API.compartidas.COMMENTS(compartidaId),
        { content: replyText.trim(), parent: parentClickedId },
      );
      // El server aplana al raíz → data.parent es el comentario de nivel superior.
      setComments((cs) =>
        cs.map((c) =>
          c._id === data.parent
            ? { ...c, replies: [...(c.replies || []), data] }
            : c,
        ),
      );
      bumpTotal(1);
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos enviar la respuesta"));
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleEdit = async (cid) => {
    if (!editContent.trim()) return;
    try {
      const { data } = await axios.put(
        API.compartidas.COMMENT_DETAIL(compartidaId, cid),
        { content: editContent.trim() },
      );
      setComments((cs) =>
        cs.map((c) => {
          if (c._id === cid) return { ...data, replies: c.replies || [] };
          if (c.replies?.some((r) => r._id === cid)) {
            return {
              ...c,
              replies: c.replies.map((r) => (r._id === cid ? data : r)),
            };
          }
          return c;
        }),
      );
      setEditingCid(null);
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos editar el comentario"));
    }
  };

  const handleDelete = async (cid) => {
    try {
      await axios.delete(API.compartidas.COMMENT_DETAIL(compartidaId, cid));
      const top = comments.find((c) => c._id === cid);
      if (top) {
        // Comentario raíz → se borra con sus respuestas (cascada en el server).
        bumpTotal(-(1 + (top.replies?.length || 0)));
        setComments((cs) => cs.filter((c) => c._id !== cid));
      } else {
        bumpTotal(-1);
        setComments((cs) =>
          cs.map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r._id !== cid),
          })),
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos eliminar el comentario"));
    }
  };

  // Render de un comentario individual (sirve para top-level y respuestas).
  const renderComment = (c, { isReply = false } = {}) => {
    const info = getUserDisplay(c.author);
    const profilePath =
      !info.isDeleted && info._id ? `/usuarios/${info._id}` : null;
    const isOwn =
      user &&
      c.author &&
      (c.author._id || c.author).toString() === user._id.toString();
    const canDel = isOwn || canDeleteOthers;
    return (
      <div
        key={c._id}
        className={`${styles.comment} ${isReply ? styles.commentReply : ""}`}
      >
        {profilePath ? (
          <Link
            to={profilePath}
            className={styles.avatarLink}
            aria-label={`Ver perfil de ${info.name}`}
          >
            <Avatar user={c.author} size="xs" />
          </Link>
        ) : (
          <Avatar user={c.author} size="xs" />
        )}
        <div className={styles.commentBody}>
          <div className={styles.commentMeta}>
            {profilePath ? (
              <Link
                to={profilePath}
                className={`${styles.commentAuthor} ${styles.authorNameLink}`}
              >
                {info.name}
              </Link>
            ) : (
              <span className={styles.commentAuthor}>{info.name}</span>
            )}
            <span className={styles.commentTime}>
              {formatDateTime(c.createdAt)}
            </span>
            {c.editedAt && <span className={styles.editedBadge}>editado</span>}
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
              {user && (
                <button
                  className={styles.commentActionBtn}
                  onClick={() => openReply(c._id, isReply ? info.name : null)}
                >
                  Responder
                </button>
              )}
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
                  onClick={() => {
                    // Confirmación antes de borrar — propio o, para autor/admin,
                    // el comentario de otro usuario.
                    const msg = isOwn
                      ? "¿Eliminar tu comentario?"
                      : `¿Eliminar el comentario de ${info.name}?`;
                    if (window.confirm(msg)) handleDelete(c._id);
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          )}

          {/* Form de respuesta inline */}
          {replyingTo === c._id && (
            <form
              className={styles.replyForm}
              onSubmit={(e) => {
                e.preventDefault();
                handleAddReply(c._id);
              }}
            >
              <input
                className={styles.commentInput}
                placeholder="Escribí una respuesta…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={500}
                disabled={replySubmitting}
                autoFocus
              />
              <button
                type="submit"
                className={styles.commentSubmit}
                disabled={!replyText.trim() || replySubmitting}
                aria-label="Enviar respuesta"
              >
                {replySubmitting ? "…" : "➤"}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
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
    <div className={styles.comments}>
      <div className={styles.commentsHead}>
        ◆ Dejá tu comentario{total > 1 ? ` (${total})` : ""}
      </div>

      {/* Form arriba — los comentarios nuevos aparecen al instante en el tope. */}
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

      {error && <p className={styles.commentsError}>{error}</p>}

      {loading ? (
        <div className={styles.commentsLoader}>
          <span className={styles.commentsLoaderDot} />
          <span className={styles.commentsLoaderDot} />
          <span className={styles.commentsLoaderDot} />
        </div>
      ) : total === 0 ? (
        <p className={styles.noComments}>
          Sin comentarios aún. ¡Sé el primero!
        </p>
      ) : (
        <div className={styles.commentsScroll} ref={scrollRef}>
          {comments.map((c) => (
            <div key={c._id} className={styles.commentThread}>
              {renderComment(c)}
              {c.replies?.length > 0 && (
                <div className={styles.replies}>
                  {c.replies.map((r) => renderComment(r, { isReply: true }))}
                </div>
              )}
            </div>
          ))}

          {hasMore && (
            <button
              type="button"
              className={styles.commentsMoreBtn}
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Cargando…" : "Ver comentarios anteriores"}
            </button>
          )}
          {hasMore && <div ref={sentinelRef} aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
