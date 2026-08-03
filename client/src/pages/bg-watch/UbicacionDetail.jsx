import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useUbicacionDetalleQuery, bgWatchKeys } from "../../queries/bgWatch";
import { useAuth } from "../../context/AuthContext";
import Meeple from "../../components/shared/Meeple";
import BackButton from "../../components/shared/BackButton";
import PlayCard from "./PlayCard";
import PlayCardSkeleton from "./PlayCardSkeleton";
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
  const { t } = useTranslation("bgwatch");

  const isOwnProfile =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canView = isOwnProfile || !!user?.isAdmin;

  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);

  const { data, isError: error } = useUbicacionDetalleQuery(
    bggUsername,
    locationKey,
    page,
    { enabled: canView },
  );

  // Reiniciar la página al cambiar de ubicación.
  useEffect(() => {
    setPage(1);
  }, [locationKey]);

  const userMap = useBggUserMap(data?.plays);

  // Desenlace del modal de edición: "merged" cambió la identidad → volvemos a la
  // lista; "updated" cambió el nombre → refrescamos el detalle en su lugar.
  const handleEditClose = (result) => {
    setEditing(false);
    if (result === "merged") {
      navigate(`/bg-watch/${bggUsername}/ubicaciones`);
    } else if (result === "updated") {
      queryClient.invalidateQueries({
        queryKey: [
          ...bgWatchKeys.all,
          "ubicacionDetalle",
          bggUsername,
          locationKey,
        ],
      });
    }
  };

  if (!canView) {
    return <Navigate to={`/bg-watch/${bggUsername}/partidas`} replace />;
  }

  if (error) {
    return (
      <div className={comu.page}>
        <div className={comu.inner}>
          <BackButton onClick={() => navigate(-1)} flush>
            {t("ubicacionDetail.back")}
          </BackButton>
          <p className={comu.errorMsg}>{t("ubicacionDetail.loadError")}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={comu.page}>
        <div className={comu.inner}>
          <div className={comu.loading}>{t("ubicacionDetail.loading")}</div>
        </div>
      </div>
    );
  }

  const { location, stats, plays, total } = data;
  const totalPages = Math.ceil((total || 0) / PLAYS_PAGE_SIZE);
  const locationName = location.name || t("ubicacionDetail.nameFallback");

  return (
    <div className={comu.page}>
      <div className={comu.inner}>
        <BackButton onClick={() => navigate(-1)} flush>
          {t("ubicacionDetail.back")}
        </BackButton>

        <header className={styles.playerHeader}>
          <div className={styles.playerHeaderInfo}>
            <div className={comu.eyebrow}>
              <Meeple />
              {t("ubicacionDetail.eyebrow")}
            </div>
            <h1 className={styles.playerName}>📍 {locationName}</h1>
            <button
              type="button"
              className={styles.editPlayerBtn}
              onClick={() => setEditing(true)}
            >
              {t("ubicacionDetail.editLocation")}
            </button>
          </div>
        </header>

        {total === 0 ? (
          <p className={comu.heroSub}>{t("ubicacionDetail.noPlaysYet")}</p>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{total}</span>
                <span className={styles.statLabel}>
                  {t("ubicacionDetail.playsHere", { count: total })}
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.uniqueGames}</span>
                <span className={styles.statLabel}>
                  {t("ubicacionDetail.distinctGames", {
                    count: stats.uniqueGames,
                  })}
                </span>
              </div>
              {stats.firstPlayedDate && (
                <div className={styles.statCard}>
                  <span className={styles.statValueSm}>
                    {stats.firstPlayedDate}
                  </span>
                  <span className={styles.statLabel}>
                    {t("ubicacionDetail.firstPlay")}
                  </span>
                </div>
              )}
              {stats.lastPlayedDate && (
                <div className={styles.statCard}>
                  <span className={styles.statValueSm}>
                    {stats.lastPlayedDate}
                  </span>
                  <span className={styles.statLabel}>
                    {t("ubicacionDetail.lastPlay")}
                  </span>
                </div>
              )}
            </div>

            {stats.byGame?.length > 0 && (
              <section>
                <h2 className={comu.sectionTitle}>
                  {t("ubicacionDetail.byGame")}
                </h2>
                <ul className={comu.byGameList}>
                  {stats.byGame.map((g) => (
                    <li
                      key={g.gameId || g.name || "?"}
                      className={comu.byGameRow}
                    >
                      <span className={comu.byGameName}>
                        {g.name ||
                          t("ubicacionDetail.gameFallback", { id: g.gameId })}
                      </span>
                      <span className={comu.byGameScore}>
                        {t("ubicacionDetail.gamePlays", { count: g.total })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className={comu.sectionTitle}>
                {t("ubicacionDetail.plays")}
              </h2>
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
                        onClick={() =>
                          navigate(
                            `/bg-watch/${bggUsername}/partidas/${play.id}`,
                          )
                        }
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
