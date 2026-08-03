import Meeple from "../../components/shared/Meeple";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useTopGamesQuery, useMyUpcomingTablesQuery } from "../../queries/tables";
import { getLocale } from "../../utils/locale";
import GameTile from "../../components/shared/GameTile";
import GuestJoinBanner from "../../components/shared/GuestJoinBanner";
import BgWatchHomeWidget from "./BgWatchHomeWidget";
import styles from "./CompartidasSidebar.module.css";

function formatDate(date) {
  return new Date(date).toLocaleDateString(getLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function seedFromId(id = "") {
  return id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

export default function CompartidasSidebar() {
  const { t } = useTranslation("compartidas");
  const { user } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const mesasEnabled = isSectionEnabled("mesas");
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  // "Top juegos" es público (optionalAuth) → se trae siempre, también para
  // anónimos: es la prueba social de que la comunidad está activa.
  const { data: topGamesRaw } = useTopGamesQuery({ enabled: mesasEnabled });
  const topGames = useMemo(() => (topGamesRaw || []).slice(0, 5), [topGamesRaw]);

  // "Tus mesas" es personal → solo para usuarios logueados.
  const { data: myTablesRaw } = useMyUpcomingTablesQuery({
    enabled: mesasEnabled && !!user,
  });
  const tables = useMemo(() => {
    if (!mesasEnabled || !user) return [];
    return (myTablesRaw || [])
      .filter((t) => t.status !== "cancelled" && new Date(t.date) >= new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);
  }, [myTablesRaw, mesasEnabled, user]);

  return (
    <aside className={styles.sidebar}>
      {/* ── Guests: tarjeta de conversión arriba (se auto-oculta logueado) ── */}
      {!user && <GuestJoinBanner variant="card" />}

      {/* ── BG Watch (activo o promo) ── */}
      {user && bgwatchEnabled && <BgWatchHomeWidget user={user} dismissible />}

      {/* ── Próximas mesas (personal → solo logueado) ── */}
      {user && mesasEnabled && (
        <div className={styles.widget}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetEyebrow}><Meeple />{t("sidebar.tusMesas")}</span>
            <Link to="/mesas" className={styles.widgetLink}>
              {t("sidebar.verTodas")}
            </Link>
          </div>
          <h3 className={styles.widgetTitle}>{t("sidebar.proximasPartidas")}</h3>

          {tables.length === 0 ? (
            <div className={styles.emptyWidget}>
              <p className={styles.emptyText}>{t("sidebar.sinMesas")}</p>
              <Link to="/mesas/crear" className={styles.emptyAction}>
                {t("sidebar.crearMesa")}
              </Link>
            </div>
          ) : (
            <div className={styles.tableList}>
              {tables.map((table) => {
                const seats =
                  table.maxPlayers - (table.players?.length || 0);
                const isFull = table.status === "full";
                return (
                  <Link
                    key={table._id}
                    to={`/mesas/${table._id}`}
                    className={styles.tableRow}
                  >
                    <div className={styles.tableTile}>
                      <GameTile
                        game={table.boardGame}
                        seed={seedFromId(table._id)}
                        size={38}
                        imageUrl={table.bggThumbnail}
                      />
                    </div>
                    <div className={styles.tableInfo}>
                      <span className={styles.tableGame}>{table.boardGame}</span>
                      <span className={styles.tableMeta}>
                        {formatDate(table.date)}
                      </span>
                    </div>
                    <span
                      className={`${styles.tableSeats} ${isFull ? styles.tableSeatsFull : ""}`}
                    >
                      {isFull
                        ? t("sidebar.full")
                        : t("sidebar.seatsShort", { count: seats })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Top juegos (público → prueba social). A un guest solo se lo
          mostramos si hay data (no un "Sin datos" deslucido). ── */}
      {mesasEnabled && (user || topGames.length > 0) && (
        <div className={styles.widget}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetEyebrow}><Meeple />{t("sidebar.comunidad")}</span>
          </div>
          <h3 className={styles.widgetTitle}>{t("sidebar.topJuegos")}</h3>

          {topGames.length === 0 ? (
            <p className={styles.emptyText}>{t("sidebar.sinDatos")}</p>
          ) : (
            <div className={styles.gameList}>
              {topGames.map((g, i) => (
                <div key={g.game} className={styles.gameRow}>
                  <span
                    className={`${styles.gameRank} ${i === 0 ? styles.gameRankTop : ""}`}
                  >
                    {i + 1}
                  </span>
                  <div className={styles.gameBarWrap}>
                    <div className={styles.gameNameRow}>
                      <span className={styles.gameName}>{g.game}</span>
                      <span className={styles.gameCount}>{g.count}</span>
                    </div>
                    <div className={styles.gameBar}>
                      <div
                        className={styles.gameBarFill}
                        style={{
                          width: `${Math.round((g.count / topGames[0].count) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
