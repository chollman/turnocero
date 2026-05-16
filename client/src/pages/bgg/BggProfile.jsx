import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PlayCard from './PlayCard';
import PlayDetailModal from './PlayDetailModal';
import styles from './BggProfile.module.css';

const COLLECTION_PAGE_SIZE = 24;
const PLAYS_PAGE_SIZE = 10; // server re-paginates BGG's 30-per-page into 10

function formatDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split('-');
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function StarRating({ value }) {
  if (!value) return <span className={styles.ratingNull}>—</span>;
  return <span className={styles.rating}>{Number(value).toFixed(1)}</span>;
}

function StatsBar({ collection, plays }) {
  const totalPartidas = plays?.total ?? null;
  const juegosUnicos = collection?.length ?? null;

  let topGame = null;
  if (collection && collection.length > 0) {
    topGame = collection.reduce((best, g) => (
      (g.numPlays || 0) > (best?.numPlays || 0) ? g : best
    ), null);
    if (!topGame || (topGame.numPlays || 0) === 0) topGame = null;
  }

  const ultimaPartida = plays?.plays?.[0]?.date || null;

  return (
    <div className={styles.statsBar}>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>Partidas</span>
        <span className={styles.statValue}>
          {totalPartidas !== null ? totalPartidas : '—'}
        </span>
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>Juegos únicos</span>
        <span className={styles.statValue}>
          {juegosUnicos !== null ? juegosUnicos : '—'}
        </span>
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>Más jugado</span>
        <span className={styles.statValueSm} title={topGame?.name || ''}>
          {topGame ? topGame.name : '—'}
        </span>
        {topGame && (
          <span className={styles.statHint}>{topGame.numPlays}× partidas</span>
        )}
      </div>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>Última partida</span>
        <span className={styles.statValueSm}>
          {ultimaPartida ? formatDate(ultimaPartida) : '—'}
        </span>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const range = [];
  const delta = 2;
  const left = Math.max(1, page - delta);
  const right = Math.min(totalPages, page + delta);

  if (left > 1) { range.push(1); if (left > 2) range.push('…'); }
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages) { if (right < totalPages - 1) range.push('…'); range.push(totalPages); }

  return (
    <div className={styles.pagination}>
      <button
        className={styles.pageBtn}
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        ‹
      </button>
      {range.map((item, i) =>
        item === '…'
          ? <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>…</span>
          : (
            <button
              key={item}
              className={`${styles.pageBtn} ${item === page ? styles.pageBtnActive : ''}`}
              onClick={() => onPage(item)}
            >
              {item}
            </button>
          )
      )}
      <button
        className={styles.pageBtn}
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
      >
        ›
      </button>
    </div>
  );
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

export default function BggProfile() {
  const { bggUsername } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('partidas');

  // Collection state (all data fetched once, paginated client-side)
  const [collection, setCollection] = useState(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [errorCollection, setErrorCollection] = useState(null);
  const [collectionPage, setCollectionPage] = useState(1);

  // Plays state (server-side pagination)
  const [plays, setPlays] = useState(null);
  const [loadingPlays, setLoadingPlays] = useState(false);
  const [errorPlays, setErrorPlays] = useState(null);
  const [playsPage, setPlaysPage] = useState(1);
  const [openPlay, setOpenPlay] = useState(null);

  useEffect(() => {
    setLoadingCollection(true);
    setErrorCollection(null);
    axios.get(`/api/bgg/coleccion/${encodeURIComponent(bggUsername)}`)
      .then(({ data }) => setCollection(data))
      .catch((err) => setErrorCollection(err.response?.data?.message || 'No se pudo cargar la colección'))
      .finally(() => setLoadingCollection(false));
  }, [bggUsername]);

  const fetchPlays = (page) => {
    setLoadingPlays(true);
    setErrorPlays(null);
    axios.get(`/api/bgg/partidas/${encodeURIComponent(bggUsername)}?page=${page}`)
      .then(({ data }) => setPlays(data))
      .catch((err) => setErrorPlays(err.response?.data?.message || 'No se pudo cargar las partidas'))
      .finally(() => setLoadingPlays(false));
  };

  useEffect(() => {
    fetchPlays(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bggUsername]);

  const handlePlaysPage = (page) => {
    setPlaysPage(page);
    fetchPlays(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCollectionPage = (page) => {
    setCollectionPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Derived collection pagination
  const collectionTotalPages = collection ? Math.ceil(collection.length / COLLECTION_PAGE_SIZE) : 0;
  const collectionSlice = collection
    ? collection.slice((collectionPage - 1) * COLLECTION_PAGE_SIZE, collectionPage * COLLECTION_PAGE_SIZE)
    : [];

  // Derived plays pagination
  const playsTotalPages = plays ? Math.ceil(plays.total / PLAYS_PAGE_SIZE) : 0;

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

        <StatsBar collection={collection} plays={plays} />

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'partidas' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('partidas')}
          >
            Partidas
            {plays && <span className={styles.tabBadge}>{plays.total}</span>}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'coleccion' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('coleccion')}
          >
            Colección
            {collection && <span className={styles.tabBadge}>{collection.length}</span>}
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
              <>
                <div className={styles.paginationHeader}>
                  <span className={styles.paginationInfo}>
                    {collection.length} juegos · página {collectionPage} de {collectionTotalPages}
                  </span>
                </div>
                <div className={styles.gameGrid}>
                  {collectionSlice.map((game) => (
                    <GameCard key={game.id} game={game} />
                  ))}
                </div>
                <Pagination
                  page={collectionPage}
                  totalPages={collectionTotalPages}
                  onPage={handleCollectionPage}
                />
              </>
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
                  <span className={styles.paginationInfo}>
                    página {playsPage} de {playsTotalPages}
                  </span>
                </div>
                {plays.plays.map((play) => (
                  <PlayCard
                    key={play.id}
                    play={play}
                    onClick={() => setOpenPlay(play)}
                  />
                ))}
                <Pagination
                  page={playsPage}
                  totalPages={playsTotalPages}
                  onPage={handlePlaysPage}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {openPlay && (
        <PlayDetailModal play={openPlay} onClose={() => setOpenPlay(null)} />
      )}
    </div>
  );
}
