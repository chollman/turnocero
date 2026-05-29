import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import PlayCard from "./PlayCard";
import PlayDetailModal from "./PlayDetailModal";
import CreatePlayModal from "./CreatePlayModal";
import Pagination from "./Pagination";
import useBggUserMap from "./useBggUserMap";
import { GuestBanner, GuestFooter } from "./BgWatchGuestCTAs";
import styles from "./BgWatchProfile.module.css";

const PLAYS_PAGE_SIZE = 10;

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function findOwnerPlayer(play, bggUsername) {
  if (!play?.players || !bggUsername) return null;
  const lower = bggUsername.toLowerCase();
  return (
    play.players.find((p) => (p.username || "").toLowerCase() === lower) || null
  );
}

export default function BgWatchPerGameView() {
  const { bggUsername, gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [game, setGame] = useState(null);
  const [gameError, setGameError] = useState(null);

  const [plays, setPlays] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [openPlay, setOpenPlay] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlay, setEditingPlay] = useState(null);
  const [deletingPlay, setDeletingPlay] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deletingPlay) return;
    setDeleting(true);
    try {
      await axios.delete(API.bgg.PARTIDA_DETAIL(deletingPlay.id));
      setDeletingPlay(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo eliminar la partida.");
    } finally {
      setDeleting(false);
    }
  };

  const isOwnProfile =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canCreate = isOwnProfile && user?.bggConnected && !user?.bggInvalid;
  const isGuest = !user;

  // Fetch game details (uses /game/:id cache — likely hit if user came from Partidas)
  useEffect(() => {
    let cancelled = false;
    setGameError(null);
    axios
      .get(API.bgg.GAME(gameId))
      .then(({ data }) => {
        if (!cancelled) setGame(data);
      })
      .catch((err) => {
        if (!cancelled)
          setGameError(
            err.response?.data?.message || "No se pudo cargar el juego",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  // Fetch plays of this game
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get(API.bgg.PARTIDAS(bggUsername), { params: { page, id: gameId } })
      .then(({ data }) => {
        if (!cancelled) setPlays(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err.response?.data?.message || "No se pudo cargar las partidas",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bggUsername, gameId, page, refreshKey]);

  // Map of bggUsernameLower → TurnoCero user for players on the current page.
  // Same map is used both for the PlayCards in the list and for PlayDetailModal,
  // since the open play's players are always a subset.
  const userMap = useBggUserMap(plays?.plays);

  // Prefer server-aggregated stats over the full history (computed from
  // BggPlay) when present. Falls back to per-page derivation for users
  // served from the BGG XML cache path (no Mongo data yet).
  const stats = useMemo(() => {
    if (plays?.gameStats) {
      const g = plays.gameStats;
      return {
        winRate: g.rated > 0 ? Math.round((g.wins / g.rated) * 100) : null,
        ratedCount: g.rated,
        avgDuration: g.avgDuration ?? null,
        lastPlay: g.lastDate || null,
        source: "server",
      };
    }
    if (!plays || plays.plays.length === 0) {
      return {
        winRate: null,
        ratedCount: 0,
        avgDuration: null,
        lastPlay: null,
        source: "page",
      };
    }
    let wins = 0;
    let totalRated = 0;
    const durations = [];
    let lastPlay = null;
    for (const p of plays.plays) {
      const owner = findOwnerPlayer(p, bggUsername);
      if (owner) {
        totalRated += 1;
        if (owner.win) wins += 1;
      }
      if (p.duration > 0) durations.push(p.duration);
      if (!lastPlay || (p.date && p.date > lastPlay)) lastPlay = p.date;
    }
    return {
      winRate: totalRated > 0 ? Math.round((wins / totalRated) * 100) : null,
      ratedCount: totalRated,
      avgDuration:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
      lastPlay,
      durationsCount: durations.length,
      source: "page",
    };
  }, [plays, bggUsername]);

  const totalPages = plays ? Math.ceil(plays.total / PLAYS_PAGE_SIZE) : 0;
  // "Partial" hint only when stats came from the page-derived fallback AND
  // there are more plays than what we sampled. Server-aggregated stats are
  // never partial.
  const partialStats =
    stats.source === "page" && plays && plays.total > plays.plays.length;

  const handlePage = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={styles.page}>
      {isGuest && <GuestBanner bggUsername={bggUsername} />}
      <div className={styles.inner}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Volver
        </button>

        <div className={styles.gameHero}>
          <div className={styles.gameHeroImage}>
            {game?.image || game?.thumbnail ? (
              <img
                src={game.image || game.thumbnail}
                alt={game.name}
                decoding="async"
              />
            ) : (
              <span className={styles.playThumbFallback}>🎲</span>
            )}
          </div>
          <div className={styles.gameHeroInfo}>
            <Link
              to={`/bg-watch/${encodeURIComponent(bggUsername)}`}
              className={styles.eyebrow}
              style={{ textDecoration: "none" }}
            >
              ◆ {bggUsername}
            </Link>
            <h1 className={styles.heroTitle}>
              {game?.name || (gameError ? "Juego no encontrado" : "…")}
            </h1>
            {game && (
              <div className={styles.gameHeroMeta}>
                {game.year && <span>{game.year}</span>}
                {(game.minPlayers || game.maxPlayers) && (
                  <span>
                    {game.minPlayers &&
                    game.maxPlayers &&
                    game.minPlayers !== game.maxPlayers
                      ? `${game.minPlayers}–${game.maxPlayers} jugadores`
                      : `${game.minPlayers || game.maxPlayers} jugadores`}
                  </span>
                )}
              </div>
            )}
            <a
              href={`https://boardgamegeek.com/boardgame/${gameId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bggLink}
            >
              Ver en BoardGameGeek ↗
            </a>
            {canCreate && game && (
              <button
                type="button"
                className={styles.newPlayBtn}
                onClick={() => setCreateOpen(true)}
              >
                + Nueva partida de este juego
              </button>
            )}
          </div>
        </div>

        {plays && (
          <div className={styles.statsBar}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Partidas</span>
              <span className={styles.statValue}>{plays.total}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>% de victorias</span>
              <span className={styles.statValue}>
                {stats.winRate !== null ? `${stats.winRate}%` : "—"}
              </span>
              {partialStats && stats.winRate !== null && (
                <span className={styles.statHint}>
                  de últimas {stats.ratedCount}
                </span>
              )}
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Duración media</span>
              <span className={styles.statValue}>
                {stats.avgDuration !== null ? `${stats.avgDuration}m` : "—"}
              </span>
              {partialStats && stats.avgDuration !== null && (
                <span className={styles.statHint}>
                  de últimas {stats.durationsCount}
                </span>
              )}
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Última partida</span>
              <span className={styles.statValueSm}>
                {stats.lastPlay ? formatDate(stats.lastPlay) : "—"}
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div className={styles.stateCenter}>
            <span className={styles.loadingDice}>🎲</span>
            <p>Cargando partidas…</p>
          </div>
        )}

        {error && (
          <div className={styles.stateCenter}>
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {!loading && !error && plays && plays.plays.length === 0 && (
          <div className={styles.stateCenter}>
            <p>No hay partidas de este juego.</p>
          </div>
        )}

        {!loading && plays && plays.plays.length > 0 && (
          <div className={styles.playsList}>
            <div className={styles.playsHeader}>
              <span className={styles.playsTotal}>
                {plays.total} partida{plays.total === 1 ? "" : "s"}
              </span>
              <span className={styles.paginationInfo}>
                página {page} de {totalPages}
              </span>
            </div>
            {plays.plays.map((play) => (
              <PlayCard
                key={play.id}
                play={play}
                userMap={userMap}
                onClick={() => setOpenPlay(play)}
                onEdit={canCreate ? () => setEditingPlay(play) : undefined}
                onDelete={canCreate ? () => setDeletingPlay(play) : undefined}
              />
            ))}
            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={handlePage}
            />
          </div>
        )}

        {isGuest && <GuestFooter bggUsername={bggUsername} />}
      </div>

      {openPlay && (
        <PlayDetailModal
          play={openPlay}
          userMap={userMap}
          onClose={() => setOpenPlay(null)}
        />
      )}

      {createOpen && (
        <CreatePlayModal
          user={user}
          preselectedGame={
            game
              ? {
                  id: game.id,
                  name: game.name,
                  thumbnail: game.thumbnail,
                  year: game.year,
                }
              : null
          }
          onClose={() => setCreateOpen(false)}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {editingPlay && (
        <CreatePlayModal
          user={user}
          editPlay={editingPlay}
          onClose={() => setEditingPlay(null)}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <ConfirmActionModal
        isOpen={!!deletingPlay}
        title="Eliminar partida"
        message={
          deletingPlay
            ? `¿Eliminar la partida del ${deletingPlay.date || "?"}? Esta acción no se puede deshacer y borra la partida en BGG.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeletingPlay(null)}
      />
    </div>
  );
}
