import Meeple from "../../components/shared/Meeple";
import { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import PartidasPanel from "./PartidasPanel";
import ColeccionPanel from "./ColeccionPanel";
import PlayDetailModal from "./PlayDetailModal";
import CreatePlayModal from "./CreatePlayModal";
import StatsBar from "./StatsBar";
import useBggUserMap from "./useBggUserMap";
import { GuestBanner, GuestInlineCTA, GuestFooter } from "./BgWatchGuestCTAs";
import styles from "./BgWatchProfile.module.css";

export default function BgWatchProfile() {
  const { bggUsername } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("partidas");
  const [collection, setCollection] = useState(null);
  const [playsMeta, setPlaysMeta] = useState(null);
  const [openPlay, setOpenPlay] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlay, setEditingPlay] = useState(null);
  const [deletingPlay, setDeletingPlay] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isOwnProfile =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canCreate = isOwnProfile && user?.bggConnected && !user?.bggInvalid;
  // Manual "Actualizar" button visibility — owner or admin only. Uses the
  // EFFECTIVE user.isAdmin (modified by AdminViewToggle), not isActuallyAdmin,
  // so admins previewing "Ver como usuario" see what a regular user sees
  // (no refresh button on other people's profiles). Cooldown is
  // server-enforced; admins respect it too.
  const canRefresh = isOwnProfile || !!user?.isAdmin;
  const isGuest = !user;

  // Stable callbacks so panels don't refetch on every render
  const handleCollectionLoaded = useCallback((data) => setCollection(data), []);
  const handlePlaysMeta = useCallback((meta) => setPlaysMeta(meta), []);
  const handlePlayClick = useCallback((play) => setOpenPlay(play), []);
  const handlePlayEdit = useCallback((play) => setEditingPlay(play), []);
  const handlePlayDelete = useCallback((play) => setDeletingPlay(play), []);
  const handleCreated = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Small separate userMap fetch for the open play's players (PartidasPanel keeps
  // its own map for the list). Cheap because it's at most ~10 usernames.
  const modalUserMap = useBggUserMap(openPlay ? [openPlay] : null);

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

  return (
    <div className={styles.page}>
      {isGuest && <GuestBanner bggUsername={bggUsername} />}
      <div className={styles.inner}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Volver
        </button>

        <div className={styles.hero}>
          <div className={styles.eyebrow}><Meeple />BG WATCH</div>
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

        {isGuest && <GuestInlineCTA />}

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "partidas" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("partidas")}
          >
            Partidas
            {playsMeta && (
              <span className={styles.tabBadge}>{playsMeta.total}</span>
            )}
          </button>
          <button
            className={`${styles.tab} ${activeTab === "coleccion" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("coleccion")}
          >
            Colección
            {collection && (
              <span className={styles.tabBadge}>{collection.length}</span>
            )}
          </button>
        </div>

        {/* Both panels mounted (preserve state when switching tabs) */}
        <div style={{ display: activeTab === "partidas" ? "block" : "none" }}>
          <PartidasPanel
            key={`partidas-${refreshKey}`}
            bggUsername={bggUsername}
            collection={collection}
            onPlayClick={handlePlayClick}
            onPlayEdit={canCreate ? handlePlayEdit : undefined}
            onPlayDelete={canCreate ? handlePlayDelete : undefined}
            onMetaChange={handlePlaysMeta}
            canRefresh={canRefresh}
          />
        </div>
        <div style={{ display: activeTab === "coleccion" ? "block" : "none" }}>
          <ColeccionPanel
            bggUsername={bggUsername}
            onLoaded={handleCollectionLoaded}
            canRefresh={canRefresh}
          />
        </div>

        {isGuest && <GuestFooter bggUsername={bggUsername} />}
      </div>

      {openPlay && (
        <PlayDetailModal
          play={openPlay}
          userMap={modalUserMap}
          onClose={() => setOpenPlay(null)}
        />
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
        message={
          deletingPlay
            ? `¿Eliminar la partida de "${deletingPlay.gameName}" del ${deletingPlay.date || "?"}? Esta acción no se puede deshacer y borra la partida en BGG.`
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
