import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './BggProfile.module.css';

function formatDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split('-');
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function StarRating({ value, max = 10 }) {
  if (!value) return <span className={styles.ratingNull}>—</span>;
  return <span className={styles.rating}>{Number(value).toFixed(1)}</span>;
}

function GameCard({ game }) {
  return (
    <div className={styles.gameCard}>
      {game.thumbnail
        ? <img src={game.thumbnail} alt={game.name} className={styles.gameThumbnail} loading="lazy" />
        : <div className={styles.gameThumbnailPlaceholder}>🎲</div>
      }
      <div className={styles.gameInfo}>
        <div className={styles.gameName}>{game.name}</div>
        {game.yearPublished && (
          <div className={styles.gameYear}>{game.yearPublished}</div>
        )}
        <div className={styles.gameRatings}>
          <span className={styles.ratingBlock}>
            <span className={styles.ratingLabel}>Tu nota</span>
            <StarRating value={game.userRating} />
          </span>
          <span className={styles.ratingBlock}>
            <span className={styles.ratingLabel}>BGG</span>
            <StarRating value={game.bggRating} />
          </span>
          {game.numPlays > 0 && (
            <span className={styles.ratingBlock}>
              <span className={styles.ratingLabel}>Partidas</span>
              <span className={styles.rating}>{game.numPlays}×</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayRow({ play }) {
  return (
    <div className={styles.playRow}>
      <div className={styles.playDate}>{formatDate(play.date) || '—'}</div>
      <div className={styles.playGame}>{play.gameName || '—'}</div>
      <div className={styles.playMeta}>
        {play.quantity > 1 && <span className={styles.playTag}>{play.quantity}× partidas</span>}
        {play.duration > 0 && <span className={styles.playTag}>{play.duration} min</span>}
        {play.location && <span className={styles.playTag}>{play.location}</span>}
      </div>
    </div>
  );
}

export default function BggProfile() {
  const { bggUsername } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('coleccion');
  const [collection, setCollection] = useState(null);
  const [plays, setPlays] = useState(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [loadingPlays, setLoadingPlays] = useState(false);
  const [errorCollection, setErrorCollection] = useState(null);
  const [errorPlays, setErrorPlays] = useState(null);

  useEffect(() => {
    setLoadingCollection(true);
    setErrorCollection(null);
    axios.get(`/api/bgg/coleccion/${encodeURIComponent(bggUsername)}`)
      .then(({ data }) => setCollection(data))
      .catch((err) => setErrorCollection(err.response?.data?.message || 'No se pudo cargar la colección'))
      .finally(() => setLoadingCollection(false));
  }, [bggUsername]);

  const handleTabPlays = () => {
    setActiveTab('partidas');
    if (plays || loadingPlays) return;
    setLoadingPlays(true);
    setErrorPlays(null);
    axios.get(`/api/bgg/partidas/${encodeURIComponent(bggUsername)}`)
      .then(({ data }) => setPlays(data))
      .catch((err) => setErrorPlays(err.response?.data?.message || 'No se pudo cargar las partidas'))
      .finally(() => setLoadingPlays(false));
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Volver
        </button>

        <div className={styles.hero}>
          <div className={styles.eyebrow}>◆ PERFIL BGG</div>
          <h1 className={styles.heroTitle}>{bggUsername}</h1>
          <a
            href={`https://boardgamegeek.com/user/${bggUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.bggLink}
          >
            Ver en BoardGameGeek ↗
          </a>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'coleccion' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('coleccion')}
          >
            Colección
            {collection && <span className={styles.tabBadge}>{collection.length}</span>}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'partidas' ? styles.tabActive : ''}`}
            onClick={handleTabPlays}
          >
            Partidas
            {plays && <span className={styles.tabBadge}>{plays.total}</span>}
          </button>
        </div>

        {activeTab === 'coleccion' && (
          <div className={styles.tabContent}>
            {loadingCollection && (
              <div className={styles.stateCenter}>
                <span className={styles.loadingDice}>🎲</span>
                <p>Cargando colección…</p>
              </div>
            )}
            {errorCollection && (
              <div className={styles.stateCenter}>
                <p className={styles.errorText}>{errorCollection}</p>
              </div>
            )}
            {collection && collection.length === 0 && (
              <div className={styles.stateCenter}>
                <p>Este usuario no tiene juegos marcados como propios en BGG.</p>
              </div>
            )}
            {collection && collection.length > 0 && (
              <div className={styles.gameGrid}>
                {collection.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'partidas' && (
          <div className={styles.tabContent}>
            {loadingPlays && (
              <div className={styles.stateCenter}>
                <span className={styles.loadingDice}>🎲</span>
                <p>Cargando partidas…</p>
              </div>
            )}
            {errorPlays && (
              <div className={styles.stateCenter}>
                <p className={styles.errorText}>{errorPlays}</p>
              </div>
            )}
            {plays && plays.plays.length === 0 && (
              <div className={styles.stateCenter}>
                <p>Este usuario no tiene partidas registradas en BGG.</p>
              </div>
            )}
            {plays && plays.plays.length > 0 && (
              <div className={styles.playsList}>
                <div className={styles.playsHeader}>
                  <span className={styles.playsTotal}>{plays.total} partidas registradas</span>
                </div>
                {plays.plays.map((play) => (
                  <PlayRow key={play.id} play={play} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
