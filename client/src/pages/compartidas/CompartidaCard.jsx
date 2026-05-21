import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import GameTile from "../../components/shared/GameTile";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import styles from "./CompartidaCard.module.css";

function buildShareData(post) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/compartidas/${post._id}`;
  const parts = [];
  if (post.title) parts.push(`*${post.title}*`);
  if (post.body)
    parts.push(post.body.slice(0, 180) + (post.body.length > 180 ? "…" : ""));
  parts.push(`🎲 ${url}`);
  const text = parts.join("\n");
  return { url, text };
}

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

// Small inline link rendered next to the author's name when they have an active
// BG Watch (i.e. populated `bggUsername`). Click → their BG Watch profile.
function AuthorBgWatchLink({ author, enabled }) {
  if (!enabled) return null;
  if (!author?.bggUsername) return null;
  return (
    <Link
      to={`/bg-watch/${encodeURIComponent(author.bggUsername)}`}
      className={styles.authorBgWatchLink}
      title={`Ver historial de partidas de @${author.username}`}
      aria-label={`Ver BG Watch de ${author.username}`}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    </Link>
  );
}

function formatTableDate(date) {
  return new Date(date).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const PRIVACY_LABELS = {
  public: "Público",
  friends: "Amigos",
  private: "Solo yo",
};
const TAPE_POSITIONS = ["center", "left", "right", "left"];

function PrivacyIcon({ privacy }) {
  if (privacy === "friends") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (privacy === "private") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  // public
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}

// Polaroid primitive — paper-stock background, optional tape and caption.
// `index` drives a deterministic rotation per slot.
function Polaroid({ image, index = 0, count = 1, withTape = true, caption }) {
  const tapePos = TAPE_POSITIONS[index % TAPE_POSITIONS.length];
  const rotateClass = styles[`polaroidRot${index % 4}`];
  return (
    <div className={`${styles.polaroid} ${rotateClass}`}>
      {withTape && (
        <span
          className={`${styles.polaroidTape} ${styles[`tape_${tapePos}`]}`}
          aria-hidden="true"
        />
      )}
      <div
        className={`${styles.polaroidPhoto} ${count === 1 ? styles.polaroidPhotoLandscape : ""}`}
      >
        {image?.url ? (
          <img src={image.url} alt="" className={styles.photo} loading="lazy" />
        ) : (
          <span className={styles.polaroidPhotoFallback}>foto</span>
        )}
      </div>
      {caption && <span className={styles.polaroidCaption}>{caption}</span>}
    </div>
  );
}

export default function CompartidaCard({
  post: initialPost,
  onDeleted,
  onUpdated,
  featured,
  index = 0,
}) {
  const { user } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const mesasEnabled = isSectionEnabled("mesas");
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  const [post, setPost] = useState(initialPost);
  const [liked, setLiked] = useState(() =>
    user
      ? initialPost.likes.some(
          (l) => (l._id || l).toString() === user._id.toString(),
        )
      : false,
  );
  const [heartPopping, setHeartPopping] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState("");
  const [likeCount, setLikeCount] = useState(initialPost.likes.length);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCount, setCommentCount] = useState(
    initialPost.commentCount ?? 0,
  );
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCid, setEditingCid] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [editPrivacy, setEditPrivacy] = useState(post.privacy);
  const [lightbox, setLightbox] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);
  const commentInputRef = useRef(null);

  const authorInfo = getUserDisplay(post.author);
  const isAuthor =
    user &&
    post.author &&
    (post.author._id?.toString() === user._id.toString() ||
      post.author.toString?.() === user._id.toString());

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLike = async () => {
    if (!user) {
      setLoginPrompt("Iniciá sesión para dar like a esta compartida.");
      return;
    }
    const prev = liked;
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    if (!prev) {
      setHeartPopping(true);
      setTimeout(() => setHeartPopping(false), 350);
    }
    try {
      await axios.post(`/api/compartidas/${post._id}/like`);
    } catch {
      setLiked(prev);
      setLikeCount((c) => c + (prev ? 1 : -1));
    }
  };

  const toggleComments = async () => {
    if (!showComments && !commentsLoaded) {
      setShowComments(true);
      setLoadingComments(true);
      try {
        const { data } = await axios.get(
          `/api/compartidas/${post._id}/comments`,
        );
        setComments(data);
        setCommentsLoaded(true);
        setCommentCount(data.length);
      } catch {
        /* silently ignore */
      } finally {
        setLoadingComments(false);
      }
    } else {
      setShowComments((s) => !s);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post(
        `/api/compartidas/${post._id}/comments`,
        { content: commentInput.trim() },
      );
      setComments((c) => [...c, data]);
      setCommentCount((n) => n + 1);
      setCommentInput("");
    } catch {
      /* silently ignore */
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (cid) => {
    if (!editContent.trim()) return;
    try {
      const { data } = await axios.put(
        `/api/compartidas/${post._id}/comments/${cid}`,
        { content: editContent.trim() },
      );
      setComments((cs) => cs.map((c) => (c._id === cid ? data : c)));
      setEditingCid(null);
    } catch {
      /* silently ignore */
    }
  };

  const handleDeleteComment = async (cid) => {
    try {
      await axios.delete(`/api/compartidas/${post._id}/comments/${cid}`);
      setComments((cs) => cs.filter((c) => c._id !== cid));
      setCommentCount((n) => Math.max(0, n - 1));
    } catch {
      /* silently ignore */
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta compartida?")) return;
    try {
      await axios.delete(`/api/compartidas/${post._id}`);
      onDeleted?.(post._id);
    } catch {
      /* silently ignore */
    }
  };

  const handleSaveEdit = async () => {
    try {
      const { data } = await axios.put(`/api/compartidas/${post._id}`, {
        title: editTitle,
        body: editBody,
        privacy: editPrivacy,
      });
      const updated = {
        ...post,
        title: data.title,
        body: data.body,
        privacy: data.privacy,
      };
      setPost(updated);
      onUpdated?.(updated);
      setEditing(false);
    } catch {
      /* silently ignore */
    }
  };

  const table = mesasEnabled ? post.linkedTable : null;
  const tableSeats = table
    ? table.maxPlayers - (table.players?.length || 0)
    : 0;
  const tableOpen = table?.status === "open";
  const bodyLong = post.body.length > 220;
  const displayBody =
    expanded || !bodyLong ? post.body : `${post.body.slice(0, 220)}…`;
  const authorName = authorInfo.name;
  const privacyLabel = PRIVACY_LABELS[post.privacy];
  const imageCount = post.images.length;
  const imageGridClass = styles[`photoGrid${Math.min(imageCount, 4)}`];
  const pullQuote = featured
    ? post.body.slice(0, 180) + (post.body.length > 180 ? "…" : "")
    : null;

  // ── Featured broadside (compartida del día) ──
  // Renders the desktop-handoff broadside layout: eyebrow + title + body
  // + integrated meta row (game · likes · comments) on the left, big
  // polaroid on the right. Hides the normal post header, mesa ticket,
  // footer reactions/share row, and inline comments — clicking the card
  // navigates to the full post for the rest.
  if (featured && !editing) {
    return (
      <>
        <LoginPromptModal
          isOpen={!!loginPrompt}
          onClose={() => setLoginPrompt("")}
          message={loginPrompt}
        />
        <article
          className={`${styles.card} ${styles.cardFeatured}`}
          style={{ "--i": index }}
        >
          <div className={styles.featuredBadge}>◆ Compartida del día</div>
          <div className={styles.broadsideGrid}>
            <div className={styles.broadsideMain}>
              <div className={styles.broadsideEyebrow}>
                <Avatar user={post.author} size="xs" />
                <span>
                  Por <strong>{authorName}</strong> · hace{" "}
                  {timeAgo(post.createdAt)}
                </span>
                {!authorInfo.isDeleted && (
                  <AuthorBgWatchLink
                    author={post.author}
                    enabled={bgwatchEnabled}
                  />
                )}
              </div>

              {post.title && <h2 className={styles.title}>{post.title}</h2>}
              {post.body && <p className={styles.pullQuote}>{pullQuote}</p>}

              <div className={styles.broadsideMeta}>
                {table && (
                  <span>
                    ◆ <strong>{table.boardGame}</strong>
                  </span>
                )}
                <button
                  type="button"
                  className={`${styles.broadsideStat} ${liked ? styles.broadsideStatLiked : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                  aria-label={liked ? "Quitar me gusta" : "Me gusta"}
                >
                  <span
                    className={`${styles.likeHeart} ${heartPopping ? styles.likeHeartPop : ""}`}
                  >
                    {liked ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
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
                  {likeCount}
                </button>
                <button
                  type="button"
                  className={`${styles.broadsideStat} ${showComments ? styles.broadsideStatActive : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleComments();
                  }}
                  aria-label={
                    showComments ? "Ocultar comentarios" : "Ver comentarios"
                  }
                  aria-expanded={showComments}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {commentCount}
                </button>
              </div>
            </div>

            <div className={`${styles.photos} ${styles.photosFeatured}`}>
              <button
                type="button"
                className={styles.photoBtn}
                onClick={() =>
                  post.images[0]?.url && setLightbox(post.images[0].url)
                }
                disabled={!post.images[0]?.url}
              >
                <Polaroid
                  image={post.images[0] || null}
                  index={0}
                  count={1}
                  withTape
                  caption="el momento exacto"
                />
              </button>
            </div>
          </div>

          {showComments && (
            <div className={styles.comments}>
              {loadingComments ? (
                <div className={styles.commentsLoader}>
                  <span className={styles.commentsLoaderDot} />
                  <span className={styles.commentsLoaderDot} />
                  <span className={styles.commentsLoaderDot} />
                </div>
              ) : comments.length === 0 ? (
                <p className={styles.noComments}>
                  Sin comentarios aún. ¡Sé el primero!
                </p>
              ) : (
                <div className={styles.commentsHead}>
                  ◆ Dejá tu comentario
                  {commentCount > 1 ? ` (${commentCount})` : ""}
                </div>
              )}
              {comments.map((c) => {
                const cAuthorInfo = getUserDisplay(c.author);
                const isOwn =
                  user &&
                  c.author &&
                  (c.author._id || c.author).toString() === user._id.toString();
                const canDel = isOwn || isAuthor || user?.isAdmin;
                return (
                  <div key={c._id} className={styles.comment}>
                    <Avatar user={c.author} size="xs" />
                    <div className={styles.commentBody}>
                      <div className={styles.commentMeta}>
                        <span className={styles.commentAuthor}>
                          {cAuthorInfo.name}
                        </span>
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
                              onClick={() => handleEditComment(c._id)}
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
                              onClick={() => handleDeleteComment(c._id)}
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
                <form
                  className={styles.commentForm}
                  onSubmit={handleAddComment}
                >
                  <Avatar user={user} size="xs" />
                  <input
                    ref={commentInputRef}
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
                    setLoginPrompt(
                      "Iniciá sesión para comentar en esta compartida.",
                    )
                  }
                  type="button"
                >
                  Iniciá sesión para comentar
                </button>
              )}
            </div>
          )}
        </article>

        {lightbox && (
          <div className={styles.lightbox} onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="" className={styles.lightboxImg} />
            <button className={styles.lightboxClose}>✕</button>
          </div>
        )}
      </>
    );
  }

  const upperSections = (
    <>
      {/* ── Header ── */}
      <div className={styles.header}>
        <Avatar user={post.author} size="md" />
        <div className={styles.authorMeta}>
          <div className={styles.authorNameRow}>
            <span className={styles.authorName}>{authorName}</span>
            {!authorInfo.isDeleted && (
              <AuthorBgWatchLink
                author={post.author}
                enabled={bgwatchEnabled}
              />
            )}
          </div>
          <div className={styles.metaLine}>
            <span className={styles.metaTime}>
              ◆ hace {timeAgo(post.createdAt)}
            </span>
            {privacyLabel && post.privacy !== "public" && (
              <span className={styles.privacyBadge}>
                <PrivacyIcon privacy={post.privacy} />
                {privacyLabel}
              </span>
            )}
          </div>
        </div>
        {isAuthor && (
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              className={styles.menuBtn}
              onClick={() => setMenuOpen((o) => !o)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className={styles.menu}>
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                >
                  Editar
                </button>
                <button
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={handleDelete}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit form ── */}
      {editing ? (
        <div className={styles.editForm}>
          <input
            className={styles.editTitle}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Título (opcional)"
            maxLength={100}
          />
          <textarea
            className={styles.editBody}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            placeholder="¿Cómo estuvo la compartida?"
            rows={4}
            maxLength={2000}
          />
          <div className={styles.editPrivacyRow}>
            {["public", "friends", "private"].map((p) => (
              <button
                key={p}
                className={`${styles.privacyBtn} ${editPrivacy === p ? styles.privacyBtnActive : ""}`}
                onClick={() => setEditPrivacy(p)}
                type="button"
              >
                {p === "public"
                  ? "Público"
                  : p === "friends"
                    ? "Amigos"
                    : "Solo yo"}
              </button>
            ))}
          </div>
          <div className={styles.editActions}>
            <button
              className={styles.btnGhost}
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
            <button className={styles.btnSave} onClick={handleSaveEdit}>
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Content ── */}
          <div className={styles.contentWrap}>
            {post.title && <h3 className={styles.title}>{post.title}</h3>}
            {featured ? (
              <p className={styles.pullQuote}>{pullQuote}</p>
            ) : (
              post.body && (
                <>
                  <p className={styles.body}>{displayBody}</p>
                  {bodyLong && (
                    <button
                      className={styles.expandBtn}
                      onClick={() => setExpanded((e) => !e)}
                    >
                      {expanded ? "+ Ver menos" : "+ Ver más"}
                    </button>
                  )}
                </>
              )
            )}
          </div>
        </>
      )}

      {/* ── Photos (polaroid grid) ── */}
      {imageCount > 0 && (
        <div
          className={`${styles.photos} ${imageGridClass} ${featured ? styles.photosFeatured : ""}`}
        >
          {post.images.map((img, i) => (
            <button
              key={img._id || i}
              className={styles.photoBtn}
              onClick={() => setLightbox(img.url)}
            >
              <Polaroid
                image={img}
                index={i}
                count={imageCount}
                withTape={i === 0 || imageCount > 1}
                caption={i === 0 && featured ? "el momento exacto" : null}
              />
            </button>
          ))}
        </div>
      )}

      {/* ── Linked Mesa (ticket-stub with perforations) ── */}
      {table && (
        <div className={styles.mesaTicket}>
          <div className={styles.mesaTile}>
            <GameTile
              game={table.boardGame}
              seed={table._id?.charCodeAt(0) || 42}
              size={38}
            />
          </div>
          <div className={styles.mesaInfo}>
            <span className={styles.mesaLabel}>◆ Mesa enlazada</span>
            <span className={styles.mesaGame}>{table.boardGame}</span>
            <span className={styles.mesaMeta}>
              {formatTableDate(table.date)}
              {table.location ? ` · ${table.location}` : ""}
              {tableOpen &&
                ` · ${tableSeats} lugar${tableSeats !== 1 ? "es" : ""}`}
            </span>
          </div>
          <Link
            to={`/mesas/${table._id}`}
            className={`${styles.mesaCta} ${tableOpen ? styles.mesaCtaOpen : ""}`}
          >
            {tableOpen ? "Unirse" : "Ver mesa"}
          </Link>
        </div>
      )}

      {/* ── Featured meta row (game pill only; counts live in footer) ── */}
      {featured && table && (
        <div className={styles.broadsideMeta}>
          <span>
            ◆ <strong>{table.boardGame}</strong>
          </span>
        </div>
      )}
    </>
  );

  return (
    <>
      <LoginPromptModal
        isOpen={!!loginPrompt}
        onClose={() => setLoginPrompt("")}
        message={loginPrompt}
      />
      <article
        className={`${styles.card} ${featured ? styles.cardFeatured : ""}`}
        style={{ "--i": index }}
      >
        {featured && (
          <div className={styles.featuredBadge}>◆ Compartida del día</div>
        )}

        {upperSections}

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <div className={styles.reactionGroup}>
            <button
              className={`${styles.reactionBtn} ${liked ? styles.reactionBtnLiked : ""}`}
              onClick={handleLike}
            >
              <span
                className={`${styles.likeHeart} ${heartPopping ? styles.likeHeartPop : ""}`}
              >
                {liked ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
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
              <span>{likeCount}</span>
            </button>
            <button className={styles.reactionBtn} onClick={toggleComments}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>{commentCount}</span>
              <span className={styles.reactionLabel}>
                {commentCount === 1 ? "comentario" : "comentarios"}
              </span>
            </button>
          </div>

          <div className={styles.shareGroup}>
            {/* WhatsApp */}
            <a
              className={styles.shareBtn}
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(buildShareData(post).text)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en WhatsApp"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.862L.057 23.886a.5.5 0 0 0 .612.612l6.05-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.51-5.166-1.396l-.37-.22-3.827.934.952-3.782-.243-.388A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
            </a>

            {/* Telegram */}
            <a
              className={styles.shareBtn}
              href={`https://t.me/share/url?url=${encodeURIComponent(buildShareData(post).url)}&text=${encodeURIComponent(buildShareData(post).text)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en Telegram"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.08 13.63l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.931z" />
              </svg>
            </a>

            {/* Copy link */}
            <button
              className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ""}`}
              onClick={() => {
                navigator.clipboard.writeText(buildShareData(post).url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              title={copied ? "¡Copiado!" : "Copiar enlace"}
            >
              {copied ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
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
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Comments ── */}
        {showComments && (
          <div className={styles.comments}>
            {loadingComments ? (
              <div className={styles.commentsLoader}>
                <span className={styles.commentsLoaderDot} />
                <span className={styles.commentsLoaderDot} />
                <span className={styles.commentsLoaderDot} />
              </div>
            ) : comments.length === 0 ? (
              <p className={styles.noComments}>
                Sin comentarios aún. ¡Sé el primero!
              </p>
            ) : (
              <div className={styles.commentsHead}>
                ◆ Dejá tu comentario
                {commentCount > 1 ? ` (${commentCount})` : ""}
              </div>
            )}
            {comments.map((c) => {
              const cAuthorInfo = getUserDisplay(c.author);
              const isOwn =
                user &&
                c.author &&
                (c.author._id || c.author).toString() === user._id.toString();
              const canDel = isOwn || isAuthor || user?.isAdmin;
              return (
                <div key={c._id} className={styles.comment}>
                  <Avatar user={c.author} size="xs" />
                  <div className={styles.commentBody}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAuthor}>
                        {cAuthorInfo.name}
                      </span>
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
                            onClick={() => handleEditComment(c._id)}
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
                            onClick={() => handleDeleteComment(c._id)}
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
              <form className={styles.commentForm} onSubmit={handleAddComment}>
                <Avatar user={user} size="xs" />
                <input
                  ref={commentInputRef}
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
                  setLoginPrompt(
                    "Iniciá sesión para comentar en esta compartida.",
                  )
                }
                type="button"
              >
                Iniciá sesión para comentar
              </button>
            )}
          </div>
        )}
      </article>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className={styles.lightboxImg} />
          <button className={styles.lightboxClose}>✕</button>
        </div>
      )}
    </>
  );
}
