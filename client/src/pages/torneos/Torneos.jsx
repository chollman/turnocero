import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import TorneoCard from "./components/TorneoCard";
import TorneoSkeleton from "./TorneoSkeleton";
import styles from "./Torneos.module.css";

const STATUS_TABS = [
  { id: "all", label: "Todos", filter: null },
  { id: "registration", label: "Inscripción", filter: "registration" },
  { id: "in_progress", label: "En curso", filter: "in_progress" },
  { id: "finished", label: "Finalizados", filter: "finished" },
];

export default function Torneos() {
  const { isActuallyAdmin, viewAsUser } = useAuth();
  const showAdminUI = isActuallyAdmin && !viewAsUser;

  const [torneos, setTorneos] = useState([]);
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotal] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setMore] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(
    async (pageNum = 1, replace = true, statusFilter = null, signal) => {
      if (pageNum === 1) setLoading(true);
      else setMore(true);
      try {
        const params = { page: pageNum, limit: 12 };
        if (statusFilter) params.status = statusFilter;
        const { data } = await axios.get(API.torneos.LIST, { params, signal });
        if (signal?.aborted) return;
        setTorneos((prev) =>
          replace ? data.torneos : [...prev, ...data.torneos],
        );
        setTotal(data.pages);
        setPage(pageNum);
      } catch (err) {
        if (axios.isCancel(err)) return;
        /* silently ignore */
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setMore(false);
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
  const drafts = showDrafts ? torneos.filter((t) => t.status === "draft") : [];
  const visible = showDrafts
    ? torneos.filter((t) => t.status !== "draft")
    : torneos;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Torneos – TurnoCero 🏆</title>
        <meta
          name="description"
          content="Torneos de juegos de mesa organizados por la comunidad TurnoCero."
        />
      </Helmet>

      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.heroBlock}>
            <div className={styles.eyebrow}><Meeple />COMPETENCIAS</div>
            <h1 className={styles.title}>Torneos</h1>
            <p className={styles.sub}>
              Seguí el progreso de las competencias de la comunidad.
            </p>
          </div>
          {showAdminUI && (
            <button
              className={styles.newBtn}
              onClick={() => navigate("/torneos/crear")}
            >
              + Nuevo torneo
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
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
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🏆</span>
            <p className={styles.emptyTitle}>No hay torneos en esta vista</p>
            {showAdminUI && (
              <Link to="/torneos/crear" className={styles.emptyBtn}>
                + Crear el primer torneo
              </Link>
            )}
          </div>
        ) : (
          <>
            {drafts.length > 0 && (
              <div className={styles.draftsSection}>
                <h3 className={styles.draftsTitle}>Borradores (solo admins)</h3>
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

            {page < totalPages && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => {
                  const f =
                    STATUS_TABS.find((t) => t.id === tab)?.filter || null;
                  load(page + 1, false, f);
                }}
                disabled={loadingMore}
              >
                {loadingMore ? "Cargando…" : "Ver más torneos"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
