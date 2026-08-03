import Meeple from "../../components/shared/Meeple";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Avatar from "../../components/shared/Avatar";
import CommentLikeButton from "../../components/shared/CommentLikeButton";
import LikersModal from "../../components/shared/LikersModal";
import { getUserDisplay } from "../../utils/userDisplay";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { patchCommentInTree, toggleLikePatch } from "../../utils/commentLikes";
import { API } from "../../api/endpoints";
import {
  useCompartidaCommentsQuery,
  compartidaKeys,
  addCompartidaComment,
  editCompartidaComment,
  deleteCompartidaComment,
  toggleCompartidaCommentLike,
} from "../../queries/compartidas";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import styles from "./CompartidaCard.module.css";

const COMMENT_MAX = 500;
const EMPTY_COMMENTS = [];

// Parchea el árbol de comentarios ({top-level con .replies}) cross-page,
// mismo patrón que los sockets de Eventos.jsx (Fase 6, dominio eventos).
function patchPages(old, mapComments) {
  if (!old) return old;
  return { ...old, pages: old.pages.map((p) => ({ ...p, comments: mapComments(p.comments) })) };
}

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
  const { t } = useTranslation("compartidas");
  const queryClient = useQueryClient();
  const commentsKey = compartidaKeys.comments(compartidaId);
  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    fetchNextPage,
  } = useCompartidaCommentsQuery(compartidaId);
  const comments = useMemo(
    () => data?.pages.flatMap((p) => p.comments) ?? EMPTY_COMMENTS,
    [data],
  );
  // `total` es un contador local ajustado a mano (bumpTotal) en cada
  // add/reply/delete — el server no re-cuenta hasta el próximo GET. Se
  // resincroniza solo cuando llega una página NUEVA (no en cada patch local
  // del cache, que no cambia `pages.length`).
  const [total, setTotal] = useState(0);
  const pagesLoaded = data?.pages.length ?? 0;
  useEffect(() => {
    const last = data?.pages[data.pages.length - 1];
    if (last && typeof last.total === "number") {
      setTotal(last.total);
      onCountChange?.(last.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compartidaId, pagesLoaded]);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCid, setEditingCid] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // id del comentario al que se responde
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [error, setError] = useState("");
  // id del comentario cuyo modal de "¿a quién le gustó?" está abierto.
  const [likersCommentId, setLikersCommentId] = useState(null);
  const scrollRef = useRef(null);

  const onLoadMore = useCallback(() => {
    if (!loadingMore && hasNextPage) fetchNextPage();
  }, [loadingMore, hasNextPage, fetchNextPage]);

  const sentinelRef = useInfiniteScroll(onLoadMore, {
    enabled: hasNextPage,
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
      const { data: newComment } = await addCompartidaComment(compartidaId, {
        content: commentInput.trim(),
      });
      queryClient.setQueryData(commentsKey, (old) => {
        if (!old) return old;
        const pages = [...old.pages];
        pages[0] = {
          ...pages[0],
          comments: [{ ...newComment, replies: [] }, ...pages[0].comments],
        };
        return { ...old, pages };
      });
      bumpTotal(1);
      setCommentInput("");
    } catch (err) {
      setError(getErrorMessage(err, t("comments.errorSend")));
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
      const { data: newReply } = await addCompartidaComment(compartidaId, {
        content: replyText.trim(),
        parent: parentClickedId,
      });
      // El server aplana al raíz → newReply.parent es el comentario de nivel
      // superior, que puede vivir en cualquier página ya cargada.
      queryClient.setQueryData(
        commentsKey,
        (old) =>
          patchPages(old, (list) =>
            list.map((c) =>
              c._id === newReply.parent
                ? { ...c, replies: [...(c.replies || []), newReply] }
                : c,
            ),
          ),
      );
      bumpTotal(1);
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      setError(getErrorMessage(err, t("comments.errorReply")));
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleEdit = async (cid) => {
    if (!editContent.trim()) return;
    try {
      const { data: updated } = await editCompartidaComment(
        compartidaId,
        cid,
        editContent.trim(),
      );
      queryClient.setQueryData(commentsKey, (old) =>
        patchPages(old, (list) =>
          list.map((c) => {
            if (c._id === cid) return { ...updated, replies: c.replies || [] };
            if (c.replies?.some((r) => r._id === cid)) {
              return {
                ...c,
                replies: c.replies.map((r) => (r._id === cid ? updated : r)),
              };
            }
            return c;
          }),
        ),
      );
      setEditingCid(null);
    } catch (err) {
      setError(getErrorMessage(err, t("comments.errorEdit")));
    }
  };

  const handleDelete = async (cid) => {
    try {
      await deleteCompartidaComment(compartidaId, cid);
      const top = comments.find((c) => c._id === cid);
      if (top) {
        // Comentario raíz → se borra con sus respuestas (cascada en el server).
        bumpTotal(-(1 + (top.replies?.length || 0)));
        queryClient.setQueryData(commentsKey, (old) =>
          patchPages(old, (list) => list.filter((c) => c._id !== cid)),
        );
      } else {
        bumpTotal(-1);
        queryClient.setQueryData(commentsKey, (old) =>
          patchPages(old, (list) =>
            list.map((c) => ({
              ...c,
              replies: (c.replies || []).filter((r) => r._id !== cid),
            })),
          ),
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, t("comments.errorDelete")));
    }
  };

  // Toggle de like de un comentario/respuesta. Optimistic + rollback (patrón
  // useCompartidaLike). El árbol se actualiza con patchCommentInTree (sirve
  // tanto para top-level como para respuestas), cross-page.
  const toggleCommentLike = async (c) => {
    if (!user) {
      onRequireLogin?.(t("comments.requireLogin"));
      return;
    }
    const original = { liked: c.liked, likeCount: c.likeCount ?? 0 };
    queryClient.setQueryData(commentsKey, (old) =>
      patchPages(old, (list) =>
        patchCommentInTree(list, c._id, toggleLikePatch(c)),
      ),
    );
    try {
      await toggleCompartidaCommentLike(compartidaId, c._id);
    } catch {
      queryClient.setQueryData(commentsKey, (old) =>
        patchPages(old, (list) => patchCommentInTree(list, c._id, original)),
      );
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
            aria-label={t("comments.viewProfile", { name: info.name })}
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
            {c.editedAt && (
              <span className={styles.editedBadge}>{t("comments.edited")}</span>
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
                  {t("comments.save")}
                </button>
                <button
                  className={styles.btnGhost}
                  onClick={() => setEditingCid(null)}
                >
                  {t("comments.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.commentText}>{c.content}</p>
          )}
          {editingCid !== c._id && (
            <div className={styles.commentActions}>
              <CommentLikeButton
                liked={c.liked}
                count={c.likeCount ?? 0}
                onToggle={() => toggleCommentLike(c)}
                onShowLikers={() => setLikersCommentId(c._id)}
              />
              {user && (
                <button
                  className={styles.commentActionBtn}
                  onClick={() => openReply(c._id, isReply ? info.name : null)}
                >
                  {t("comments.reply")}
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
                  {t("comments.edit")}
                </button>
              )}
              {canDel && (
                <button
                  className={`${styles.commentActionBtn} ${styles.commentActionDanger}`}
                  onClick={() => {
                    // Confirmación antes de borrar — propio o, para autor/admin,
                    // el comentario de otro usuario.
                    const msg = isOwn
                      ? t("comments.confirmDeleteOwn")
                      : t("comments.confirmDeleteOther", { name: info.name });
                    if (window.confirm(msg)) handleDelete(c._id);
                  }}
                >
                  {t("comments.delete")}
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
                placeholder={t("comments.replyPlaceholder")}
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
                aria-label={t("comments.sendReply")}
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
                {t("comments.cancel")}
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
        <Meeple />
        {total > 0
          ? t("comments.headCount", { count: total })
          : t("comments.head")}
      </div>

      {/* Form arriba — los comentarios nuevos aparecen al instante en el tope. */}
      {user ? (
        <form className={styles.commentForm} onSubmit={handleAdd}>
          <Avatar user={user} size="xs" />
          <input
            className={styles.commentInput}
            placeholder={t("comments.commentPlaceholder")}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            maxLength={COMMENT_MAX}
            disabled={submitting}
          />
          <button
            type="submit"
            className={styles.commentSubmit}
            disabled={!commentInput.trim() || submitting}
            aria-label={t("comments.sendComment")}
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
          onClick={() => onRequireLogin?.(t("comments.requireLoginComment"))}
          type="button"
        >
          {t("comments.guestCta")}
        </button>
      )}
      {user && commentInput.length >= COMMENT_MAX - 50 && (
        <div className={styles.commentCharCount}>
          {`${commentInput.length}/${COMMENT_MAX}`}
        </div>
      )}

      {error && <p className={styles.commentsError}>{error}</p>}

      {loading ? (
        <div className={styles.commentsLoader}>
          <span className={styles.commentsLoaderDot} />
          <span className={styles.commentsLoaderDot} />
          <span className={styles.commentsLoaderDot} />
        </div>
      ) : total === 0 ? (
        <p className={styles.noComments}>{t("comments.empty")}</p>
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

          {hasNextPage && (
            <button
              type="button"
              className={styles.commentsMoreBtn}
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? t("comments.loadingMore")
                : t("comments.loadMore")}
            </button>
          )}
          {hasNextPage && <div ref={sentinelRef} aria-hidden="true" />}
        </div>
      )}

      <LikersModal
        isOpen={!!likersCommentId}
        onClose={() => setLikersCommentId(null)}
        title={t("comments.likersTitle")}
        fetchUrl={
          likersCommentId
            ? API.compartidas.COMMENT_LIKES(compartidaId, likersCommentId)
            : null
        }
      />
    </div>
  );
}
