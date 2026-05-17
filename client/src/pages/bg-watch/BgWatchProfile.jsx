import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ConfirmActionModal from '../../components/shared/ConfirmActionModal';
import PartidasPanel from './PartidasPanel';
import ColeccionPanel from './ColeccionPanel';
import PlayDetailModal from './PlayDetailModal';
import CreatePlayModal from './CreatePlayModal';
import styles from './BgWatchProfile.module.css';

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

export default function BgWatchProfile() {
  const { bggUsername } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('partidas');
  const [collection, setCollection] = useState(null);
  const [playsMeta, setPlaysMeta] = useState(null);
  const [openPlay, setOpenPlay] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlay, setEditingPlay] = useState(null);
  const [deletingPlay, setDeletingPlay] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isOwnProfile = !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || '').toLowerCase();
  const canCreate = isOwnProfile && user?.bggConnected && !user?.bggInvalid;

  // Stable callbacks so panels don't refetch on every render
  const handleCollectionLoaded = useCallback((data) => setCollection(data), []);
  const handlePlaysMeta = useCallback((meta) => setPlaysMeta(meta), []);
  const handlePlayClick = useCallback((play) => setOpenPlay(play), []);
  const handlePlayEdit = useCallback((play) => setEditingPlay(play), []);
  const handlePlayDelete = useCallback((play) => setDeletingPlay(play), []);
  const handleCreated = useCallback(() => setRefreshKey((k) => k + 1), []);

  const confirmDelete = async () => {
    if (!deletingPlay) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/bgg/partidas/${encodeURIComponent(deletingPlay.id)}`);
      setDeletingPlay(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo eliminar la partida.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Volver
        </button>

        <div className={styles.hero}>
          <div className={styles.eyebrow}>◆ BG WATCH</div>
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
            onPlayEdit={canCreate ? handlePlayEdit : undefined}
            onPlayDelete={canCreate ? handlePlayDelete : undefined}
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

      {editingPlay && (
        <CreatePlayModal
          user={user}
          editPlay={editingPlay}
          onClose={() => setEditingPlay(null)}
          onCreated={handleCreated}
        />
      )}

      <ConfirmActionModal
        isOpen={!!deletingPlay}
        title="Eliminar partida"
        message={deletingPlay
          ? `¿Eliminar la partida de "${deletingPlay.gameName}" del ${deletingPlay.date || '?'}? Esta acción no se puede deshacer y borra la partida en BGG.`
          : ''}
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
