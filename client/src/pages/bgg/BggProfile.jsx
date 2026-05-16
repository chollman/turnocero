import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PartidasPanel from './PartidasPanel';
import ColeccionPanel from './ColeccionPanel';
import PlayDetailModal from './PlayDetailModal';
import CreatePlayModal from './CreatePlayModal';
import styles from './BggProfile.module.css';

function formatDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split('-');
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function StatsBar({ collection, playsMeta }) {
  const totalPartidas = playsMeta?.total ?? null;
  const juegosUnicos = collection?.length ?? null;

  let topGame = null;
  if (collection && collection.length > 0) {
    topGame = collection.reduce((best, g) => (
      (g.numPlays || 0) > (best?.numPlays || 0) ? g : best
    ), null);
    if (!topGame || (topGame.numPlays || 0) === 0) topGame = null;
  }

  const ultimaPartida = playsMeta?.lastDate || null;

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

export default function BggProfile() {
  const { bggUsername } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('partidas');
  const [collection, setCollection] = useState(null);
  const [playsMeta, setPlaysMeta] = useState(null);
  const [openPlay, setOpenPlay] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isOwnProfile = !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || '').toLowerCase();
  const canCreate = isOwnProfile && user?.bggConnected && !user?.bggInvalid;

  // Stable callbacks so panels don't refetch on every render
  const handleCollectionLoaded = useCallback((data) => setCollection(data), []);
  const handlePlaysMeta = useCallback((meta) => setPlaysMeta(meta), []);
  const handlePlayClick = useCallback((play) => setOpenPlay(play), []);
  const handleCreated = useCallback(() => setRefreshKey((k) => k + 1), []);

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
          {canCreate && (
            <button
              type="button"
              className={styles.newPlayBtn}
              onClick={() => setCreateOpen(true)}
            >
              + Nueva partida
            </button>
          )}
        </div>

        <StatsBar collection={collection} playsMeta={playsMeta} />

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'partidas' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('partidas')}
          >
            Partidas
            {playsMeta && <span className={styles.tabBadge}>{playsMeta.total}</span>}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'coleccion' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('coleccion')}
          >
            Colección
            {collection && <span className={styles.tabBadge}>{collection.length}</span>}
          </button>
        </div>

        {/* Both panels mounted (preserve state when switching tabs) */}
        <div style={{ display: activeTab === 'partidas' ? 'block' : 'none' }}>
          <PartidasPanel
            key={`partidas-${refreshKey}`}
            bggUsername={bggUsername}
            collection={collection}
            onPlayClick={handlePlayClick}
            onMetaChange={handlePlaysMeta}
          />
        </div>
        <div style={{ display: activeTab === 'coleccion' ? 'block' : 'none' }}>
          <ColeccionPanel
            bggUsername={bggUsername}
            onLoaded={handleCollectionLoaded}
          />
        </div>
      </div>

      {openPlay && (
        <PlayDetailModal play={openPlay} onClose={() => setOpenPlay(null)} />
      )}

      {createOpen && (
        <CreatePlayModal
          user={user}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
