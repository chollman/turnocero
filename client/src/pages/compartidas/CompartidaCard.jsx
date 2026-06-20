import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { API } from "../../api/endpoints";
import GameTile from "../../components/shared/GameTile";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import LikersModal from "../../components/shared/LikersModal";
import Avatar from "../../components/shared/Avatar";
import ItemCommunityTag from "../../components/shared/ItemCommunityTag";
import { getUserDisplay } from "../../utils/userDisplay";
import { getLocationDisplay } from "../../utils/location";
import { buildCompartidaShare } from "../../utils/share";
import { useShortLink } from "../../hooks/useShortLink";
import useDialogA11y from "../../hooks/useDialogA11y";
import { getShortUrl } from "../../utils/shortlink";
import CompartidaComments from "./CompartidaComments";
import { useCompartidaLike } from "./useCompartidaLike";
import Scorecard from "../bg-watch/Scorecard";
import { playResultToScorecardProps } from "../bg-watch/playResultToScorecard";
import styles from "./CompartidaCard.module.css";

// Returns a fully formed label (incl. its own "hace"/"el" prefix), so callers
// must NOT prepend "hace" — recent posts read "hace 3h" and older ones spell
// out the full date ("el 15 de enero"), adding the year only when it's from a
// previous year ("el 15 de enero de 2025").
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

// Wraps the avatar/name in a link to the author's public profile, unless the
// author was deleted (then there's nothing to link to). stopPropagation keeps
// the click from bubbling up to any card-level navigation.
function ProfileLink({ to, className, label, children }) {
  if (!to) return children;
  return (
    <Link
      to={to}
      className={className}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
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

const LightboxChevron = ({ dir = "left" }) => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {dir === "left" ? (
      <polyline points="15 18 9 12 15 6" />
    ) : (
      <polyline points="9 18 15 12 9 6" />
    )}
  </svg>
);

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

// Contador de likes del post. Cuando hay al menos un like, el número es
// clickeable (role=button) y abre el modal "¿a quién le gustó?". Vive DENTRO
// del botón de toggle del corazón, así que stopPropagation evita togglear el
// like al clickear el número (un <button> anidado sería HTML inválido).
function LikeCount({ count, onShow, className }) {
  if (count > 0) {
    return (
      <span
        className={className}
        role="button"
        tabIndex={0}
        aria-label="Ver a quién le gustó"
        onClick={(e) => {
          e.stopPropagation();
          onShow();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            onShow();
          }
        }}
      >
        {count}
      </span>
    );
  }
  return <span>{count}</span>;
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
  const eventosEnabled = isSectionEnabled("eventos");
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
  const [editPrivacy, setEditPrivacy] = useState(post.privacy);
  // Lightbox: trackea el índice (no la url) para navegar prev/next.
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const menuRef = useRef(null);

  const authorInfo = getUserDisplay(post.author);
  const authorProfilePath =
    !authorInfo.isDeleted && authorInfo._id
      ? `/usuarios/${authorInfo._id}`
      : null;
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
  const closeLightbox = () => setLightboxIndex(null);
  const goPrev = () =>
    setLightboxIndex((i) =>
      i === null ? i : (i - 1 + lbImages.length) % lbImages.length,
    );
  const goNext = () =>
    setLightboxIndex((i) => (i === null ? i : (i + 1) % lbImages.length));

  // Teclado: ←/→ navegan, Esc cierra. Solo mientras el lightbox está abierto.
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, lbImages.length]);

  // Check síncrono de auth antes del toggle async — el modal de login
  // debe aparecer en el mismo tick del click, no esperar la Promise.
  const handleLike = () => {
    if (!user) {
      setLoginPrompt("Iniciá sesión para dar like a esta compartida.");
      return;
    }
    toggleLike();
  };

  // El componente CompartidaComments owna su propio fetch/state. Acá solo
  // toggleamos visibilidad — el componente fetchea cuando se monta.
  const toggleComments = () => setShowComments((s) => !s);

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta compartida?")) return;
    try {
      await axios.delete(API.compartidas.DETAIL(post._id));
      onDeleted?.(post._id);
    } catch {
      /* silently ignore */
    }
  };

  const handleSaveEdit = async () => {
    try {
      const { data } = await axios.put(API.compartidas.DETAIL(post._id), {
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
  const evento = eventosEnabled ? post.linkedEvento : null;
  const bodyLong = post.body.length > 220;
  const displayBody =
    expanded || !bodyLong ? post.body : `${post.body.slice(0, 220)}…`;
  const authorName = authorInfo.name;
  const privacyLabel = PRIVACY_LABELS[post.privacy];
  const imageCount = post.images.length;
  // Widget de resultados (juntada compartida desde el flujo de carga de partida).
  // Render-only; null en compartidas viejas / reseñas (sin `playResult`).
  const scProps = post.playResult
    ? playResultToScorecardProps(post.playResult)
    : null;
  // Grilla combinada scorecard + fotos del layout normal: el scorecard (si
  // existe) es la primera tile y las fotos lo siguen, 2 por fila. Con cantidad
  // IMPAR de tiles la última se centra ocupando el ancho completo; con UNA sola
  // tile (scorecard solo, o una única foto) va centrada en columna única.
  const showScorecard = !editing && !!scProps;
  const mediaTiles = (showScorecard ? 1 : 0) + imageCount;
  const mediaSingle = mediaTiles === 1;
  const mediaOdd = mediaTiles > 1 && mediaTiles % 2 === 1;
  const mediaGridClass = [
    styles.mediaGrid,
    mediaSingle && styles.mediaGridSingle,
    mediaOdd && styles.mediaGridOdd,
  ]
    .filter(Boolean)
    .join(" ");
  // Short link transparente: hasta que resuelve se usa el deeplink largo; el
  // `prime` se dispara al interactuar con el grupo de compartir (ver abajo),
  // así no minteamos un código por cada tarjeta del feed al montar.
  const { shortUrl, prime: primeShort } = useShortLink({
    type: "compartida",
    ref: post._id,
  });
  const share = buildCompartidaShare(
    post,
    typeof window !== "undefined" ? window.location.origin : "",
    shortUrl || undefined,
  );
  const pullQuote = featured
    ? post.body.slice(0, 180) + (post.body.length > 180 ? "…" : "")
    : null;

  // Lightbox compartido entre el layout normal y el featured. Se renderiza con
  // portal a document.body para escapar de cualquier stacking context del card.
  const lightboxPortal =
    lightboxIndex !== null && lbImages[lightboxIndex]
      ? createPortal(
          <div
            className={styles.lightbox}
            onClick={closeLightbox}
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label="Foto ampliada"
            tabIndex={-1}
          >
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
            {lbImages.length > 1 && (
              <button
                type="button"
                className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Imagen anterior"
              >
                <LightboxChevron dir="left" />
              </button>
            )}
            <img
              src={lbImages[lightboxIndex].url}
              alt=""
              className={styles.lightboxImg}
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
            />
            {lbImages.length > 1 && (
              <button
                type="button"
                className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Imagen siguiente"
              >
                <LightboxChevron dir="right" />
              </button>
            )}
            {lbImages.length > 1 && (
              <span className={styles.lightboxCounter}>
                {lightboxIndex + 1} / {lbImages.length}
              </span>
            )}
          </div>,
          document.body,
        )
      : null;

  // Linked mesa/evento tickets — shared between the normal and the featured
  // (compartida del día) layouts so the linked mesa/evento is clickable in
  // both (the featured card used to show only a non-clickable text pill).
  const linkedTickets = (
    <>
      {table && (
        <div className={styles.mesaTicket}>
          <div className={styles.mesaTile}>
            <GameTile
              game={table.boardGame}
              seed={table._id?.charCodeAt(0) || 42}
              size={38}
              imageUrl={table.bggThumbnail}
            />
          </div>
          <div className={styles.mesaInfo}>
            <span className={styles.mesaLabel}>
              <Meeple />
              Mesa enlazada
            </span>
            <span className={styles.mesaGame}>{table.boardGame}</span>
            <span className={styles.mesaMeta}>
              {formatTableDate(table.date)}
              {(() => {
                const loc = getLocationDisplay(table.location, "city");
                return loc ? ` · ${loc}` : "";
              })()}
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

      {evento && (
        <div className={styles.mesaTicket}>
          <div className={styles.mesaTile} aria-hidden="true">
            <span style={{ fontSize: 22 }}>🎟️</span>
          </div>
          <div className={styles.mesaInfo}>
            <span className={styles.mesaLabel}>
              <Meeple />
              Evento enlazado
            </span>
            <span className={styles.mesaGame}>{evento.title}</span>
            <span className={styles.mesaMeta}>
              {formatTableDate(evento.eventDate)}
              {evento.location?.texto ? ` · ${evento.location.texto}` : ""}
            </span>
          </div>
          <Link to={`/eventos/${evento._id}`} className={styles.mesaCta}>
            Ver evento
          </Link>
        </div>
      )}
    </>
  );

  // Bolder linked-mesa/evento design reserved for the featured (compartida del
  // día) layout: a full-width "join the table" CTA card with the game art as a
  // blurred backdrop, a large cover, big title, availability badge and a strong
  // primary CTA. The whole card is the link.
  const ctaArrow = (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );

  const featuredLinkedTickets = (
    <>
      {table && (
        <Link
          to={`/mesas/${table._id}`}
          className={styles.featuredMesa}
          aria-label={`${tableOpen ? "Sumate a la mesa" : "Ver la mesa"} de ${table.boardGame}`}
        >
          {table.bggThumbnail && (
            <div
              className={styles.featuredMesaBg}
              style={{ backgroundImage: `url(${table.bggThumbnail})` }}
              aria-hidden="true"
            />
          )}
          <div className={styles.featuredMesaCover}>
            <GameTile
              game={table.boardGame}
              seed={table._id?.charCodeAt(0) || 42}
              size={72}
              imageUrl={table.bggThumbnail}
            />
          </div>
          <div className={styles.featuredMesaBody}>
            <span className={styles.featuredMesaLabel}>
              <Meeple />
              La mesa de esta compartida
            </span>
            <span className={styles.featuredMesaGame}>{table.boardGame}</span>
            <span className={styles.featuredMesaMeta}>
              <span>
                {formatTableDate(table.date)}
                {(() => {
                  const loc = getLocationDisplay(table.location, "city");
                  return loc ? ` · ${loc}` : "";
                })()}
              </span>
              {tableOpen && (
                <span className={styles.featuredMesaSeats}>
                  {tableSeats}{" "}
                  {tableSeats === 1 ? "lugar libre" : "lugares libres"}
                </span>
              )}
            </span>
          </div>
          <span
            className={`${styles.featuredMesaCta} ${tableOpen ? styles.featuredMesaCtaOpen : ""}`}
          >
            {tableOpen ? "Sumate" : "Ver mesa"}
            {ctaArrow}
          </span>
        </Link>
      )}

      {evento && (
        <Link
          to={`/eventos/${evento._id}`}
          className={styles.featuredMesa}
          aria-label={`Ver el evento ${evento.title}`}
        >
          {evento.image?.url && (
            <div
              className={styles.featuredMesaBg}
              style={{ backgroundImage: `url(${evento.image.url})` }}
              aria-hidden="true"
            />
          )}
          <div className={styles.featuredMesaCover}>
            {evento.image?.url ? (
              <img src={evento.image.url} alt="" loading="lazy" />
            ) : (
              <span style={{ fontSize: 30 }} aria-hidden="true">
                🎟️
              </span>
            )}
          </div>
          <div className={styles.featuredMesaBody}>
            <span className={styles.featuredMesaLabel}>
              <Meeple />
              El evento de esta compartida
            </span>
            <span className={styles.featuredMesaGame}>{evento.title}</span>
            <span className={styles.featuredMesaMeta}>
              <span>
                {formatTableDate(evento.eventDate)}
                {evento.location?.texto ? ` · ${evento.location.texto}` : ""}
              </span>
            </span>
          </div>
          <span className={styles.featuredMesaCta}>
            Ver evento
            {ctaArrow}
          </span>
        </Link>
      )}
    </>
  );

  // ── Featured broadside (compartida del día) ──
  // Renders the desktop-handoff broadside layout: eyebrow + title + body
  // + integrated meta row (game · likes · comments) on the left, big
  // polaroid on the right. Hides the normal post header, mesa ticket,
  // footer reactions/share row, and inline comments — clicking the card
  // navigates to the full post for the rest.
  if (featured && !editing) {
    // ── Shared featured pieces ──
    // Composed in two arrangements depending on whether the compartida carries
    // a scorecard. With a scorecard the header (eyebrow + title + subtitle) is
    // lifted to full width, then the games band, then a scorecard | photos
    // grid — so the games sit below the title/subtitle and above both the
    // scorecard and the photos. Without a scorecard the classic broadside is
    // kept (text left, photo right).
    const featuredEyebrow = (
      <div className={styles.broadsideEyebrow}>
        <ProfileLink
          to={authorProfilePath}
          className={styles.avatarLink}
          label={`Ver perfil de ${authorName}`}
        >
          <Avatar user={post.author} size="xs" />
        </ProfileLink>
        <span>
          Por{" "}
          <ProfileLink to={authorProfilePath} className={styles.authorNameLink}>
            <strong>{authorName}</strong>
          </ProfileLink>{" "}
          · {timeAgo(post.createdAt)}
        </span>
        {!authorInfo.isDeleted && (
          <AuthorBgWatchLink author={post.author} enabled={bgwatchEnabled} />
        )}
      </div>
    );

    const featuredTitle = post.title ? (
      <h2 className={styles.title}>{post.title}</h2>
    ) : null;
    const featuredSubtitle = post.body ? (
      <p className={styles.pullQuote}>{pullQuote}</p>
    ) : null;

    // Con scorecard presente, el scorecard ya identifica el juego — ocultamos
    // las game tags para no duplicar.
    const featuredGameTags =
      !showScorecard && post.boardGames?.length > 0 ? (
        <div className={`${styles.gameTags} ${styles.gameTagsFeatured}`}>
          {post.boardGames.map((g) => (
            <span key={g.bggId} className={styles.gameTag}>
              {g.thumbnail || g.image ? (
                <img
                  src={g.thumbnail || g.image}
                  alt=""
                  loading="lazy"
                  className={styles.gameTagImg}
                />
              ) : (
                <span className={styles.gameTagImg} aria-hidden="true">
                  🎲
                </span>
              )}
              <span className={styles.gameTagInfo}>
                <span className={styles.gameTagName}>{g.name}</span>
                {g.year && <span className={styles.gameTagYear}>{g.year}</span>}
              </span>
            </span>
          ))}
        </div>
      ) : null;

    const featuredScorecard = scProps ? (
      <div className={styles.playResult}>
        <Scorecard {...scProps} bgwatchEnabled={bgwatchEnabled} />
      </div>
    ) : null;

    const featuredMeta = (
      <div className={styles.broadsideMeta}>
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
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
          <LikeCount
            count={likeCount}
            onShow={() => setShowLikers(true)}
            className={styles.likeCountClickable}
          />
        </button>
        <button
          type="button"
          className={`${styles.broadsideStat} ${showComments ? styles.broadsideStatActive : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleComments();
          }}
          aria-label={showComments ? "Ocultar comentarios" : "Ver comentarios"}
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
    );

    const featuredPhotos = (
      <div
        className={`${styles.photos} ${styles.photosFeatured} ${
          showScorecard ? styles.photosFeaturedStacked : ""
        }`}
      >
        <button
          type="button"
          className={styles.photoBtn}
          onClick={() => post.images[0]?.url && setLightboxIndex(0)}
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
        {imageCount > 1 && (
          <div className={styles.featuredThumbs}>
            {post.images.slice(1).map((img, i) => (
              <button
                key={img._id || i}
                type="button"
                className={styles.featuredThumb}
                onClick={() => img.url && setLightboxIndex(i + 1)}
                aria-label={`Ver foto ${i + 2}`}
              >
                <img src={img.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    );

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
          <div className={styles.featuredBadge}>
            <Meeple />
            Compartida del día
          </div>

          {showScorecard ? (
            <>
              <div className={styles.broadsideHeader}>
                {featuredEyebrow}
                {featuredTitle}
                {featuredSubtitle}
              </div>

              {featuredGameTags}

              <div className={styles.broadsideGrid}>
                <div className={styles.broadsideMain}>
                  {featuredScorecard}
                  {featuredMeta}
                </div>
                {featuredPhotos}
              </div>
            </>
          ) : (
            <div className={styles.broadsideGrid}>
              <div className={styles.broadsideMain}>
                {featuredEyebrow}
                {featuredTitle}
                {featuredSubtitle}
                {featuredGameTags}
                {featuredMeta}
              </div>
              {featuredPhotos}
            </div>
          )}

          {featuredLinkedTickets}

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
        <LikersModal
          isOpen={showLikers}
          onClose={() => setShowLikers(false)}
          title="A quién le gustó"
          fetchUrl={showLikers ? API.compartidas.LIKES(post._id) : null}
        />
      </>
    );
  }

  const upperSections = (
    <>
      {/* ── Header ── */}
      <div className={styles.header}>
        <ProfileLink
          to={authorProfilePath}
          className={styles.avatarLink}
          label={`Ver perfil de ${authorName}`}
        >
          <Avatar user={post.author} size="md" />
        </ProfileLink>
        <div className={styles.authorMeta}>
          <div className={styles.authorNameRow}>
            <ProfileLink
              to={authorProfilePath}
              className={styles.authorNameLink}
            >
              <span className={styles.authorName}>{authorName}</span>
            </ProfileLink>
            {!authorInfo.isDeleted && (
              <AuthorBgWatchLink
                author={post.author}
                enabled={bgwatchEnabled}
              />
            )}
          </div>
          <div className={styles.metaLine}>
            <span className={styles.metaTime}>
              <Meeple />
              {timeAgo(post.createdAt)}
            </span>
            <ItemCommunityTag communityId={post.community} />
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
            placeholder="¿Qué tenés ganas de compartir hoy?"
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

      {/* ── Juegos jugados (juntada) ──
          Con scorecard presente, el scorecard ya identifica el juego —
          ocultamos las game tags para no duplicar. */}
      {!editing && !showScorecard && post.boardGames?.length > 0 && (
        <div className={styles.gameTags}>
          {post.boardGames.map((g) => (
            <span key={g.bggId} className={styles.gameTag}>
              {g.thumbnail || g.image ? (
                <img
                  src={g.thumbnail || g.image}
                  alt=""
                  loading="lazy"
                  className={styles.gameTagImg}
                />
              ) : (
                <span className={styles.gameTagImg} aria-hidden="true">
                  🎲
                </span>
              )}
              <span className={styles.gameTagInfo}>
                <span className={styles.gameTagName}>{g.name}</span>
                {g.year && <span className={styles.gameTagYear}>{g.year}</span>}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ── Resultados de la partida + fotos (juntada compartida) ──
          Grilla combinada: el scorecard (si existe) es la primera tile y las
          fotos lo siguen, 2 por fila. Con cantidad impar de tiles la última se
          centra; con una sola tile va centrada en columna única. El scorecard
          se oculta en modo edición (las fotos siguen visibles). */}
      {(showScorecard || imageCount > 0) && (
        <div className={mediaGridClass}>
          {showScorecard && (
            <div className={styles.mediaScorecard}>
              <Scorecard {...scProps} bgwatchEnabled={bgwatchEnabled} />
            </div>
          )}
          {post.images.map((img, i) => (
            <button
              key={img._id || i}
              className={styles.photoBtn}
              onClick={() => setLightboxIndex(i)}
            >
              <Polaroid
                image={img}
                index={i}
                count={imageCount}
                withTape={i === 0 || imageCount > 1}
              />
            </button>
          ))}
        </div>
      )}

      {linkedTickets}
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
          <div className={styles.featuredBadge}>
            <Meeple />
            Compartida del día
          </div>
        )}

        {upperSections}

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <div className={styles.reactionGroup}>
            <button
              className={`${styles.reactionBtn} ${liked ? styles.reactionBtnLiked : ""}`}
              onClick={handleLike}
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
              <LikeCount
                count={likeCount}
                onShow={() => setShowLikers(true)}
                className={styles.likeCountClickable}
              />
            </button>
            <button
              className={styles.reactionBtn}
              onClick={toggleComments}
              aria-label={showComments ? "Ocultar comentarios" : "Ver comentarios"}
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

          <div
            className={styles.shareGroup}
            onPointerEnter={primeShort}
            onPointerDown={primeShort}
            onFocusCapture={primeShort}
          >
            {/* WhatsApp */}
            <a
              className={styles.shareBtn}
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(share.whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir en WhatsApp"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.535 5.862L.057 23.886a.5.5 0 0 0 .612.612l6.05-1.48A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.65-.51-5.166-1.396l-.37-.22-3.827.934.952-3.782-.243-.388A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
            </a>

            {/* Telegram — url y caption por separado para no duplicar el deeplink */}
            <a
              className={styles.shareBtn}
              href={`https://t.me/share/url?url=${encodeURIComponent(share.url)}&text=${encodeURIComponent(share.caption)}`}
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
          <CompartidaComments
            compartidaId={post._id}
            user={user}
            canDeleteOthers={isAuthor || !!user?.isAdmin}
            onRequireLogin={setLoginPrompt}
            onCountChange={setCommentCount}
          />
        )}
      </article>

      {/* ── Lightbox ── */}
      {lightboxPortal}
      <LikersModal
        isOpen={showLikers}
        onClose={() => setShowLikers(false)}
        title="A quién le gustó"
        fetchUrl={showLikers ? API.compartidas.LIKES(post._id) : null}
      />
    </>
  );
}
