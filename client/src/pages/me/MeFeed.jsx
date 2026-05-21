import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import GameTile from "../../components/shared/GameTile";
import FeedCardSkeleton from "./FeedCardSkeleton";
import FeedCard from "./FeedCard";
import styles from "./MeFeed.module.css";

const FILTERS = [
  { key: "all", label: "Todas" },
  { key: "host", label: "Anfitrión" },
  { key: "player", label: "Jugador" },
  { key: "cancelled", label: "Canceladas" },
];

function seedFromId(id = "") {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) >>> 0;
  return s;
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatNextMeta(table) {
  const d = new Date(table.date);
  const weekday = d
    .toLocaleString("es-AR", { weekday: "short" })
    .toUpperCase()
    .replace(".", "");
  const day = d
    .toLocaleString("es-AR", { day: "numeric", month: "short" })
    .toUpperCase();
  const time = d.toLocaleString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = [`${weekday} ${day} · ${time}`];
  if (table.location) parts.push(table.location);
  parts.push(`${table.players.length + 1}/${table.maxPlayers + 1} jugadores`);
  return parts.join(" · ");
}

function SeatTrack({ filled, total }) {
  const pct = total > 0 ? (filled / total) * 100 : 0;
  return (
    <div className={styles.seatTrack}>
      <div className={styles.seatTrackFill} style={{ width: `${pct}%` }} />
      {Array.from({ length: total - 1 }).map((_, i) => (
        <div
          key={i}
          className={styles.seatTrackDivider}
          style={{ left: `${((i + 1) / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function NextGameHighlight({ table }) {
  const days = daysUntil(table.date);
  const daysLabel =
    days <= 0 ? "HOY" : days === 1 ? "EN 1 DÍA" : `EN ${days} DÍAS`;
  const seed = seedFromId(table._id);
  const filled = table.players.length + 1;
  const total = table.maxPlayers + 1;

  return (
    <div className={styles.nextGame}>
      <div className={styles.nextGameBgTile}>
        <GameTile game={table.boardGame} seed={seed} size="100%" />
      </div>
      <div className={styles.nextGameContent}>
        <div className={styles.nextGameTile}>
          <GameTile game={table.boardGame} seed={seed} size={110} />
        </div>
        <div className={styles.nextGameInfo}>
          <span className={styles.eyebrow}>◆ PRÓXIMA MESA · {daysLabel}</span>
          <div className={styles.nextGameTitle}>{table.boardGame}</div>
          <div className={styles.nextGameMeta}>{formatNextMeta(table)}</div>
          <SeatTrack filled={filled} total={total} />
          <div className={styles.nextGameActions}>
            <Link to={`/mesas/${table._id}`} className={styles.btnPrimary}>
              Abrir mesa →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MeFeed() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [includeFriends, setIncludeFriends] = useState(false);
  const [hasFriends, setHasFriends] = useState(false);

  const uid = user?._id?.toString();

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    const url = includeFriends
      ? "/api/tables/me/feed?includeFriends=true"
      : "/api/tables/me/feed";
    axios
      .get(url)
      .then((res) => setTables(res.data.tables))
      .catch(() => setError("No se pudo cargar el historial."))
      .finally(() => setLoading(false));
  }, [includeFriends, uid]);

  useEffect(() => {
    if (!uid) return;
    axios
      .get(`/api/users/${uid}`)
      .then((res) => setHasFriends((res.data.friendsCount ?? 0) > 0))
      .catch(() => {});
  }, [uid]);

  const now = new Date();

  const isHostOf = (t) => (t.host._id || t.host).toString() === uid;

  const applyFilter = (t) => {
    if (filter === "all") return true;
    if (filter === "cancelled") return t.status === "cancelled";
    if (filter === "host") return isHostOf(t);
    if (filter === "player") return !isHostOf(t);
    return true;
  };

  const filteredTables = tables.filter(applyFilter);
  const upcoming = filteredTables.filter((t) => new Date(t.date) >= now);
  const past = filteredTables.filter((t) => new Date(t.date) < now);
  const nextGame = upcoming.length > 0 ? upcoming[upcoming.length - 1] : null;

  const countFor = (key) => {
    if (key === "all") return tables.length;
    if (key === "cancelled")
      return tables.filter((t) => t.status === "cancelled").length;
    if (key === "host") return tables.filter(isHostOf).length;
    if (key === "player") return tables.filter((t) => !isHostOf(t)).length;
    return 0;
  };

  const hostedCount = tables.filter(isHostOf).length;
  const upcomingAll = tables.filter((t) => new Date(t.date) >= now);
  const nextAll =
    upcomingAll.length > 0 ? upcomingAll[upcomingAll.length - 1] : null;
  const days = nextAll ? daysUntil(nextAll.date) : null;

  let subtitle = "";
  if (days !== null && days >= 0) {
    subtitle =
      days === 0
        ? "Tu próxima partida es hoy."
        : `Tu próxima partida es en ${days} día${days !== 1 ? "s" : ""}.`;
  }
  if (hostedCount > 0) {
    subtitle += `${subtitle ? " Y tenés" : "Tenés"} ${hostedCount} mesa${hostedCount !== 1 ? "s" : ""} hosteada${hostedCount !== 1 ? "s" : ""} en total.`;
  }
  if (!subtitle && !loading)
    subtitle = "Empezá a jugar o creá tu primera mesa.";

  const nombre = user?.nombre || user?.username || "…";

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}>◆ MI FEED</div>
          <h1 className={styles.heroTitle}>Hola, {nombre}.</h1>
          {loading ? (
            <div className={styles.heroSubSkeleton} />
          ) : (
            subtitle && <p className={styles.heroSub}>{subtitle}</p>
          )}
        </div>

        {!loading && !error && nextGame && filter === "all" && (
          <NextGameHighlight table={nextGame} />
        )}

        <div className={styles.filterBar}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className={styles.filterCount}>{countFor(f.key)}</span>
            </button>
          ))}
          {hasFriends && (
            <button
              className={`${styles.filterBtn} ${styles.filterBtnFriends} ${includeFriends ? styles.filterBtnFriendsActive : ""}`}
              onClick={() => setIncludeFriends((v) => !v)}
            >
              🤝 {includeFriends ? "Con amigos" : "Amigos"}
            </button>
          )}
        </div>

        {loading &&
          [1, 2, 3, 4, 5, 6, 7, 8].map((i) => <FeedCardSkeleton key={i} />)}
        {error && (
          <p className={`${styles.stateMsg} ${styles.errorMsg}`}>{error}</p>
        )}

        {!loading && !error && filteredTables.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🎲</span>
            <p>No hay mesas para mostrar.</p>
            <Link to="/mesas" className={styles.emptyLink}>
              Explorar mesas disponibles
            </Link>
          </div>
        )}

        {!loading && !error && filteredTables.length > 0 && (
          <div className={styles.feed}>
            {upcoming.length > 0 && (
              <>
                <div className={styles.sectionLabel}>
                  PRÓXIMAS · {upcoming.length}
                </div>
                {upcoming.map((t, i) => (
                  <FeedCard
                    key={t._id}
                    table={t}
                    userId={uid}
                    isPast={false}
                    index={i}
                  />
                ))}
              </>
            )}
            {past.length > 0 && (
              <>
                <div className={styles.sectionLabel}>HISTORIAL</div>
                {past.map((t, i) => (
                  <FeedCard
                    key={t._id}
                    table={t}
                    userId={uid}
                    isPast
                    index={upcoming.length + i}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
