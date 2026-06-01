import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import CompartidaCard from "./CompartidaCard";
import ResenaCard from "./ResenaCard";
import CompartidaSkeleton from "./CompartidaSkeleton";
import CreateCompartidaForm from "./CreateCompartidaForm";
import CompartidasSidebar from "./CompartidasSidebar";
import BgWatchHomeWidget from "./BgWatchHomeWidget";
import styles from "./Compartidas.module.css";

const TABS = [
  { value: "todo", label: "Todo" },
  { value: "resena", label: "Reseñas" },
  { value: "juntada", label: "Juntadas" },
];

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
        <span className={styles.left}><Meeple />Frase de la semana</span>
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
  const prefilledEvento = searchParams.get("evento") || "";

  const [posts, setPosts] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Inicializar pestaña/búsqueda desde la URL para soportar deep-links
  // compartibles (?tab=resena&q=catan).
  const [tab, setTab] = useState(() => {
    const t = searchParams.get("tab");
    return ["resena", "juntada"].includes(t) ? t : "todo";
  });
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const debouncedQuery = useDebouncedValue(query, 300);

  const categoryParam = tab === "todo" ? undefined : tab;
  const qParam = debouncedQuery.trim();
  const isFiltered = Boolean(categoryParam) || qParam.length > 0;

  // Espejar pestaña + búsqueda en la URL (replaceState → no ensucia el
  // historial con cada tecla). No usamos setSearchParams porque no es
  // reactivo y se desincroniza del estado local (ver memoria del proyecto).
  // Preservamos otros params (mesa/evento) leyéndolos de la URL viva.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (tab === "todo") params.delete("tab");
    else params.set("tab", tab);
    if (qParam) params.set("q", qParam);
    else params.delete("q");
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(window.history.state, "", url);
  }, [tab, qParam]);
  const [showCreate, setShowCreate] = useState(
    !!prefilledMesa || !!prefilledEvento,
  );
  // Fotos elegidas desde el "Subir foto" del composer — se siembran en el form.
  const [composerFiles, setComposerFiles] = useState(null);
  const composerFileRef = useRef(null);
  const [weekCount, setWeekCount] = useState(0);

  const closeCreate = () => {
    setShowCreate(false);
    setComposerFiles(null);
  };

  const handleComposerPhoto = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setComposerFiles(files);
    setShowCreate(true);
  };

  const loadFeed = useCallback(
    async (pageNum = 1, replace = true, opts = {}) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = { page: pageNum, limit: 10 };
        if (opts.category) params.category = opts.category;
        if (opts.q) params.q = opts.q;
        const { data } = await axios.get(API.compartidas.LIST, { params });
        setPosts((prev) =>
          replace ? data.compartidas : [...prev, ...data.compartidas],
        );
        setTotalPages(data.pages);
        setPage(pageNum);
        if (typeof data.total === "number") setTotal(data.total);
        if (pageNum === 1) {
          setFeatured(data.featured || null);
        }
      } catch {
        /* silently ignore */
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Recargar página 1 al cambiar de pestaña o búsqueda.
  useEffect(() => {
    loadFeed(1, true, { category: categoryParam, q: qParam });
  }, [loadFeed, categoryParam, qParam]);

  const handleCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
    closeCreate();
  };

  const handleDeleted = (id) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
    if (featured?._id === id) setFeatured(null);
  };

  const handleUpdated = (updated) => {
    setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    if (featured?._id === updated._id) setFeatured(updated);
  };

  // Routing del renderer: reseña → ResenaCard (editorial); juntada → CompartidaCard.
  const renderCard = (post, extra = {}) =>
    post.category === "resena" ? (
      <ResenaCard
        post={post}
        onDeleted={handleDeleted}
        onUpdated={handleUpdated}
        {...extra}
      />
    ) : (
      <CompartidaCard
        post={post}
        onDeleted={handleDeleted}
        onUpdated={handleUpdated}
        {...extra}
      />
    );

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
        <title>Compartidas – TurnoCero 🎲</title>
        <meta
          name="description"
          content="Mirá las últimas compartidas de la comunidad de juegos de mesa."
        />
        <meta property="og:title" content="Compartidas – TurnoCero 🎲" />
        <meta
          property="og:description"
          content="Mirá las últimas compartidas de la comunidad de juegos de mesa."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="Compartidas – TurnoCero 🎲" />
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
                    onClick={() => composerFileRef.current?.click()}
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
                  <input
                    ref={composerFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    hidden
                    aria-hidden="true"
                    onChange={handleComposerPhoto}
                  />
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
              onCancel={closeCreate}
              prefilledTableId={prefilledMesa}
              prefilledEventoId={prefilledEvento}
              initialFiles={composerFiles}
            />
          )}

          {/* ── Tabs + buscador ── */}
          <div className={styles.controls}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Filtrar compartidas"
            >
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  className={`${styles.tab} ${tab === t.value ? styles.tabActive : ""}`}
                  onClick={() => setTab(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className={styles.searchWrap}>
              <svg
                className={styles.searchIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className={styles.search}
                type="search"
                placeholder="Buscar por título o juego…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar compartidas"
              />
            </div>
          </div>

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
              <p className={styles.emptyTitle}>
                {isFiltered
                  ? "No hay compartidas que coincidan"
                  : "No hay compartidas todavía"}
              </p>
              <p className={styles.emptySub}>
                {isFiltered
                  ? "Probá con otro filtro o búsqueda."
                  : user
                    ? "¡Sé el primero en compartir tu partida!"
                    : "Registrate para compartir tus partidas."}
              </p>
              {user && !isFiltered && (
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
              {featured && renderCard(featured, { featured: true })}
              {visiblePosts.map((post, i) => (
                <Fragment key={post._id}>
                  {renderCard(post, { index: featured ? i + 1 : i })}
                  {/* Interleave a quote widget every Nth post — mobile design uses these
                      between cards so the feed has more rhythm. */}
                  {!isFiltered && i + 1 === INTERLEAVE_EVERY && <QuoteWidget />}
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
