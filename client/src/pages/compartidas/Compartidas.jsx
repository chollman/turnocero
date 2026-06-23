import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import EmptyState from "../../components/shared/EmptyState";
import { ArtCompartida, ArtSearch } from "../../components/shared/EmptyArt";
import { GhostPolaroids } from "../../components/shared/EmptyGhosts";
import { getUserDisplay } from "../../utils/userDisplay";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { randomCompartidaQuote } from "../../utils/compartidaQuotes";
import CompartidaCard from "./CompartidaCard";
import ResenaCard from "./ResenaCard";
import CompartidaSkeleton from "./CompartidaSkeleton";
import CreateCompartidaForm from "./CreateCompartidaForm";
import CompartidasSidebar from "./CompartidasSidebar";
import BgWatchHomeWidget from "./BgWatchHomeWidget";
import GuestJoinBanner from "../../components/shared/GuestJoinBanner";
import styles from "./Compartidas.module.css";

const TAB_VALUES = ["todo", "resena", "juntada"];

const INTERLEAVE_EVERY = 3;

// Frase intercalada en el feed. Se elige una al azar por visita a la sección
// (ver utils/compartidaQuotes.js). Fallback de ritmo cuando la sección Mesas
// está apagada (sin /mesas adónde mandar, el CTA no aplica).
function QuoteWidget({ text }) {
  const { t } = useTranslation("compartidas");
  return (
    <div className={`${styles.inlineWidget} ${styles.gold}`}>
      <div className={styles.widgetEyebrow}>
        <span className={styles.left}>
          <Meeple />
          {t("feed.quoteEyebrow")}
        </span>
      </div>
      <p className={styles.quoteText}>{text}</p>
    </div>
  );
}

// CTA contextual intercalado en el feed: empuja de "leer compartidas" a "jugar"
// (conversión compartida → mesa). Reemplaza a la frase decorativa, que no
// convertía. /mesas es navegable sin login, así que sirve a guests y logueados.
function MesasCta() {
  const { t } = useTranslation("compartidas");
  return (
    <Link to="/mesas" className={`${styles.inlineWidget} ${styles.mesasCta}`}>
      <div className={styles.widgetEyebrow}>
        <span className={styles.left}>
          <Meeple />
          {t("feed.mesasCtaEyebrow")}
        </span>
      </div>
      <p className={styles.mesasCtaText}>{t("feed.mesasCtaText")}</p>
      <span className={styles.mesasCtaBtn}>{t("feed.mesasCtaBtn")}</span>
    </Link>
  );
}

const TAB_LABEL_KEYS = {
  todo: "feed.tabAll",
  resena: "feed.tabResena",
  juntada: "feed.tabJuntada",
};

export default function Compartidas() {
  const { t } = useTranslation("compartidas");
  const { user } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const brandName = useBrandName();
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  const mesasEnabled = isSectionEnabled("mesas");
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
  // Distingue "feed vacío" de "falló la carga" — sin esto, un error de red
  // mostraba el empty state como si no hubiera compartidas.
  const [error, setError] = useState(false);
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
  // Stats GLOBALES del hero (total + últimos 7 días), servidas por el backend
  // y decoupladas del feed: NO cambian con la pestaña/búsqueda activa ni
  // dependen de cuántos posts haya cargado el scroll.
  const [stats, setStats] = useState(null);
  // Frase al azar, fijada una vez por visita (montaje) a la sección.
  const [quote] = useState(randomCompartidaQuote);

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
      if (pageNum === 1) {
        setLoading(true);
        setError(false);
      } else setLoadingMore(true);
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
        // La paginación (load-more) falla en silencio: el feed ya cargado sigue
        // usable. Un error en la primera página sí se reporta para no confundir
        // "falló" con "vacío".
        if (pageNum === 1) setError(true);
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

  // Stats globales del hero — una sola vez al montar.
  useEffect(() => {
    const ac = new AbortController();
    axios
      .get(API.compartidas.STATS, { signal: ac.signal })
      .then(({ data }) => {
        if (!ac.signal.aborted) setStats(data);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const userDisplay = user ? getUserDisplay(user) : null;
  const userFirstName =
    userDisplay?.name?.split(" ")[0] ||
    userDisplay?.name ||
    t("feed.youFallback");

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/compartidas`
      : "/compartidas";

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{t("feed.metaTitle", { brand: brandName })}</title>
        <meta name="description" content={t("feed.metaDescription")} />
        <meta property="og:title" content={t("feed.ogTitle")} />
        <meta property="og:description" content={t("feed.metaDescription")} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={t("feed.ogTitle")} />
        <meta name="twitter:description" content={t("feed.metaDescription")} />
      </Helmet>

      <div className={styles.layout}>
        <div className={styles.feedCol}>
          {/* ── Page header (diario) — pixel-accurate to handoff. ── */}
          <header className={styles.pageHead}>
            <div className={styles.heroBlock}>
              <span className={styles.pageEyebrow}>
                {t("feed.pageEyebrow")}
              </span>
              <h1 className={styles.pageTitle}>
                <Trans
                  i18nKey="compartidas:feedTitle.main"
                  components={{ em: <em /> }}
                />
              </h1>
              <p className={styles.heroSub}>{t("feed.heroSub")}</p>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatLabel}>
                  {t("feed.heroStatCompartidas")}
                </span>
                <span
                  className={`${styles.heroStatVal} ${styles.heroStatValAccent}`}
                >
                  {stats?.total ??
                    total ??
                    visiblePosts.length + (featured ? 1 : 0)}
                </span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatLabel}>
                  {t("feed.heroStatWeek")}
                </span>
                <span className={styles.heroStatVal}>{stats?.week ?? 0}</span>
              </div>
            </div>
          </header>

          {/* ── Banda de adquisición (solo guests; se auto-oculta logueado) ── */}
          <GuestJoinBanner />

          {/* ── BG Watch widget (mobile only; sidebar already shows it on desktop).
               Va ARRIBA del composer para que sea lo primero que ve el usuario. ── */}
          {user && bgwatchEnabled && (
            <div className={styles.mobileWidgetSlot}>
              <BgWatchHomeWidget user={user} dismissible />
            </div>
          )}

          {/* ── Composer one-liner ── */}
          {user && !showCreate && (
            <div className={styles.composer}>
              <div className={styles.composerRow}>
                <Avatar user={user} size="md" />
                <button
                  className={styles.composerTrigger}
                  onClick={() => setShowCreate(true)}
                >
                  {t("feed.composerPrompt", { name: userFirstName })}
                </button>
                <div className={styles.composerActions}>
                  <button
                    className={styles.composerIconBtn}
                    onClick={() => composerFileRef.current?.click()}
                    aria-label={t("feed.uploadPhoto")}
                    title={t("feed.uploadPhoto")}
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
              aria-label={t("feed.filterTablistAria")}
            >
              {TAB_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className={`${styles.tab} ${tab === value ? styles.tabActive : ""}`}
                  onClick={() => setTab(value)}
                >
                  {t(TAB_LABEL_KEYS[value])}
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
                placeholder={t("feed.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t("feed.searchAria")}
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
          ) : error ? (
            <EmptyState
              variant="filtered"
              compact
              art={<ArtCompartida />}
              eyebrow={t("feed.errorEyebrow")}
              title={
                <Trans
                  i18nKey="compartidas:feedTitle.error"
                  components={{ em: <em /> }}
                />
              }
              text={t("feed.errorText")}
              primary={{
                label: t("feed.errorRetry"),
                onClick: () =>
                  loadFeed(1, true, { category: categoryParam, q: qParam }),
              }}
            />
          ) : posts.length === 0 && !featured ? (
            isFiltered ? (
              <EmptyState
                variant="filtered"
                compact
                art={<ArtSearch />}
                eyebrow={t("feed.emptyFilteredEyebrow")}
                title={
                  <Trans
                    i18nKey="compartidas:feedTitle.emptyFiltered"
                    components={{ em: <em /> }}
                  />
                }
                text={t("feed.emptyFilteredText")}
                secondary={{
                  label: t("feed.emptyFilteredClear"),
                  icon: "clear",
                  onClick: () => {
                    setTab("todo");
                    setQuery("");
                  },
                }}
              />
            ) : (
              <EmptyState
                art={<ArtCompartida />}
                ghost={<GhostPolaroids />}
                eyebrow={t("feed.emptyEyebrow")}
                title={
                  <Trans
                    i18nKey="compartidas:feedTitle.empty"
                    components={{ em: <em /> }}
                  />
                }
                text={
                  user ? t("feed.emptyTextUser") : t("feed.emptyTextGuest")
                }
                primary={
                  user
                    ? {
                        label: t("feed.emptyPrimaryUser"),
                        onClick: () => setShowCreate(true),
                      }
                    : { label: t("feed.emptyPrimaryGuest"), to: "/register" }
                }
              />
            )
          ) : (
            <div className={styles.feed}>
              {featured && renderCard(featured, { featured: true })}
              {visiblePosts.map((post, i) => (
                <Fragment key={post._id}>
                  {renderCard(post, { index: featured ? i + 1 : i })}
                  {/* Widget intercalado cada N posts (ritmo del feed). Preferimos
                      un CTA a mesas (conversión); si la sección Mesas está
                      apagada, caemos a la frase decorativa. */}
                  {!isFiltered &&
                    i + 1 === INTERLEAVE_EVERY &&
                    (mesasEnabled ? <MesasCta /> : <QuoteWidget text={quote} />)}
                </Fragment>
              ))}

              {page < totalPages && (
                <button
                  className={styles.loadMoreBtn}
                  onClick={() => loadFeed(page + 1, false)}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? t("feed.loadingMore")
                    : t("feed.loadMore")}
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
