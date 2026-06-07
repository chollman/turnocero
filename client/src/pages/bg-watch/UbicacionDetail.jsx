import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import Meeple from "../../components/shared/Meeple";
import PlayCard from "./PlayCard";
import PlayCardSkeleton from "./PlayCardSkeleton";
import PlayDetailModal from "./PlayDetailModal";
import Pagination from "./Pagination";
import useBggUserMap from "./useBggUserMap";
import { EditLocationModal } from "./LocationEditModals";
import comu from "./BgWatchComunidad.module.css";
// Reutiliza el layout del detalle de jugador (header/stats/lista de partidas).
import styles from "./JugadorDetail.module.css";

const PLAYS_PAGE_SIZE = 10;

/**
 * Detalle de una ubicación (pestaña "Ubicaciones"): estadísticas (partidas,
 * juegos únicos, fechas) + la lista de partidas jugadas ahí, con un botón para
 * editarla (renombrar / fusionar). Solo dueño/admin (el endpoint también lo
 * bloquea con 403).
 */
export default function UbicacionDetail() {
  const { bggUsername, locationKey } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isOwnProfile =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canView = isOwnProfile || !!user?.isAdmin;

  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [openPlay, setOpenPlay] = useState(null);
  const [editing, setEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!canView) return undefined;
    const ac = new AbortController();
    setError(false);
    axios
      .get(API.bgg.UBICACION_DETALLE(bggUsername, locationKey), {
        params: { page },
        signal: ac.signal,
      })
      .then(({ data: d }) => setData(d))
      .catch((err) => {
        if (!axios.isCancel(err)) setError(true);
      });
    return () => ac.abort();
  }, [bggUsername, locationKey, page, canView, refreshKey]);

  // Reiniciar la página al cambiar de ubicación.
  useEffect(() => {
    setPage(1);
    setData(null);
  }, [locationKey]);

  const userMap = useBggUserMap(data?.plays);

  // Desenlace del modal de edición: "merged" cambió la identidad → volvemos a la
  // lista; "updated" cambió el nombre → refrescamos el detalle en su lugar.
  const handleEditClose = (result) => {
    setEditing(false);
    if (result === "merged") {
      navigate(`/bg-watch/${bggUsername}/ubicaciones`);
    } else if (result === "updated") {
      setRefreshKey((k) => k + 1);
    }
  };

  if (!canView) {
    return <Navigate to={`/bg-watch/${bggUsername}/partidas`} replace />;
  }

  if (error) {
    return (
      <div className={comu.page}>
        <div className={comu.inner}>
          <button
            type="button"
            className={comu.backBtn}
            onClick={() => navigate(-1)}
          >
            ← Volver
          </button>
          <p className={comu.errorMsg}>No se pudo cargar la ubicación.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={comu.page}>
        <div className={comu.inner}>
          <div className={comu.loading}>Cargando…</div>
        </div>
      </div>
    );
  }

  const { location, stats, plays, total } = data;
  const totalPages = Math.ceil((total || 0) / PLAYS_PAGE_SIZE);
  const locationName = location.name || "Ubicación";

  return (
    <div className={comu.page}>
      <div className={comu.inner}>
        <button
          type="button"
          className={comu.backBtn}
          onClick={() => navigate(-1)}
        >
          ← Volver
        </button>

        <header className={styles.playerHeader}>
          <div className={styles.playerHeaderInfo}>
            <div className={comu.eyebrow}>
              <Meeple />
              BG WATCH · UBICACIÓN
            </div>
            <h1 className={styles.playerName}>📍 {locationName}</h1>
            <button
              type="button"
              className={styles.editPlayerBtn}
              onClick={() => setEditing(true)}
            >
              Editar ubicación
            </button>
          </div>
        </header>

        {total === 0 ? (
          <p className={comu.heroSub}>
            Todavía no hay partidas tuyas en esta ubicación.
          </p>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{total}</span>
                <span className={styles.statLabel}>
                  partida{total === 1 ? "" : "s"} acá
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.uniqueGames}</span>
                <span className={styles.statLabel}>
                  juego{stats.uniqueGames === 1 ? "" : "s"} distinto
                  {stats.uniqueGames === 1 ? "" : "s"}
                </span>
              </div>
              {stats.firstPlayedDate && (
                <div className={styles.statCard}>
                  <span className={styles.statValueSm}>
                    {stats.firstPlayedDate}
                  </span>
                  <span className={styles.statLabel}>primera partida</span>
                </div>
              )}
              {stats.lastPlayedDate && (
                <div className={styles.statCard}>
                  <span className={styles.statValueSm}>
                    {stats.lastPlayedDate}
                  </span>
                  <span className={styles.statLabel}>última partida</span>
                </div>
              )}
            </div>

            {stats.byGame?.length > 0 && (
              <section>
                <h2 className={comu.sectionTitle}>Por juego</h2>
                <ul className={comu.byGameList}>
                  {stats.byGame.map((g) => (
                    <li
                      key={g.gameId || g.name || "?"}
                      className={comu.byGameRow}
                    >
                      <span className={comu.byGameName}>
                        {g.name || `Juego ${g.gameId}`}
                      </span>
                      <span className={comu.byGameScore}>
                        {g.total} {g.total === 1 ? "partida" : "partidas"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className={comu.sectionTitle}>Partidas</h2>
              <div className={styles.playsList}>
                {!plays ? (
                  [0, 1, 2].map((i) => <PlayCardSkeleton key={i} />)
                ) : (
                  <>
                    {plays.map((play, i) => (
                      <PlayCard
                        key={play.id}
                        play={play}
                        index={i}
                        userMap={userMap}
                        onClick={() => setOpenPlay(play)}
                      />
                    ))}
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPage={(p) => {
                        setPage(p);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    />
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {openPlay && (
        <PlayDetailModal
          play={openPlay}
          userMap={userMap}
          onClose={() => setOpenPlay(null)}
        />
      )}

      {editing && (
        <EditLocationModal
          bggUsername={bggUsername}
          location={location}
          onClose={handleEditClose}
        />
      )}
    </div>
  );
}
