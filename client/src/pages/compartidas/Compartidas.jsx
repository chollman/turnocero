import { useState, useEffect, useCallback, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import CompartidaCard from "./CompartidaCard";
import CompartidaSkeleton from "./CompartidaSkeleton";
import CreateCompartidaForm from "./CreateCompartidaForm";
import CompartidasSidebar from "./CompartidasSidebar";
import BgWatchHomeWidget from "./BgWatchHomeWidget";
import styles from "./Compartidas.module.css";

const INTERLEAVE_EVERY = 3;

// Quote of the week (interleaved widget). Static for now; future iteration can
// pull from a server endpoint. Kept short and tabletop-flavored.
const QUOTE = {
  text: "Lo mejor del juego de mesa no es ganar — es discutir 30 minutos por qué la madera vale más que la oveja.",
  authorName: "Pancho M.",
  game: "Catán",
};

function QuoteWidget() {
  return (
    <div className={`${styles.inlineWidget} ${styles.gold}`}>
      <div className={styles.widgetEyebrow}>
        <span className={styles.left}>◆ Frase de la semana</span>
      </div>
      <p className={styles.quoteText}>{QUOTE.text}</p>
      <div className={styles.quoteAttribution}>
        <span>
          — <strong>{QUOTE.authorName}</strong> · {QUOTE.game}
        </span>
      </div>
    </div>
  );
}

export default function Compartidas() {
  const { user } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  const [searchParams] = useSearchParams();
  const prefilledMesa = searchParams.get("mesa") || "";

  const [posts, setPosts] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(!!prefilledMesa);
  const [weekCount, setWeekCount] = useState(0);

  const loadFeed = useCallback(async (pageNum = 1, replace = true) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const { data } = await axios.get("/api/compartidas", {
        params: { page: pageNum, limit: 10 },
      });
      setPosts((prev) =>
        replace ? data.compartidas : [...prev, ...data.compartidas],
      );
      setTotalPages(data.pages);
      setPage(pageNum);
      if (typeof data.total === "number") setTotal(data.total);
      if (pageNum === 1 && data.featured) setFeatured(data.featured);
    } catch {
      /* silently ignore */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(1);
  }, [loadFeed]);

  const handleCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
    setShowCreate(false);
  };

  const handleDeleted = (id) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
    if (featured?._id === id) setFeatured(null);
  };

  const handleUpdated = (updated) => {
    setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    if (featured?._id === updated._id) setFeatured(updated);
  };

  const visiblePosts = posts.filter((p) => !featured || p._id !== featured._id);

  useEffect(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    setWeekCount(
      posts.filter((p) => new Date(p.createdAt).getTime() >= weekAgo).length,
    );
  }, [posts]);

  const userDisplay = user ? getUserDisplay(user) : null;
  const userFirstName =
    userDisplay?.name?.split(" ")[0] || userDisplay?.name || "vos";

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/compartidas`
      : "/compartidas";

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Compartidas – Turnocero 🎲</title>
        <meta
          name="description"
          content="Mirá las últimas compartidas de la comunidad de juegos de mesa."
        />
        <meta property="og:title" content="Compartidas – Turnocero 🎲" />
        <meta
          property="og:description"
          content="Mirá las últimas compartidas de la comunidad de juegos de mesa."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="Compartidas – Turnocero 🎲" />
        <meta
          name="twitter:description"
          content="Mirá las últimas compartidas de la comunidad de juegos de mesa."
        />
      </Helmet>

      <div className={styles.layout}>
        <div className={styles.feedCol}>
          {/* ── Page header (diario) — pixel-accurate to handoff. ── */}
          <header className={styles.pageHead}>
            <div className={styles.heroBlock}>
              <span className={styles.pageEyebrow}>
                Comunidad · diario compartido
              </span>
              <h1 className={styles.pageTitle}>
                Lo que <em>jugamos</em> esta semana.
              </h1>
              <p className={styles.heroSub}>
                Compartí tus partidas, fotos y momentos. Esto es la bitácora
                abierta de la comunidad — un pedacito de cada mesa, para que no
                se pierda nada.
              </p>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatLabel}>Compartidas</span>
                <span
                  className={`${styles.heroStatVal} ${styles.heroStatValAccent}`}
                >
                  {total || visiblePosts.length + (featured ? 1 : 0)}
                </span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatLabel}>Esta semana</span>
                <span className={styles.heroStatVal}>{weekCount}</span>
              </div>
            </div>
          </header>

          {/* ── Composer one-liner ── */}
          {user && !showCreate && (
            <div className={styles.composer}>
              <div className={styles.composerRow}>
                <Avatar user={user} size="md" />
                <button
                  className={styles.composerTrigger}
                  onClick={() => setShowCreate(true)}
                >
                  ¿Qué jugaste hoy, {userFirstName}?
                </button>
                <div className={styles.composerActions}>
                  <button
                    className={styles.composerIconBtn}
                    onClick={() => setShowCreate(true)}
                    aria-label="Subir foto"
                    title="Subir foto"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </button>
                  <button
                    className={styles.composerIconBtn}
                    onClick={() => setShowCreate(true)}
                    aria-label="Enlazar mesa"
                    title="Enlazar mesa"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="16" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                      <circle cx="8" cy="16" r="1.2" fill="currentColor" />
                      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── BG Watch widget (mobile only; sidebar already shows it on desktop) ── */}
          {user && bgwatchEnabled && (
            <div className={styles.mobileWidgetSlot}>
              <BgWatchHomeWidget user={user} dismissible />
            </div>
          )}

          {/* ── Create form ── */}
          {showCreate && (
            <CreateCompartidaForm
              onCreated={handleCreated}
              onCancel={() => setShowCreate(false)}
              prefilledTableId={prefilledMesa}
            />
          )}

          {/* ── Feed ── */}
          {loading ? (
            <div className={styles.feed}>
              <CompartidaSkeleton />
              <CompartidaSkeleton />
              <CompartidaSkeleton />
            </div>
          ) : posts.length === 0 && !featured ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🎲</span>
              <p className={styles.emptyTitle}>No hay compartidas todavía</p>
              <p className={styles.emptySub}>
                {user
                  ? "¡Sé el primero en compartir tu partida!"
                  : "Registrate para compartir tus partidas."}
              </p>
              {user && (
                <button
                  className={styles.emptyBtn}
                  onClick={() => setShowCreate(true)}
                >
                  + Publicar compartida
                </button>
              )}
            </div>
          ) : (
            <div className={styles.feed}>
              {featured && (
                <CompartidaCard
                  key={`featured-${featured._id}`}
                  post={featured}
                  featured
                  onDeleted={handleDeleted}
                  onUpdated={handleUpdated}
                />
              )}
              {visiblePosts.map((post, i) => (
                <Fragment key={post._id}>
                  <CompartidaCard
                    post={post}
                    index={featured ? i + 1 : i}
                    onDeleted={handleDeleted}
                    onUpdated={handleUpdated}
                  />
                  {/* Interleave a quote widget every Nth post — mobile design uses these
                      between cards so the feed has more rhythm. */}
                  {i + 1 === INTERLEAVE_EVERY && <QuoteWidget />}
                </Fragment>
              ))}

              {page < totalPages && (
                <button
                  className={styles.loadMoreBtn}
                  onClick={() => loadFeed(page + 1, false)}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Cargando…" : "Ver más compartidas"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.asideCol}>
          <CompartidasSidebar />
        </div>
      </div>
    </div>
  );
}
