import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import PlayCard from './PlayCard';
import PlayDetailModal from './PlayDetailModal';
import Pagination from './Pagination';
import styles from './BggProfile.module.css';

const PLAYS_PAGE_SIZE = 10;

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function findOwnerPlayer(play, bggUsername) {
  if (!play?.players || !bggUsername) return null;
  const lower = bggUsername.toLowerCase();
  return play.players.find((p) => (p.username || '').toLowerCase() === lower) || null;
}

export default function PerGameView() {
  const { bggUsername, gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [gameError, setGameError] = useState(null);

  const [plays, setPlays] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  const [openPlay, setOpenPlay] = useState(null);

  // Fetch game details (uses /game/:id cache — likely hit if user came from Partidas)
  useEffect(() => {
    let cancelled = false;
    setGameError(null);
    axios.get(`/api/bgg/game/${encodeURIComponent(gameId)}`)
      .then(({ data }) => { if (!cancelled) setGame(data); })
      .catch((err) => {
        if (!cancelled) setGameError(err.response?.data?.message || 'No se pudo cargar el juego');
      });
    return () => { cancelled = true; };
  }, [gameId]);

  // Fetch plays of this game
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), id: gameId });
    axios.get(`/api/bgg/partidas/${encodeURIComponent(bggUsername)}?${params.toString()}`)
      .then(({ data }) => { if (!cancelled) setPlays(data); })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'No se pudo cargar las partidas');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bggUsername, gameId, page]);

  // Stats derived from the current page (with note when partial)
  const stats = useMemo(() => {
    if (!plays || plays.plays.length === 0) {
      return { wins: 0, totalRated: 0, durations: [], lastPlay: null };
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
    return { wins, totalRated, durations, lastPlay };
  }, [plays, bggUsername]);

  const winRate = stats.totalRated > 0 ? Math.round((stats.wins / stats.totalRated) * 100) : null;
  const avgDuration = stats.durations.length > 0
    ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
    : null;

  const totalPages = plays ? Math.ceil(plays.total / PLAYS_PAGE_SIZE) : 0;
  const partialStats = plays && plays.total > plays.plays.length;

  const handlePage = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Volver
        </button>

        <div className={styles.gameHero}>
          <div className={styles.gameHeroImage}>
            {game?.image || game?.thumbnail ? (
              <img src={game.image || game.thumbnail} alt={game.name} />
            ) : (
              <span className={styles.playThumbFallback}>🎲</span>
            )}
          </div>
          <div className={styles.gameHeroInfo}>
            <Link
              to={`/perfil-bgg/${encodeURIComponent(bggUsername)}`}
              className={styles.eyebrow}
              style={{ textDecoration: 'none' }}
            >
              ◆ {bggUsername}
            </Link>
            <h1 className={styles.heroTitle}>{game?.name || (gameError ? 'Juego no encontrado' : '…')}</h1>
            {game && (
              <div className={styles.gameHeroMeta}>
                {game.year && <span>{game.year}</span>}
                {(game.minPlayers || game.maxPlayers) && (
                  <span>
                    {game.minPlayers && game.maxPlayers && game.minPlayers !== game.maxPlayers
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
          </div>
        </div>

        {plays && (
          <div className={styles.statsBar}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Partidas</span>
              <span className={styles.statValue}>{plays.total}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Win rate</span>
              <span className={styles.statValue}>
                {winRate !== null ? `${winRate}%` : '—'}
              </span>
              {partialStats && winRate !== null && (
                <span className={styles.statHint}>de últimas {stats.totalRated}</span>
              )}
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Duración media</span>
              <span className={styles.statValue}>
                {avgDuration !== null ? `${avgDuration}m` : '—'}
              </span>
              {partialStats && avgDuration !== null && (
                <span className={styles.statHint}>de últimas {stats.durations.length}</span>
              )}
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Última partida</span>
              <span className={styles.statValueSm}>
                {stats.lastPlay ? formatDate(stats.lastPlay) : '—'}
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
                {plays.total} partida{plays.total === 1 ? '' : 's'}
              </span>
              <span className={styles.paginationInfo}>
                página {page} de {totalPages}
              </span>
            </div>
            {plays.plays.map((play) => (
              <PlayCard
                key={play.id}
                play={play}
                onClick={() => setOpenPlay(play)}
              />
            ))}
            <Pagination page={page} totalPages={totalPages} onPage={handlePage} />
          </div>
        )}
      </div>

      {openPlay && (
        <PlayDetailModal play={openPlay} onClose={() => setOpenPlay(null)} />
      )}
    </div>
  );
}
