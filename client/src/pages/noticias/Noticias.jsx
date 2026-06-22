import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { API } from "../../api/endpoints";
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

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return new Date(date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

function ImageOrFallback({ noticia, className }) {
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
      {noticia.image?.caption || "imagen"}
    </div>
  );
}

function StoryCard({ noticia }) {
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
      <h3 className={styles.storyHeadline}>{noticia.title || "Sin título"}</h3>
      {noticia.dek && <p className={styles.storyDek}>{noticia.dek}</p>}
      <span className={styles.storyByline}>
        <strong>{who.name}</strong>
        <span>·</span>
        <span>{timeAgo(noticia.publishedAt || noticia.createdAt)}</span>
      </span>
    </Link>
  );
}

function BriefItem({ noticia }) {
  const cat = noticia.category || "general";
  return (
    <Link to={`/noticias/${noticia._id}`} className={styles.brief}>
      <span
        className={styles.briefKicker}
        style={{ color: categoryColor(cat) }}
      >
        {noticia.kicker || categoryLabel(cat)}
      </span>
      <h4 className={styles.briefHeadline}>{noticia.title || "Sin título"}</h4>
      <div className={styles.briefMeta}>
        <span>{timeAgo(noticia.publishedAt || noticia.createdAt)}</span>
      </div>
    </Link>
  );
}

function Lead({ noticia }) {
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
        <h2 className={styles.leadHeadline}>{noticia.title || "Sin título"}</h2>
        {noticia.dek && <p className={styles.leadDek}>{noticia.dek}</p>}
        <div className={styles.leadMeta}>
          <Avatar user={noticia.author} size="xs" />
          <span>
            <strong>{who.name}</strong> ·{" "}
            {timeAgo(noticia.publishedAt || noticia.createdAt)}
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const brandName = useBrandName();
  const isAdmin = user?.isAdmin;

  const [noticias, setNoticias] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tab, setTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 350);

  const load = useCallback(
    async (pageNum, replace) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = { page: pageNum, limit: 10 };
        if (tab !== "all") params.category = tab;
        if (search.trim()) params.search = search.trim();
        const { data } = await axios.get(API.noticias.LIST, { params });
        setNoticias((prev) =>
          replace ? data.noticias : [...prev, ...data.noticias],
        );
        setTotalPages(data.pages);
        setTotal(data.total);
        setPage(pageNum);
      } catch {
        /* el toast global cubre el error */
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, search],
  );

  useEffect(() => {
    load(1, true);
  }, [load]);

  const today = new Date().toLocaleDateString("es-AR", {
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
        <title>{`El Noticiero de ${brandName} 🗞️`}</title>
        <meta
          name="description"
          content={`Novedades, reseñas y eventos de la comunidad ${brandName}.`}
        />
      </Helmet>

      <div className={styles.inner}>
        {/* ── Masthead ── */}
        <div className={styles.masthead}>
          <div className={styles.mastheadLeft}>
            {today}
            <br />
            <strong>Noticias totales: #{total}</strong>
          </div>
          <h1 className={styles.mastheadTitle}>
            El <em>Noticiero</em> de {brandName}
          </h1>
          <div className={styles.mastheadRight}>
            La comunidad
            <br />
            <strong>{new Date().getFullYear()} ·</strong> juegos de mesa
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
            aria-label="Sección"
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
            placeholder="Buscar nota…"
          />
          {isAdmin && (
            <button
              className={styles.newBtn}
              onClick={() => navigate("/noticias/crear")}
            >
              + Nueva noticia
            </button>
          )}
        </div>

        {/* FAB — mobile only, admin only (reemplaza al botón inline). */}
        {isAdmin && (
          <button
            className={styles.fab}
            onClick={() => navigate("/noticias/crear")}
            aria-label="Nueva noticia"
          >
            + Nueva noticia
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
              eyebrow="Sin coincidencias"
              title={
                <>
                  Nada para <em>ese filtro.</em>
                </>
              }
              text="No encontramos notas con esa categoría o búsqueda."
              secondary={{
                label: "Limpiar filtros",
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
              eyebrow="Sin novedades"
              title={
                <>
                  Nada que <em>anunciar</em>… por ahora.
                </>
              }
              text="Cuando haya novedades, reseñas o convocatorias de la comunidad, las vas a ver acá."
              primary={
                isAdmin
                  ? { label: "Publicar noticia", to: "/noticias/crear" }
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
                  <Meeple /> {filtering ? "Resultados" : "Notas destacadas"}
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

                {page < totalPages && (
                  <button
                    className={styles.loadMore}
                    onClick={() => load(page + 1, false)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Cargando…" : "Ver más noticias"}
                  </button>
                )}
              </div>

              {!filtering && briefs.length > 0 && (
                <aside className={styles.briefsCol}>
                  <div className={styles.colLabel}>
                    <Meeple /> Breves
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
