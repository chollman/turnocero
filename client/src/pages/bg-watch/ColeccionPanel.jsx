import { useEffect, useState } from 'react';
import axios from 'axios';
import Pagination from './Pagination';
import styles from './BgWatchProfile.module.css';

const COLLECTION_PAGE_SIZE = 24;

function StarRating({ value }) {
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

export default function ColeccionPanel({ bggUsername, onLoaded }) {
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios.get(`/api/bgg/coleccion/${encodeURIComponent(bggUsername)}`)
      .then(({ data }) => {
        if (cancelled) return;
        setCollection(data);
        if (onLoaded) onLoaded(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'No se pudo cargar la colección');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [bggUsername, onLoaded]);

  const totalPages = collection ? Math.ceil(collection.length / COLLECTION_PAGE_SIZE) : 0;
  const slice = collection
    ? collection.slice((page - 1) * COLLECTION_PAGE_SIZE, page * COLLECTION_PAGE_SIZE)
    : [];

  const handlePage = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.tabContent}>
      {loading && (
        <div className={styles.stateCenter}>
          <span className={styles.loadingDice}>🎲</span>
          <p>Cargando colección…</p>
        </div>
      )}

      {error && (
        <div className={styles.stateCenter}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {!loading && !error && collection && collection.length === 0 && (
        <div className={styles.stateCenter}>
          <p>Este usuario no tiene juegos marcados como propios en BGG.</p>
        </div>
      )}

      {!loading && collection && collection.length > 0 && (
        <>
          <div className={styles.paginationHeader}>
            <span className={styles.paginationInfo}>
              {collection.length} juegos · página {page} de {totalPages}
            </span>
          </div>
          <div className={styles.gameGrid}>
            {slice.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={handlePage} />
        </>
      )}
    </div>
  );
}
