import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { getStatusMeta, getModeLabel } from "./mathtradeStatus";
import AdminPanel from "./components/AdminPanel";
import ItemForm from "./components/ItemForm";
import ResultsView from "./components/ResultsView";
import styles from "./MathTradeDetail.module.css";

function ItemCard({ item, showOwner, actions }) {
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
            {item.gameName || `Juego #${item.bggGameId}`}
          </div>
          {showOwner && (
            <div className={styles.itemOwner}>
              <Avatar user={item.owner} size="xs" />
              {display.name}
            </div>
          )}
        </div>
      </div>
      <div className={styles.wantsLabel}>Quiere a cambio</div>
      <div className={styles.wantChips}>
        {item.wants.length === 0 ? (
          <span className={styles.wantChip}>Sin want list</span>
        ) : (
          item.wants.map((w) => (
            <span className={styles.wantChip} key={w.bggGameId}>
              {w.gameName || `#${w.bggGameId}`}
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
  const { user, isActuallyAdmin, viewAsUser } = useAuth();
  const { addToast } = useNotifications();
  const brandName = useBrandName();
  const showAdminUI = isActuallyAdmin && !viewAsUser;

  const [trade, setTrade] = useState(null);
  const [items, setItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [results, setResults] = useState(null);
  const [tab, setTab] = useState("ofertas");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { type:'new' } | { type:'edit', item }
  const [notFound, setNotFound] = useState(false);

  const published = trade && ["results", "finished"].includes(trade.status);

  const refreshItems = useCallback(async () => {
    const [all, mine] = await Promise.all([
      axios.get(API.mathtrade.ITEMS(id)),
      user
        ? axios.get(API.mathtrade.MY_ITEMS(id))
        : Promise.resolve({ data: [] }),
    ]);
    setItems(all.data);
    setMyItems(mine.data);
  }, [id, user]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const { data: t } = await axios.get(API.mathtrade.DETAIL(id), {
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        setTrade(t);
        const [all, mine] = await Promise.all([
          axios.get(API.mathtrade.ITEMS(id), { signal: ac.signal }),
          user
            ? axios.get(API.mathtrade.MY_ITEMS(id), { signal: ac.signal })
            : Promise.resolve({ data: [] }),
        ]);
        if (ac.signal.aborted) return;
        setItems(all.data);
        setMyItems(mine.data);

        if (["results", "finished"].includes(t.status)) {
          const { data: r } = await axios.get(API.mathtrade.RESULTS(id), {
            signal: ac.signal,
          });
          if (ac.signal.aborted) return;
          setResults(r);
          setTab("resultados");
        }
      } catch (err) {
        if (axios.isCancel(err)) return;
        if (err.response?.status === 404) setNotFound(true);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [id, user]);

  const onTradeUpdated = (data) => {
    setTrade(data);
    if (["results", "finished"].includes(data.status)) {
      axios
        .get(API.mathtrade.RESULTS(id))
        .then(({ data: r }) => {
          setResults(r);
          setTab("resultados");
        })
        .catch(() => {});
    } else {
      setResults(null);
    }
    refreshItems().catch(() => {});
  };

  const deleteItem = async (item) => {
    try {
      await axios.delete(API.mathtrade.ITEM(id, item._id));
      await refreshItems();
    } catch (err) {
      addToast({
        type: "error",
        title: "No se pudo eliminar la oferta",
        message: getErrorMessage(err),
      });
    }
  };

  const onItemSaved = async () => {
    setEditing(null);
    await refreshItems();
  };

  if (notFound)
    return (
      <div className={styles.page}>
        <div className={styles.empty}>Este intercambio no existe.</div>
      </div>
    );
  if (loading || !trade)
    return (
      <div className={styles.page}>
        <div className={styles.empty}>Cargando…</div>
      </div>
    );

  const meta = getStatusMeta(trade.status);
  const canSubmit = trade.status === "open";

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`${trade.title} – Math Trade – ${brandName}`}</title>
      </Helmet>
      <div className={styles.inner}>
        <Link to="/math-trade" className={styles.back}>
          ← Math Trade
        </Link>

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
              <span>· Máx. {trade.matching.maxChainLength} por cadena</span>
            )}
            {trade.submissionDeadline && (
              <span>
                · Cierre:{" "}
                {new Date(trade.submissionDeadline).toLocaleDateString(
                  "es-AR",
                  {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
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
            Mis ofertas
          </button>
          <button
            className={`${styles.tab} ${tab === "participantes" ? styles.tabActive : ""}`}
            onClick={() => setTab("participantes")}
          >
            Participantes ({items.length})
          </button>
          {published && (
            <button
              className={`${styles.tab} ${tab === "resultados" ? styles.tabActive : ""}`}
              onClick={() => setTab("resultados")}
            >
              Resultados
            </button>
          )}
        </div>

        {tab === "ofertas" && (
          <div>
            {!user ? (
              <div className={styles.loginPrompt}>
                <Link to="/login">Iniciá sesión</Link> para ofrecer tus juegos.
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
                      + Ofrecer un juego
                    </button>
                  )
                )}
                {!canSubmit && (
                  <p className={styles.wantsLabel} style={{ marginBottom: 14 }}>
                    La carga de ofertas está cerrada.
                  </p>
                )}
                {myItems.length === 0 ? (
                  <div className={styles.empty}>
                    Todavía no ofreciste ningún juego.
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
                                  Editar
                                </button>
                                <button
                                  className={`${styles.smallBtn} ${styles.dangerBtn}`}
                                  onClick={() => deleteItem(item)}
                                >
                                  Eliminar
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
              <div className={styles.empty}>Todavía no hay ofertas.</div>
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
