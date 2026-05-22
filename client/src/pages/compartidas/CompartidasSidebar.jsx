import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import GameTile from "../../components/shared/GameTile";
import BgWatchHomeWidget from "./BgWatchHomeWidget";
import styles from "./CompartidasSidebar.module.css";

function formatDate(date) {
  return new Date(date).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function seedFromId(id = "") {
  return id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

export default function CompartidasSidebar() {
  const { user } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const mesasEnabled = isSectionEnabled("mesas");
  const bgwatchEnabled = isSectionEnabled("bgwatch");
  const [tables, setTables] = useState([]);
  const [topGames, setTopGames] = useState([]);

  useEffect(() => {
    if (!user || !mesasEnabled) {
      setTables([]);
      setTopGames([]);
      return;
    }
    axios
      .get("/api/tables/mine", { params: { limit: 4 } })
      .then(({ data }) => {
        const upcoming = (data.tables || [])
          .filter(
            (t) => t.status !== "cancelled" && new Date(t.date) >= new Date(),
          )
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 3);
        setTables(upcoming);
      })
      .catch(() => {});

    axios
      .get("/api/tables/top-games")
      .then(({ data }) => setTopGames(data))
      .catch(() => {});
  }, [user, mesasEnabled]);

  return (
    <aside className={styles.sidebar}>
      {/* ── BG Watch (activo o promo) ── */}
      {user && bgwatchEnabled && <BgWatchHomeWidget user={user} dismissible />}

      {/* ── Próximas mesas ── */}
      {mesasEnabled && (
        <div className={styles.widget}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetEyebrow}>◆ TUS MESAS</span>
            <Link to="/mesas" className={styles.widgetLink}>
              Ver todas →
            </Link>
          </div>
          <h3 className={styles.widgetTitle}>Próximas partidas</h3>

          {tables.length === 0 ? (
            <div className={styles.emptyWidget}>
              <p className={styles.emptyText}>Sin mesas próximas</p>
              <Link to="/mesas/crear" className={styles.emptyAction}>
                + Crear mesa
              </Link>
            </div>
          ) : (
            <div className={styles.tableList}>
              {tables.map((t) => {
                const seats = t.maxPlayers - (t.players?.length || 0);
                const isFull = t.status === "full";
                return (
                  <Link
                    key={t._id}
                    to={`/mesas/${t._id}`}
                    className={styles.tableRow}
                  >
                    <div className={styles.tableTile}>
                      <GameTile
                        game={t.boardGame}
                        seed={seedFromId(t._id)}
                        size={38}
                        imageUrl={t.bggThumbnail}
                      />
                    </div>
                    <div className={styles.tableInfo}>
                      <span className={styles.tableGame}>{t.boardGame}</span>
                      <span className={styles.tableMeta}>
                        {formatDate(t.date)}
                      </span>
                    </div>
                    <span
                      className={`${styles.tableSeats} ${isFull ? styles.tableSeatsFull : ""}`}
                    >
                      {isFull ? "Llena" : `${seats}L`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Top juegos ── */}
      {mesasEnabled && (
        <div className={styles.widget}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetEyebrow}>◆ COMUNIDAD</span>
          </div>
          <h3 className={styles.widgetTitle}>Top juegos esta semana</h3>

          {topGames.length === 0 ? (
            <p className={styles.emptyText}>Sin datos esta semana</p>
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
