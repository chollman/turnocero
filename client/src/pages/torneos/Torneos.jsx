import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useBrandName } from "../../hooks/useBrandName";
import { useTorneosQuery } from "../../queries/torneos";
import EmptyState from "../../components/shared/EmptyState";
import { ArtTorneo, ArtSearch } from "../../components/shared/EmptyArt";
import { GhostRows } from "../../components/shared/EmptyGhosts";
import TorneoCard from "./components/TorneoCard";
import TorneoSkeleton from "./TorneoSkeleton";
import styles from "./Torneos.module.css";

const STATUS_TABS = [
  { id: "all", labelKey: "tabAll", filter: null },
  { id: "registration", labelKey: "tabRegistration", filter: "registration" },
  { id: "in_progress", labelKey: "tabInProgress", filter: "in_progress" },
  { id: "finished", labelKey: "tabFinished", filter: "finished" },
];

// Referencia estable — evita un array nuevo en cada render mientras la
// query no tiene datos.
const EMPTY_TORNEOS = [];

export default function Torneos() {
  const { t } = useTranslation("torneos");
  const { isActuallyAdmin, viewAsUser } = useAuth();
  const brandName = useBrandName();
  const showAdminUI = isActuallyAdmin && !viewAsUser;

  const [tab, setTab] = useState("all");
  const navigate = useNavigate();

  const statusFilter = STATUS_TABS.find((s) => s.id === tab)?.filter || null;
  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    fetchNextPage,
  } = useTorneosQuery({ status: statusFilter });

  const torneos = useMemo(
    () => data?.pages.flatMap((p) => p.torneos) ?? EMPTY_TORNEOS,
    [data],
  );

  const showDrafts = showAdminUI && tab === "all";
  const drafts = showDrafts ? torneos.filter((t) => t.status === "draft") : [];
  const visible = showDrafts
    ? torneos.filter((t) => t.status !== "draft")
    : torneos;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{t("list.metaTitle", { brand: brandName })}</title>
        <meta name="description" content={t("list.metaDescription")} />
      </Helmet>

      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.heroBlock}>
            <div className={styles.eyebrow}>{t("list.eyebrow")}</div>
            <h1 className={styles.title}>{t("list.title")}</h1>
            <p className={styles.sub}>{t("list.sub")}</p>
          </div>
          {showAdminUI && (
            <button
              className={styles.newBtn}
              onClick={() => navigate("/torneos/crear")}
            >
              {t("list.newBtn")}
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          {STATUS_TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              className={`${styles.tab} ${tab === tabItem.id ? styles.tabActive : ""}`}
              onClick={() => setTab(tabItem.id)}
            >
              {t(`list.${tabItem.labelKey}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.feed}>
            {[1, 2, 3].map((i) => (
              <TorneoSkeleton key={i} />
            ))}
          </div>
        ) : visible.length === 0 && drafts.length === 0 ? (
          tab !== "all" ? (
            <EmptyState
              variant="filtered"
              compact
              art={<ArtSearch />}
              eyebrow={t("list.emptyFilteredEyebrow")}
              title={
                <Trans
                  t={t}
                  i18nKey="list.emptyFilteredTitle"
                  components={{ em: <em /> }}
                />
              }
              text={t("list.emptyFilteredText")}
              secondary={{
                label: t("list.emptyFilteredSecondary"),
                icon: "clear",
                onClick: () => setTab("all"),
              }}
            />
          ) : (
            <EmptyState
              art={<ArtTorneo />}
              ghost={<GhostRows />}
              eyebrow={t("list.emptyEyebrow")}
              title={
                <Trans
                  t={t}
                  i18nKey="list.emptyTitle"
                  components={{ em: <em /> }}
                />
              }
              text={t("list.emptyText")}
              primary={
                showAdminUI
                  ? { label: t("list.emptyPrimary"), to: "/torneos/crear" }
                  : undefined
              }
            />
          )
        ) : (
          <>
            {drafts.length > 0 && (
              <div className={styles.draftsSection}>
                <h3 className={styles.draftsTitle}>{t("list.draftsTitle")}</h3>
                <div className={styles.feed}>
                  {drafts.map((t, i) => (
                    <TorneoCard key={t._id} torneo={t} index={i} />
                  ))}
                </div>
              </div>
            )}
            <div className={styles.feed}>
              {visible.map((t, i) => (
                <TorneoCard key={t._id} torneo={t} index={i} />
              ))}
            </div>

            {hasNextPage && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => fetchNextPage()}
                disabled={loadingMore}
              >
                {loadingMore ? t("list.loadingMore") : t("list.loadMore")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
