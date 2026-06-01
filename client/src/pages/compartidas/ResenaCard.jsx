import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import RichTextContent from "../../components/shared/RichTextContent";
import RichTextEditor from "../../components/shared/RichTextEditor";
import BggGameSearch from "../../components/shared/BggGameSearch";
import { getUserDisplay } from "../../utils/userDisplay";
import { buildCompartidaShare } from "../../utils/share";
import CompartidaComments from "./CompartidaComments";
import { useCompartidaLike } from "./useCompartidaLike";
import styles from "./ResenaCard.module.css";

// Mismo formato que CompartidaCard ("hace 3h" / "el 15 de enero").
function timeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "recién";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`;
  const isOlderYear = d.getFullYear() < new Date().getFullYear();
  return `el ${d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    ...(isOlderYear && { year: "numeric" }),
  })}`;
}

const PRIVACY_LABELS = {
  public: "Público",
  friends: "Amigos",
  private: "Solo yo",
};

const bodyToText = (html) => (html || "").replace(/<[^>]*>/g, " ").trim();

export default function ResenaCard({
  post: initialPost,
  onDeleted,
  onUpdated,
  featured,
  index = 0,
}) {
  const { user } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  const [post, setPost] = useState(initialPost);
  const [loginPrompt, setLoginPrompt] = useState("");
  const {
    liked,
    count: likeCount,
    popping: heartPopping,
    toggle: toggleLike,
  } = useCompartidaLike({ post: initialPost, user });
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(
    initialPost.commentCount ?? 0,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [editRating, setEditRating] = useState(post.rating || 0);
  const [editGame, setEditGame] = useState(post.boardGame || null);
  // La privacidad de la reseña se mantiene al editar (no hay selector inline).
  const [editPrivacy] = useState(post.privacy);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  const authorInfo = getUserDisplay(post.author);
  const authorProfilePath =
    !authorInfo.isDeleted && authorInfo._id
      ? `/usuarios/${authorInfo._id}`
      : null;
  const authorName = authorInfo.name;
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

  const lbImages = post.images || [];
  const closeLightbox = () => setLightboxIndex(null);
  const goPrev = () =>
    setLightboxIndex((i) =>
      i === null ? i : (i - 1 + lbImages.length) % lbImages.length,
    );
  const goNext = () =>
    setLightboxIndex((i) => (i === null ? i : (i + 1) % lbImages.length));

  useEffect(() => {
    if (lightboxIndex === null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, lbImages.length]);

  const handleLike = () => {
    if (!user) {
      setLoginPrompt("Iniciá sesión para dar like a esta reseña.");
      return;
    }
    toggleLike();
  };

  const toggleComments = () => setShowComments((s) => !s);

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta reseña?")) return;
    try {
      await axios.delete(API.compartidas.DETAIL(post._id));
      onDeleted?.(post._id);
    } catch {
      /* ignore */
    }
  };

  const handleSaveEdit = async () => {
    if (!editGame) {
      setEditError("Elegí un juego.");
      return;
    }
    if (!editRating) {
      setEditError("Elegí una puntuación de 1 a 10.");
      return;
    }
    if (!editTitle.trim() && !bodyToText(editBody)) {
      setEditError("Escribí un título o el cuerpo de la reseña.");
      return;
    }
    setEditError("");
    setSaving(true);
    try {
      const { data } = await axios.put(API.compartidas.DETAIL(post._id), {
        title: editTitle,
        body: editBody,
        rating: editRating,
        boardGame: {
          bggId: editGame.bggId ?? editGame.id,
          name: editGame.name,
          thumbnail: editGame.thumbnail,
          image: editGame.image,
          year: editGame.year,
        },
        privacy: editPrivacy,
      });
      const updated = { ...post, ...data };
      setPost(updated);
      onUpdated?.(updated);
      setEditing(false);
    } catch (err) {
      setEditError(err.response?.data?.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const game = post.boardGame;
  const cover = game?.image || game?.thumbnail || "";
  const privacyLabel = PRIVACY_LABELS[post.privacy];
  const share = buildCompartidaShare(
    post,
    typeof window !== "undefined" ? window.location.origin : "",
  );

  const lightboxPortal =
    lightboxIndex !== null && lbImages[lightboxIndex]
      ? createPortal(
          <div className={styles.lightbox} onClick={closeLightbox}>
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              aria-label="Cerrar"
            >
              ✕
            </button>
            <img
              src={lbImages[lightboxIndex].url}
              alt=""
              className={styles.lightboxImg}
              onClick={(e) => e.stopPropagation()}
            />
            {lbImages.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  aria-label="Imagen anterior"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  aria-label="Imagen siguiente"
                >
                  ›
                </button>
                <span className={styles.lightboxCounter}>
                  {lightboxIndex + 1} / {lbImages.length}
                </span>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

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
          <div className={styles.featuredBadge}>◆ Reseña destacada</div>
        )}

        {/* ── Header de juego (cover + nombre + rating) ── */}
        <header
          className={styles.gameHeader}
          style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        >
          <div className={styles.gameHeaderOverlay} />
          <div className={styles.gameHeaderInner}>
            {cover ? (
              <img
                src={game.thumbnail || game.image}
                alt={game?.name || ""}
                className={styles.gameCover}
                loading="lazy"
              />
            ) : (
              <span className={styles.gameCover} aria-hidden="true">
                🎲
              </span>
            )}
            <div className={styles.gameHeaderInfo}>
              <span className={styles.eyebrow}>Reseña</span>
              <span className={styles.gameName}>
                {game?.name || "Juego"}
                {game?.year ? (
                  <span className={styles.gameYear}> ({game.year})</span>
                ) : null}
              </span>
            </div>
            {post.rating != null && (
              <div
                className={styles.ratingBadge}
                aria-label={`Puntuación ${post.rating} de 10`}
              >
                <span className={styles.ratingNum}>{post.rating}</span>
                <span className={styles.ratingMax}>/10</span>
              </div>
            )}
          </div>
        </header>

        {/* ── Meta de autor ── */}
        <div className={styles.authorRow}>
          {authorProfilePath ? (
            <Link
              to={authorProfilePath}
              className={styles.avatarLink}
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar user={post.author} size="sm" />
            </Link>
          ) : (
            <Avatar user={post.author} size="sm" />
          )}
          <div className={styles.authorMeta}>
            {authorProfilePath ? (
              <Link to={authorProfilePath} className={styles.authorNameLink}>
                <span className={styles.authorName}>{authorName}</span>
              </Link>
            ) : (
              <span className={styles.authorName}>{authorName}</span>
            )}
            <span className={styles.metaTime}>
              {timeAgo(post.createdAt)}
              {privacyLabel && post.privacy !== "public"
                ? ` · ${privacyLabel}`
                : ""}
              {bgwatchEnabled && post.author?.bggUsername ? (
                <>
                  {" · "}
                  <Link
                    to={`/bg-watch/${encodeURIComponent(post.author.bggUsername)}`}
                    className={styles.bgwatchLink}
                  >
                    BG Watch
                  </Link>
                </>
              ) : null}
            </span>
          </div>
          {isAuthor && (
            <div className={styles.menuWrap} ref={menuRef}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Opciones"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className={styles.menu}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
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

        {editing ? (
          <div className={styles.editForm}>
            {editError && <div className={styles.editErr}>{editError}</div>}
            <input
              className={styles.editTitle}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Título de la reseña"
              maxLength={100}
            />
            {editGame ? (
              <div className={styles.editGameChip}>
                <span>🎲 {editGame.name}</span>
                <button type="button" onClick={() => setEditGame(null)}>
                  Cambiar
                </button>
              </div>
            ) : (
              <BggGameSearch
                onPick={(g) => setEditGame({ ...g, bggId: g.id })}
                autoFocus={false}
              />
            )}
            <div
              className={styles.editRatingRow}
              role="radiogroup"
              aria-label="Puntuación"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={editRating === n}
                  className={`${styles.ratingPill} ${editRating === n ? styles.ratingPillActive : ""}`}
                  onClick={() => setEditRating(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <RichTextEditor
              value={editBody}
              onChange={setEditBody}
              placeholder="Escribí tu reseña…"
              maxLength={20000}
            />
            <div className={styles.editActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnSave}
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {post.title && <h2 className={styles.title}>{post.title}</h2>}
            <RichTextContent html={post.body} className={styles.body} />

            {lbImages.length > 0 && (
              <div className={styles.images}>
                {lbImages.map((img, i) => (
                  <button
                    key={img._id || i}
                    type="button"
                    className={styles.imageBtn}
                    onClick={() => setLightboxIndex(i)}
                    aria-label={`Ver foto ${i + 1}`}
                  >
                    <img src={img.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <div className={styles.reactionGroup}>
            <button
              type="button"
              className={`${styles.reactionBtn} ${liked ? styles.reactionBtnLiked : ""}`}
              onClick={handleLike}
              aria-label={liked ? "Quitar me gusta" : "Me gusta"}
            >
              <span
                className={`${styles.likeHeart} ${heartPopping ? styles.likeHeartPop : ""}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill={liked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </span>
              <span>{likeCount}</span>
            </button>
            <button
              type="button"
              className={styles.reactionBtn}
              onClick={toggleComments}
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
              <span>{commentCount}</span>
              <span className={styles.reactionLabel}>
                {commentCount === 1 ? "comentario" : "comentarios"}
              </span>
            </button>
          </div>

          <div className={styles.shareGroup}>
            <a
              className={styles.shareBtn}
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(share.whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en WhatsApp"
              aria-label="Compartir en WhatsApp"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.862L.057 23.886a.5.5 0 0 0 .612.612l6.05-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.51-5.166-1.396l-.37-.22-3.827.934.952-3.782-.243-.388A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
            </a>
            <a
              className={styles.shareBtn}
              href={`https://t.me/share/url?url=${encodeURIComponent(share.url)}&text=${encodeURIComponent(share.caption)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en Telegram"
              aria-label="Compartir en Telegram"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.08 13.63l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.931z" />
              </svg>
            </a>
            <button
              type="button"
              className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ""}`}
              onClick={() => {
                navigator.clipboard.writeText(share.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              title={copied ? "¡Copiado!" : "Copiar enlace"}
              aria-label="Copiar enlace"
            >
              {copied ? "✓" : "🔗"}
            </button>
          </div>
        </div>

        {showComments && (
          <CompartidaComments
            compartidaId={post._id}
            user={user}
            canDeleteOthers={isAuthor || !!user?.isAdmin}
            onRequireLogin={setLoginPrompt}
            onCountChange={setCommentCount}
          />
        )}
      </article>

      {lightboxPortal}
    </>
  );
}
