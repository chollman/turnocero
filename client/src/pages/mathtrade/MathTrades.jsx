import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
import { useMathTradesQuery } from "../../queries/mathtrade";
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

  const [tab, setTab] = useState("all");
  const navigate = useNavigate();

  const statusFilter = STATUS_TABS.find((st) => st.id === tab)?.filter || null;
  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    fetchNextPage,
  } = useMathTradesQuery({ status: statusFilter });
  const trades = data?.pages.flatMap((p) => p.mathtrades) || [];

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

            {hasNextPage && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => fetchNextPage()}
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
