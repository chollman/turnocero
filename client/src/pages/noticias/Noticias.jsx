import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { getLocale } from "../../utils/locale";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { useNoticiasQuery } from "../../queries/noticias";
import Avatar from "../../components/shared/Avatar";
import Meeple from "../../components/shared/Meeple";
import EmptyState from "../../components/shared/EmptyState";
import { ArtNoticia } from "../../components/shared/EmptyArt";
import { GhostMesa } from "../../components/shared/EmptyGhosts";
import { getUserDisplay } from "../../utils/userDisplay";
import {
  getNoticiaSections,
  categoryLabel,
  categoryColor,
  isLiveCategory,
} from "../../utils/noticiaCategories";
import { readingLabel } from "../../utils/readingTime";
import styles from "./Noticias.module.css";

function timeAgo(date, t) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return t("noticias:list.timeAgo.now");
  if (diff < 3600)
    return t("noticias:list.timeAgo.minutes", { count: Math.floor(diff / 60) });
  if (diff < 86400)
    return t("noticias:list.timeAgo.hours", { count: Math.floor(diff / 3600) });
  if (diff < 604800)
    return t("noticias:list.timeAgo.days", { count: Math.floor(diff / 86400) });
  return new Date(date).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "short",
  });
}

function ImageOrFallback({ noticia, className }) {
  const { t } = useTranslation();
  if (noticia.image?.url) {
    return (
      <img
        src={noticia.image.url}
        alt={noticia.title || ""}
        className={className}
      />
    );
  }
  return (
    <div className={`${className} ${styles.fallback}`}>
      {noticia.image?.caption || t("noticias:list.imageFallback")}
    </div>
  );
}

function StoryCard({ noticia }) {
  const { t } = useTranslation();
  const cat = noticia.category || "general";
  const who = getUserDisplay(noticia.author);
  return (
    <Link to={`/noticias/${noticia._id}`} className={styles.story}>
      <div className={styles.storyImage}>
        <ImageOrFallback noticia={noticia} className={styles.storyImageInner} />
      </div>
      <span
        className={styles.storyKicker}
        style={{ color: categoryColor(cat) }}
      >
        <Meeple /> {noticia.kicker || categoryLabel(cat)}
      </span>
      <h3 className={styles.storyHeadline}>
        {noticia.title || t("noticias:list.untitled")}
      </h3>
      {noticia.dek && <p className={styles.storyDek}>{noticia.dek}</p>}
      <span className={styles.storyByline}>
        <strong>{who.name}</strong>
        <span>·</span>
        <span>{timeAgo(noticia.publishedAt || noticia.createdAt, t)}</span>
      </span>
    </Link>
  );
}

function BriefItem({ noticia }) {
  const { t } = useTranslation();
  const cat = noticia.category || "general";
  return (
    <Link to={`/noticias/${noticia._id}`} className={styles.brief}>
      <span
        className={styles.briefKicker}
        style={{ color: categoryColor(cat) }}
      >
        {noticia.kicker || categoryLabel(cat)}
      </span>
      <h4 className={styles.briefHeadline}>
        {noticia.title || t("noticias:list.untitled")}
      </h4>
      <div className={styles.briefMeta}>
        <span>{timeAgo(noticia.publishedAt || noticia.createdAt, t)}</span>
      </div>
    </Link>
  );
}

function Lead({ noticia }) {
  const { t } = useTranslation();
  const cat = noticia.category || "general";
  const who = getUserDisplay(noticia.author);
  return (
    <div className={styles.lead}>
      <Link to={`/noticias/${noticia._id}`} className={styles.leadText}>
        <div
          className={`${styles.leadCategory} ${isLiveCategory(cat) ? styles.leadLive : ""}`}
          style={{ color: categoryColor(cat) }}
        >
          {isLiveCategory(cat) && (
            <span className={styles.liveDot} aria-hidden="true" />
          )}
          {categoryLabel(cat)}
        </div>
        <h2 className={styles.leadHeadline}>
          {noticia.title || t("noticias:list.untitled")}
        </h2>
        {noticia.dek && <p className={styles.leadDek}>{noticia.dek}</p>}
        <div className={styles.leadMeta}>
          <Avatar user={noticia.author} size="xs" />
          <span>
            <strong>{who.name}</strong> ·{" "}
            {timeAgo(noticia.publishedAt || noticia.createdAt, t)}
          </span>
          {noticia.body && <span>· {readingLabel(noticia.body)}</span>}
        </div>
      </Link>
      <Link to={`/noticias/${noticia._id}`} className={styles.leadImage}>
        <ImageOrFallback noticia={noticia} className={styles.leadImageInner} />
        {noticia.image?.caption && (
          <span className={styles.leadImageCaption}>
            {noticia.image.caption}
          </span>
        )}
      </Link>
    </div>
  );
}

export default function Noticias() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const brandName = useBrandName();
  const isAdmin = user?.isAdmin;

  const [tab, setTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 350);

  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    fetchNextPage,
  } = useNoticiasQuery({ category: tab, search });

  const noticias = useMemo(
    () => data?.pages.flatMap((p) => p.noticias) ?? [],
    [data],
  );
  const total = data?.pages[0]?.total ?? 0;

  const today = new Date().toLocaleDateString(getLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const filtering = tab !== "all" || !!search.trim();
  // Composición editorial (solo en la portada "all" sin búsqueda).
  const lead = !filtering
    ? noticias.find((n) => n.featured) ||
      noticias.find((n) => n.image?.url) ||
      noticias[0]
    : null;
  const briefs = !filtering
    ? noticias.filter((n) => n.isBrief && n._id !== lead?._id)
    : [];
  const stories = noticias.filter(
    (n) => n._id !== lead?._id && !briefs.includes(n),
  );

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{t("noticias:list.docTitle", { brand: brandName })}</title>
        <meta
          name="description"
          content={t("noticias:list.metaDescription", { brand: brandName })}
        />
      </Helmet>

      <div className={styles.inner}>
        {/* ── Masthead ── */}
        <div className={styles.masthead}>
          <div className={styles.mastheadLeft}>
            {today}
            <br />
            <strong>
              {t("noticias:list.mastheadTotal", { count: total })}
            </strong>
          </div>
          <h1 className={styles.mastheadTitle}>
            <Trans
              i18nKey="noticias:list.mastheadTitle"
              values={{ brand: brandName }}
              components={{ em: <em /> }}
            />
          </h1>
          <div className={styles.mastheadRight}>
            {t("noticias:list.mastheadRight")}
            <br />
            <strong>
              {t("noticias:list.mastheadYear", {
                year: new Date().getFullYear(),
              })}
            </strong>{" "}
            {t("noticias:list.mastheadGames")}
          </div>
        </div>

        {/* ── Section tabs + search + admin CTA ── */}
        <div className={styles.controls}>
          <div className={styles.sectionTabs}>
            {getNoticiaSections().map((s) => (
              <button
                key={s.id}
                className={`${styles.sectionTab} ${tab === s.id ? styles.sectionTabActive : ""}`}
                onClick={() => setTab(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Mobile: dropdown en lugar de las tabs (oculto en desktop por CSS). */}
          <select
            className={styles.tabSelect}
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            aria-label={t("noticias:list.sectionAria")}
          >
            {getNoticiaSections().map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <div className={styles.tabsSpacer} />
          <input
            className={styles.search}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("noticias:list.searchPlaceholder")}
          />
          {isAdmin && (
            <button
              className={styles.newBtn}
              onClick={() => navigate("/noticias/crear")}
            >
              {t("noticias:list.newNoticia")}
            </button>
          )}
        </div>

        {/* FAB — mobile only, admin only (reemplaza al botón inline). */}
        {isAdmin && (
          <button
            className={styles.fab}
            onClick={() => navigate("/noticias/crear")}
            aria-label={t("noticias:list.newNoticiaAria")}
          >
            {t("noticias:list.newNoticia")}
          </button>
        )}

        {loading ? (
          <div className={styles.skeletonWrap}>
            <div className={styles.skLead}>
              <div className={styles.skBlock}>
                <div className={styles.skLine} style={{ width: "30%" }} />
                <div className={styles.skTitle} />
                <div className={styles.skLine} style={{ width: "80%" }} />
              </div>
              <div className={styles.skImg} />
            </div>
            <div className={styles.skGrid}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={styles.skStory}>
                  <div className={styles.skStoryImg} />
                  <div className={styles.skLine} style={{ width: "60%" }} />
                  <div className={styles.skLine} style={{ width: "90%" }} />
                </div>
              ))}
            </div>
          </div>
        ) : noticias.length === 0 ? (
          filtering ? (
            <EmptyState
              variant="filtered"
              compact
              art={<ArtNoticia />}
              eyebrow={t("noticias:list.emptyFilteredEyebrow")}
              title={
                <Trans
                  i18nKey="noticias:list.emptyFilteredTitle"
                  components={{ em: <em /> }}
                />
              }
              text={t("noticias:list.emptyFilteredText")}
              secondary={{
                label: t("noticias:list.clearFilters"),
                onClick: () => {
                  setTab("all");
                  setSearchInput("");
                },
              }}
            />
          ) : (
            <EmptyState
              art={<ArtNoticia />}
              ghost={<GhostMesa />}
              eyebrow={t("noticias:list.emptyEyebrow")}
              title={
                <Trans
                  i18nKey="noticias:list.emptyTitle"
                  components={{ em: <em /> }}
                />
              }
              text={t("noticias:list.emptyText")}
              primary={
                isAdmin
                  ? {
                      label: t("noticias:list.publishNoticia"),
                      to: "/noticias/crear",
                    }
                  : undefined
              }
            />
          )
        ) : (
          <>
            {lead && <Lead noticia={lead} />}

            <div className={styles.gridArea}>
              <div className={styles.storiesCol}>
                <div className={styles.colLabel}>
                  <Meeple />{" "}
                  {filtering
                    ? t("noticias:list.results")
                    : t("noticias:list.featuredStories")}
                </div>
                <div className={styles.storyGrid}>
                  {stories.map((n) => (
                    <StoryCard key={n._id} noticia={n} />
                  ))}
                </div>

                {lead?.quote?.text && (
                  <div className={styles.breakout}>
                    <p className={styles.breakoutText}>{lead.quote.text}</p>
                    {(lead.quote.author || lead.quote.context) && (
                      <div className={styles.breakoutAttrib}>
                        —{" "}
                        {lead.quote.author && (
                          <strong>{lead.quote.author}</strong>
                        )}
                        {lead.quote.context ? ` · ${lead.quote.context}` : ""}
                      </div>
                    )}
                  </div>
                )}

                {hasNextPage && (
                  <button
                    className={styles.loadMore}
                    onClick={() => fetchNextPage()}
                    disabled={loadingMore}
                  >
                    {loadingMore
                      ? t("noticias:list.loadingMore")
                      : t("noticias:list.loadMore")}
                  </button>
                )}
              </div>

              {!filtering && briefs.length > 0 && (
                <aside className={styles.briefsCol}>
                  <div className={styles.colLabel}>
                    <Meeple /> {t("noticias:list.briefs")}
                  </div>
                  {briefs.map((n) => (
                    <BriefItem key={n._id} noticia={n} />
                  ))}
                </aside>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
