import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import ItemCommunityTag from "../../components/shared/ItemCommunityTag";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import RichTextContent from "../../components/shared/RichTextContent";
import RichTextEditor from "../../components/shared/RichTextEditor";
import BggGameSearch from "../../components/shared/BggGameSearch";
import { getUserDisplay } from "../../utils/userDisplay";
import { buildCompartidaShare } from "../../utils/share";
import { useShortLink } from "../../hooks/useShortLink";
import useDialogA11y from "../../hooks/useDialogA11y";
import useRovingRadioGroup from "../../hooks/useRovingRadioGroup";
import { getShortUrl } from "../../utils/shortlink";
import { compartidaTimeAgo } from "./compartidaTime";
import CompartidaComments from "./CompartidaComments";
import { useCompartidaLike } from "./useCompartidaLike";
import styles from "./ResenaCard.module.css";

const bodyToText = (html) => (html || "").replace(/<[^>]*>/g, " ").trim();

const RATING_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

// Reseñas con más de este largo (texto plano) se recortan en el feed y se
// expanden con un botón "Leer más" (efecto slide).
const LONG_BODY_CHARS = 500;
// Altura (px) del preview recortado antes de expandir.
const COLLAPSED_BODY_PX = 240;

export default function ResenaCard({
  post: initialPost,
  onDeleted,
  onUpdated,
  featured,
  index = 0,
  clampBody = true,
}) {
  const { t } = useTranslation("compartidas");
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
  const [expanded, setExpanded] = useState(false);
  const [fullBodyHeight, setFullBodyHeight] = useState(0);
  const menuRef = useRef(null);
  const bodyInnerRef = useRef(null);

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
  const lightboxRef = useDialogA11y(lightboxIndex !== null);
  const ratingGroup = useRovingRadioGroup({
    items: RATING_VALUES,
    value: editRating,
    onChange: setEditRating,
  });
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
      setLoginPrompt(t("resena.loginLike"));
      return;
    }
    toggleLike();
  };

  const toggleComments = () => setShowComments((s) => !s);

  const handleDelete = async () => {
    if (!window.confirm(t("resena.confirmDelete"))) return;
    try {
      await axios.delete(API.compartidas.DETAIL(post._id));
      onDeleted?.(post._id);
    } catch {
      /* ignore */
    }
  };

  const handleSaveEdit = async () => {
    if (!editGame) {
      setEditError(t("resena.errorGameRequired"));
      return;
    }
    if (!editRating) {
      setEditError(t("resena.errorRatingRequired"));
      return;
    }
    if (!editTitle.trim() && !bodyToText(editBody)) {
      setEditError(t("resena.errorContent"));
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
      setEditError(err.response?.data?.message || t("resena.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  // ── "Leer más" para reseñas largas (slide) ──
  const bodyIsLong = useMemo(
    () => bodyToText(post.body).length > LONG_BODY_CHARS,
    [post.body],
  );
  const clampBodyActive = clampBody && bodyIsLong && !editing;
  // Mientras no medimos (fullBodyHeight === 0, ej. SSR/tests) asumimos que
  // desborda; en cuanto medimos sólo recortamos si supera el preview.
  const bodyOverflows =
    fullBodyHeight === 0 || fullBodyHeight > COLLAPSED_BODY_PX + 32;
  const showReadMore = clampBodyActive && bodyOverflows;

  useLayoutEffect(() => {
    if (!clampBodyActive) return undefined;
    const el = bodyInnerRef.current;
    if (!el) return undefined;
    const measure = () => setFullBodyHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clampBodyActive, post.body]);

  const game = post.boardGame;
  const cover = game?.image || game?.thumbnail || "";
  const privacyLabel =
    post.privacy !== "public" ? t(`privacy.${post.privacy}`) : "";
  // Short link transparente (ver CompartidaCard): perezoso, primed al interactuar.
  const { shortUrl, prime: primeShort } = useShortLink({
    type: "compartida",
    ref: post._id,
  });
  const share = buildCompartidaShare(
    post,
    typeof window !== "undefined" ? window.location.origin : "",
    shortUrl || undefined,
  );

  const lightboxPortal =
    lightboxIndex !== null && lbImages[lightboxIndex]
      ? createPortal(
          <div
            className={styles.lightbox}
            onClick={closeLightbox}
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("resena.lightboxLabel")}
            tabIndex={-1}
          >
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              aria-label={t("resena.close")}
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
                  aria-label={t("resena.prevImage")}
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
                  aria-label={t("resena.nextImage")}
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
          <div className={styles.featuredBadge}>
            <Meeple />
            {t("resena.featuredBadge")}
          </div>
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
              <span className={styles.eyebrow}>{t("resena.eyebrow")}</span>
              <span className={styles.gameName}>
                {game?.bggId ? (
                  <Link
                    to={`/compartidas/juego/${game.bggId}`}
                    className={styles.gameNameLink}
                    title={t("resena.viewAllReviews", { name: game.name })}
                  >
                    {game?.name || t("resena.gameFallback")}
                  </Link>
                ) : (
                  game?.name || t("resena.gameFallback")
                )}
                {game?.year ? (
                  <span className={styles.gameYear}> ({game.year})</span>
                ) : null}
              </span>
            </div>
            {post.rating != null && (
              <div
                className={styles.ratingBadge}
                aria-label={t("resena.ratingAria", { rating: post.rating })}
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
            <span className={styles.metaLine}>
              <span className={styles.metaTime}>
                {compartidaTimeAgo(post.createdAt)}
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
                      {t("resena.bgWatch")}
                    </Link>
                  </>
                ) : null}
              </span>
              <ItemCommunityTag communityId={post.community} />
            </span>
          </div>
          {isAuthor && (
            <div className={styles.menuWrap} ref={menuRef}>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={t("resena.options")}
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
                    {t("resena.edit")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={handleDelete}
                  >
                    {t("resena.delete")}
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
              placeholder={t("resena.titlePlaceholder")}
              maxLength={100}
            />
            {editGame ? (
              <div className={styles.editGameChip}>
                <span>🎲 {editGame.name}</span>
                <button type="button" onClick={() => setEditGame(null)}>
                  {t("resena.changeGame")}
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
              aria-label={t("resena.ratingGroupAria")}
            >
              {RATING_VALUES.map((n, i) => (
                <button
                  key={n}
                  type="button"
                  {...ratingGroup.getRadioProps(n, i)}
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
              extended
              placeholder={t("resena.bodyPlaceholder")}
              maxLength={20000}
            />
            <div className={styles.editActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                {t("resena.cancel")}
              </button>
              <button
                type="button"
                className={styles.btnSave}
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? t("resena.saving") : t("resena.save")}
              </button>
            </div>
          </div>
        ) : (
          <>
            {post.title && <h2 className={styles.title}>{post.title}</h2>}
            {clampBodyActive ? (
              <div className={styles.bodyClampWrap}>
                <div
                  className={styles.bodyClamp}
                  style={{
                    maxHeight: !showReadMore
                      ? "none"
                      : expanded
                        ? fullBodyHeight
                          ? `${fullBodyHeight}px`
                          : "none"
                        : `${COLLAPSED_BODY_PX}px`,
                  }}
                >
                  <div ref={bodyInnerRef}>
                    <RichTextContent
                      html={post.body}
                      extended
                      className={styles.body}
                    />
                  </div>
                  {showReadMore && !expanded && (
                    <div className={styles.bodyFade} aria-hidden="true" />
                  )}
                </div>
                {showReadMore && (
                  <button
                    type="button"
                    className={styles.readMoreBtn}
                    onClick={() => setExpanded((e) => !e)}
                    aria-expanded={expanded}
                  >
                    {expanded ? t("resena.readLess") : t("resena.readMore")}
                    <svg
                      className={`${styles.readMoreChevron} ${expanded ? styles.readMoreChevronUp : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <RichTextContent
                html={post.body}
                extended
                className={styles.body}
              />
            )}

            {lbImages.length > 0 && (
              <div className={styles.images}>
                {lbImages.map((img, i) => (
                  <button
                    key={img._id || i}
                    type="button"
                    className={styles.imageBtn}
                    onClick={() => setLightboxIndex(i)}
                    aria-label={t("resena.viewPhoto", { index: i + 1 })}
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
              aria-label={liked ? t("resena.removeLike") : t("resena.like")}
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
                {t("resena.comment", { count: commentCount })}
              </span>
            </button>
          </div>

          <div
            className={styles.shareGroup}
            onPointerEnter={primeShort}
            onPointerDown={primeShort}
            onFocusCapture={primeShort}
          >
            <a
              className={styles.shareBtn}
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(share.whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t("resena.shareWhatsapp")}
              aria-label={t("resena.shareWhatsapp")}
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
              title={t("resena.shareTelegram")}
              aria-label={t("resena.shareTelegram")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.08 13.63l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.834.931z" />
              </svg>
            </a>
            <button
              type="button"
              className={`${styles.shareBtn} ${copied ? styles.shareBtnCopied : ""}`}
              onClick={async () => {
                const u =
                  (await getShortUrl({
                    type: "compartida",
                    ref: post._id,
                    origin: window.location.origin,
                  })) || share.url;
                navigator.clipboard.writeText(u);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              title={copied ? t("resena.copied") : t("resena.copyLink")}
              aria-label={t("resena.copyLink")}
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
