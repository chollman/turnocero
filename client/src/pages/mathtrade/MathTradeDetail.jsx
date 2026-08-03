import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useTranslation, Trans } from "react-i18next";
import { getLocale } from "../../utils/locale";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import {
  mathtradeKeys,
  useMathTradeQuery,
  useMathTradeItemsQuery,
  useMathTradeMyItemsQuery,
  useMathTradeResultsQuery,
  deleteMathTradeItem,
} from "../../queries/mathtrade";
import Avatar from "../../components/shared/Avatar";
import BackButton from "../../components/shared/BackButton";
import { getUserDisplay } from "../../utils/userDisplay";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { getStatusMeta, getModeLabel } from "./mathtradeStatus";
import AdminPanel from "./components/AdminPanel";
import ItemForm from "./components/ItemForm";
import ResultsView from "./components/ResultsView";
import styles from "./MathTradeDetail.module.css";

function ItemCard({ item, showOwner, actions }) {
  const { t } = useTranslation();
  const display = showOwner ? getUserDisplay(item.owner) : null;
  return (
    <div className={styles.itemCard}>
      <div className={styles.itemHead}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className={styles.thumb} />
        ) : (
          <div className={styles.thumbFallback}>🎲</div>
        )}
        <div>
          <div className={styles.itemGame}>
            {item.gameName ||
              t("mathtrade:detail.gameFallback", { id: item.bggGameId })}
          </div>
          {showOwner && (
            <div className={styles.itemOwner}>
              <Avatar user={item.owner} size="xs" />
              {display.name}
            </div>
          )}
        </div>
      </div>
      <div className={styles.wantsLabel}>{t("mathtrade:detail.wantsLabel")}</div>
      <div className={styles.wantChips}>
        {item.wants.length === 0 ? (
          <span className={styles.wantChip}>
            {t("mathtrade:detail.noWantList")}
          </span>
        ) : (
          item.wants.map((w) => (
            <span className={styles.wantChip} key={w.bggGameId}>
              {w.gameName || t("mathtrade:chain.gameFallback", { id: w.bggGameId })}
            </span>
          ))
        )}
      </div>
      {actions}
    </div>
  );
}

export default function MathTradeDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user, isActuallyAdmin, viewAsUser } = useAuth();
  const { addToast } = useNotifications();
  const brandName = useBrandName();
  const showAdminUI = isActuallyAdmin && !viewAsUser;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("ofertas");
  const [editing, setEditing] = useState(null); // { type:'new' } | { type:'edit', item }

  const {
    data: trade,
    isPending: loading,
    error: tradeError,
  } = useMathTradeQuery(id);
  const notFound = tradeError?.response?.status === 404;
  const { data: items = [] } = useMathTradeItemsQuery(id);
  const { data: myItems = [] } = useMathTradeMyItemsQuery(id, {
    enabled: !!user,
  });
  const published = trade && ["results", "finished"].includes(trade.status);
  const { data: results = null } = useMathTradeResultsQuery(id, {
    enabled: !!published,
  });

  // Salta a la tab "resultados" cuando el trade PASA a estar publicado (al
  // cargar ya publicado, o al transicionar vía AdminPanel) — no en cada
  // refetch/re-render, para no pisar una tab que el usuario ya eligió.
  const prevStatusRef = useRef(undefined);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const now = trade?.status;
    const wasPublished = ["results", "finished"].includes(prev);
    const isPublished = ["results", "finished"].includes(now);
    if (now && now !== prev && isPublished && !wasPublished) {
      setTab("resultados");
    }
    prevStatusRef.current = now;
  }, [trade?.status]);

  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: mathtradeKeys.items(id) });
    queryClient.invalidateQueries({ queryKey: mathtradeKeys.myItems(id) });
  };

  const onTradeUpdated = (data) => {
    queryClient.setQueryData(mathtradeKeys.detail(id), data);
    if (!["results", "finished"].includes(data.status)) {
      queryClient.setQueryData(mathtradeKeys.results(id), null);
    }
    invalidateItems();
  };

  const deleteItem = async (item) => {
    try {
      await deleteMathTradeItem(id, item._id);
      invalidateItems();
    } catch (err) {
      addToast({
        type: "error",
        title: t("mathtrade:detail.deleteError"),
        message: getErrorMessage(err),
      });
    }
  };

  const onItemSaved = () => {
    setEditing(null);
    invalidateItems();
  };

  if (notFound)
    return (
      <div className={styles.page}>
        <div className={styles.empty}>{t("mathtrade:detail.notFound")}</div>
      </div>
    );
  if (loading || !trade)
    return (
      <div className={styles.page}>
        <div className={styles.empty}>{t("common:states.loading")}</div>
      </div>
    );

  const meta = getStatusMeta(trade.status);
  const canSubmit = trade.status === "open";

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {t("mathtrade:detail.docTitle", {
            title: trade.title,
            brand: brandName,
          })}
        </title>
      </Helmet>
      <div className={styles.inner}>
        <BackButton to="/math-trade">{t("mathtrade:detail.back")}</BackButton>

        <div className={styles.hero}>
          {trade.image?.url && (
            <img src={trade.image.url} alt="" className={styles.banner} />
          )}
          <div className={styles.heroTop}>
            <h1 className={styles.title}>{trade.title}</h1>
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
          {trade.description && (
            <p className={styles.desc}>{trade.description}</p>
          )}
          <div className={styles.metaRow}>
            <span>{getModeLabel(trade.matching?.mode)}</span>
            {trade.matching?.mode === "bounded" && (
              <span>
                {t("mathtrade:detail.maxPerChain", {
                  count: trade.matching.maxChainLength,
                })}
              </span>
            )}
            {trade.submissionDeadline && (
              <span>
                {t("mathtrade:detail.deadline", {
                  date: new Date(trade.submissionDeadline).toLocaleDateString(
                    getLocale(),
                    {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  ),
                })}
              </span>
            )}
          </div>
        </div>

        {showAdminUI && <AdminPanel trade={trade} onUpdated={onTradeUpdated} />}

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "ofertas" ? styles.tabActive : ""}`}
            onClick={() => setTab("ofertas")}
          >
            {t("mathtrade:detail.tabs.myOffers")}
          </button>
          <button
            className={`${styles.tab} ${tab === "participantes" ? styles.tabActive : ""}`}
            onClick={() => setTab("participantes")}
          >
            {t("mathtrade:detail.tabs.participants", { count: items.length })}
          </button>
          {published && (
            <button
              className={`${styles.tab} ${tab === "resultados" ? styles.tabActive : ""}`}
              onClick={() => setTab("resultados")}
            >
              {t("mathtrade:detail.tabs.results")}
            </button>
          )}
        </div>

        {tab === "ofertas" && (
          <div>
            {!user ? (
              <div className={styles.loginPrompt}>
                <Trans
                  i18nKey="mathtrade:loginPrompt"
                  components={{ login: <Link to="/login" /> }}
                />
              </div>
            ) : (
              <>
                {canSubmit && editing?.type === "new" ? (
                  <ItemForm
                    mathtradeId={id}
                    onSaved={onItemSaved}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  canSubmit && (
                    <button
                      className={styles.cta}
                      style={{ marginBottom: 18 }}
                      onClick={() => setEditing({ type: "new" })}
                    >
                      {t("mathtrade:detail.offerGame")}
                    </button>
                  )
                )}
                {!canSubmit && (
                  <p className={styles.wantsLabel} style={{ marginBottom: 14 }}>
                    {t("mathtrade:detail.submissionsClosed")}
                  </p>
                )}
                {myItems.length === 0 ? (
                  <div className={styles.empty}>
                    {t("mathtrade:detail.noOffersYet")}
                  </div>
                ) : (
                  <div className={styles.itemGrid}>
                    {myItems.map((item) =>
                      editing?.type === "edit" &&
                      editing.item._id === item._id ? (
                        <ItemForm
                          key={item._id}
                          mathtradeId={id}
                          item={item}
                          onSaved={onItemSaved}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <ItemCard
                          key={item._id}
                          item={item}
                          showOwner={false}
                          actions={
                            canSubmit && (
                              <div className={styles.itemActions}>
                                <button
                                  className={styles.smallBtn}
                                  onClick={() =>
                                    setEditing({ type: "edit", item })
                                  }
                                >
                                  {t("common:actions.edit")}
                                </button>
                                <button
                                  className={`${styles.smallBtn} ${styles.dangerBtn}`}
                                  onClick={() => deleteItem(item)}
                                >
                                  {t("common:actions.delete")}
                                </button>
                              </div>
                            )
                          }
                        />
                      ),
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "participantes" && (
          <div>
            {items.length === 0 ? (
              <div className={styles.empty}>
                {t("mathtrade:detail.noParticipantsYet")}
              </div>
            ) : (
              <div className={styles.itemGrid}>
                {items.map((item) => (
                  <ItemCard key={item._id} item={item} showOwner />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "resultados" && published && (
          <ResultsView
            results={results}
            items={items}
            currentUserId={user?._id}
          />
        )}
      </div>
    </div>
  );
}
