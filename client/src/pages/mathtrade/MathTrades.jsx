import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import MathTradeSkeleton from "./MathTradeSkeleton";
import ItemCommunityTag from "../../components/shared/ItemCommunityTag";
import { getStatusMeta, getModeLabel } from "./mathtradeStatus";
import styles from "./MathTrades.module.css";

const STATUS_TABS = [
  { id: "all", filter: null },
  { id: "open", filter: "open" },
  { id: "results", filter: "results" },
  { id: "finished", filter: "finished" },
];

function MathTradeCard({ mt }) {
  const { t } = useTranslation();
  const meta = getStatusMeta(mt.status);
  return (
    <Link to={`/math-trade/${mt._id}`} className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.cardTitle}>{mt.title}</span>
        <span
          className={styles.chip}
          style={{
            color: `var(${meta.color})`,
            background: `color-mix(in srgb, var(${meta.color}) 15%, transparent)`,
          }}
        >
          {meta.label}
        </span>
      </div>
      {mt.description && <p className={styles.cardDesc}>{mt.description}</p>}
      <div className={styles.cardMeta}>
        <ItemCommunityTag communityId={mt.community} />
        <span>
          {t("mathtrade:list.gamesOffered", { count: mt.itemCount || 0 })}
        </span>
        <span>· {getModeLabel(mt.matching?.mode)}</span>
      </div>
    </Link>
  );
}

export default function MathTrades() {
  const { t } = useTranslation();
  const { isActuallyAdmin, viewAsUser } = useAuth();
  const brandName = useBrandName();
  const showAdminUI = isActuallyAdmin && !viewAsUser;

  const [trades, setTrades] = useState([]);
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(
    async (pageNum = 1, replace = true, statusFilter = null, signal) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = { page: pageNum, limit: 12 };
        if (statusFilter) params.status = statusFilter;
        const { data } = await axios.get(API.mathtrade.LIST, {
          params,
          signal,
        });
        if (signal?.aborted) return;
        setTrades((prev) =>
          replace ? data.mathtrades : [...prev, ...data.mathtrades],
        );
        setTotalPages(data.pages);
        setPage(pageNum);
      } catch (err) {
        if (axios.isCancel(err)) return;
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const ac = new AbortController();
    const f = STATUS_TABS.find((t) => t.id === tab)?.filter || null;
    load(1, true, f, ac.signal);
    return () => ac.abort();
  }, [tab, load]);

  const showDrafts = showAdminUI && tab === "all";
  const drafts = showDrafts ? trades.filter((t) => t.status === "draft") : [];
  const visible = showDrafts
    ? trades.filter((t) => t.status !== "draft")
    : trades;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{t("mathtrade:list.docTitle", { brand: brandName })}</title>
        <meta
          name="description"
          content={t("mathtrade:list.metaDescription")}
        />
      </Helmet>

      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>{t("mathtrade:list.eyebrow")}</div>
            <h1 className={styles.title}>{t("mathtrade:list.title")}</h1>
            <p className={styles.sub}>{t("mathtrade:list.subtitle")}</p>
          </div>
          {showAdminUI && (
            <button
              className={styles.newBtn}
              onClick={() => navigate("/math-trade/crear")}
            >
              {t("mathtrade:list.newTrade")}
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          {STATUS_TABS.map((st) => (
            <button
              key={st.id}
              className={`${styles.tab} ${tab === st.id ? styles.tabActive : ""}`}
              onClick={() => setTab(st.id)}
            >
              {t(`mathtrade:list.tabs.${st.id}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.feed}>
            {[1, 2, 3].map((i) => (
              <MathTradeSkeleton key={i} />
            ))}
          </div>
        ) : visible.length === 0 && drafts.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🔄</span>
            <p className={styles.emptyTitle}>
              {t("mathtrade:list.emptyTitle")}
            </p>
            {showAdminUI && (
              <Link to="/math-trade/crear" className={styles.emptyBtn}>
                {t("mathtrade:list.createFirst")}
              </Link>
            )}
          </div>
        ) : (
          <>
            {drafts.length > 0 && (
              <div className={styles.draftsSection}>
                <h3 className={styles.draftsTitle}>
                  {t("mathtrade:list.draftsTitle")}
                </h3>
                <div className={styles.feed}>
                  {drafts.map((t) => (
                    <MathTradeCard key={t._id} mt={t} />
                  ))}
                </div>
              </div>
            )}
            <div className={styles.feed}>
              {visible.map((t) => (
                <MathTradeCard key={t._id} mt={t} />
              ))}
            </div>

            {page < totalPages && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => {
                  const f =
                    STATUS_TABS.find((st) => st.id === tab)?.filter || null;
                  load(page + 1, false, f);
                }}
                disabled={loadingMore}
              >
                {loadingMore
                  ? t("mathtrade:list.loadingMore")
                  : t("mathtrade:list.loadMore")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
