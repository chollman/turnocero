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

// Sección "Comentarios" de una compartida. Carga incremental (lazy): trae de a
// PAGE_SIZE empezando por los MÁS NUEVOS y carga los anteriores a medida que se
// scrollea (IntersectionObserver) o con el botón "Ver comentarios anteriores".
//
// - Más nuevos arriba: el form de comentar va arriba y los comentarios nuevos
//   se *prependean* en el tope — así la inserción en vivo nunca desordena la
//   lista respecto de páginas viejas todavía no cargadas.
// - `onCountChange` reporta el TOTAL real del server (no la cantidad cargada),
//   para que el contador del footer sea exacto sin traer la lista entera.
// - `onRequireLogin` se llama si un anon intenta comentar.
export default function CompartidaComments({
  compartidaId,
  user,
  canDeleteOthers = false,
  onRequireLogin,
  onCountChange,
}) {
  const [comments, setComments] = useState([]); // orden desc (idx 0 = más nuevo)
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCid, setEditingCid] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef(null); // caja scrolleable que contiene la lista

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
    root: scrollRef, // observar contra la caja scrolleable, no el viewport
    rootMargin: "80px",
  });

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
      setComments((c) => [data, ...c]); // más nuevo arriba
      setTotal((t) => t + 1);
      onCountChange?.(total + 1);
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
      setComments((cs) => cs.filter((c) => c._id !== cid));
      setTotal((t) => Math.max(0, t - 1));
      onCountChange?.(Math.max(0, total - 1));
    } catch (err) {
      setError(getErrorMessage(err, "No pudimos eliminar el comentario"));
    }
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
        <p className={styles.noComments}>Sin comentarios aún. ¡Sé el primero!</p>
      ) : (
        <div className={styles.commentsScroll} ref={scrollRef}>
          {comments.map((c) => {
            const cAuthorInfo = getUserDisplay(c.author);
            const cProfilePath =
              !cAuthorInfo.isDeleted && cAuthorInfo._id
                ? `/usuarios/${cAuthorInfo._id}`
                : null;
            const isOwn =
              user &&
              c.author &&
              (c.author._id || c.author).toString() === user._id.toString();
            const canDel = isOwn || canDeleteOthers;
            return (
              <div key={c._id} className={styles.comment}>
                {cProfilePath ? (
                  <Link
                    to={cProfilePath}
                    className={styles.avatarLink}
                    aria-label={`Ver perfil de ${cAuthorInfo.name}`}
                  >
                    <Avatar user={c.author} size="xs" />
                  </Link>
                ) : (
                  <Avatar user={c.author} size="xs" />
                )}
                <div className={styles.commentBody}>
                  <div className={styles.commentMeta}>
                    {cProfilePath ? (
                      <Link
                        to={cProfilePath}
                        className={`${styles.commentAuthor} ${styles.authorNameLink}`}
                      >
                        {cAuthorInfo.name}
                      </Link>
                    ) : (
                      <span className={styles.commentAuthor}>
                        {cAuthorInfo.name}
                      </span>
                    )}
                    <span className={styles.commentTime}>
                      {formatDateTime(c.createdAt)}
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
