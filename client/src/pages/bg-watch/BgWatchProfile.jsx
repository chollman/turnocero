import Meeple from "../../components/shared/Meeple";
import { useCallback, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import PartidasPanel from "./PartidasPanel";
import ColeccionPanel from "./ColeccionPanel";
import JugadoresPanel from "./JugadoresPanel";
import UbicacionesPanel from "./UbicacionesPanel";
import PlayDetailModal from "./PlayDetailModal";
import StatsBar from "./StatsBar";
import useBggUserMap from "./useBggUserMap";
import { GuestBanner, GuestInlineCTA, GuestFooter } from "./BgWatchGuestCTAs";
import BgWatchSessionNotice from "./BgWatchSessionNotice";
import styles from "./BgWatchProfile.module.css";

export default function BgWatchProfile() {
  const { bggUsername } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // La tab activa se deriva de la URL para que /partidas y /coleccion sean
  // deep-linkeables (caer directo en cada vista). Default = partidas.
  const activeTab = location.pathname.endsWith("/coleccion")
    ? "coleccion"
    : location.pathname.endsWith("/jugadores")
      ? "jugadores"
      : location.pathname.endsWith("/ubicaciones")
        ? "ubicaciones"
        : "partidas";
  const goToTab = (tab) =>
    navigate(`/bg-watch/${bggUsername}/${tab}`, { replace: true });

  const [collection, setCollection] = useState(null);
  const [playsMeta, setPlaysMeta] = useState(null);
  const [playersTotal, setPlayersTotal] = useState(null);
  const [locationsTotal, setLocationsTotal] = useState(null);
  const [openPlay, setOpenPlay] = useState(null);
  const [deletingPlay, setDeletingPlay] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isOwnProfile =
    !!user?.bggUsername &&
    user.bggUsername.toLowerCase() === (bggUsername || "").toLowerCase();
  const canCreate = isOwnProfile && user?.bggConnected && !user?.bggInvalid;
  // El dueño está conectado pero su sesión BGG caducó (cambió el pass en
  // BGG.com → 401 → `invalid: true`). El password sigue guardado, pero ya no
  // sirve: no puede cargar partidas hasta reconectar. Le avisamos y guiamos.
  const sessionExpired =
    isOwnProfile && user?.bggConnected && !!user?.bggInvalid;
  // Manual "Actualizar" button visibility — owner or admin only. Uses the
  // EFFECTIVE user.isAdmin (modified by AdminViewToggle), not isActuallyAdmin,
  // so admins previewing "Ver como usuario" see what a regular user sees
  // (no refresh button on other people's profiles). Cooldown is
  // server-enforced; admins respect it too.
  const canRefresh = isOwnProfile || !!user?.isAdmin;
  // La pestaña "Jugadores" (curar nombres/avatares/fusiones) es solo del dueño
  // o admin — no se muestra en perfiles ajenos.
  const canManagePlayers = isOwnProfile || !!user?.isAdmin;
  const isGuest = !user;

  // Stable callbacks so panels don't refetch on every render
  const handleCollectionLoaded = useCallback((data) => setCollection(data), []);
  const handlePlaysMeta = useCallback((meta) => setPlaysMeta(meta), []);
  const handlePlayersTotal = useCallback((total) => setPlayersTotal(total), []);
  const handleLocationsTotal = useCallback(
    (total) => setLocationsTotal(total),
    [],
  );
  const handlePlayClick = useCallback((play) => setOpenPlay(play), []);
  const handlePlayEdit = useCallback(
    (play) =>
      navigate(`/bg-watch/${bggUsername}/partidas/${play.id}/editar`, {
        state: { play },
      }),
    [navigate, bggUsername],
  );
  const handlePlayDelete = useCallback((play) => setDeletingPlay(play), []);
  // "Cargar otra" del mismo juego: deep-link al form prefijando el juego, con
  // `volver` a la tab actual (para no caer en la vista por-juego al volver).
  const handlePlayLogAnother = useCallback(
    (play) =>
      navigate(
        `/bg-watch/${bggUsername}/partidas/nueva?juego=${play.gameId}&volver=${encodeURIComponent(
          location.pathname,
        )}`,
      ),
    [navigate, bggUsername, location.pathname],
  );

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
          <div className={styles.eyebrow}>
            <Meeple />
            BG WATCH
          </div>
          <h1 className={styles.heroTitle}>{bggUsername}</h1>
          <div className={styles.heroLinks}>
            <a
              href={`https://boardgamegeek.com/user/${bggUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bggLink}
            >
              Ver en BoardGameGeek ↗
            </a>
            <Link to="/bg-watch/comunidad" className={styles.bggLink}>
              Ver la comunidad →
            </Link>
          </div>
          {canCreate && (
            <button
              type="button"
              className={styles.newPlayBtn}
              onClick={() =>
                navigate(
                  `/bg-watch/${bggUsername}/partidas/nueva?volver=${encodeURIComponent(
                    location.pathname,
                  )}`,
                )
              }
            >
              + Nueva partida
            </button>
          )}
        </div>

        {sessionExpired && <BgWatchSessionNotice />}

        <StatsBar collection={collection} playsMeta={playsMeta} />

        {isGuest && <GuestInlineCTA />}

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "partidas" ? styles.tabActive : ""}`}
            onClick={() => goToTab("partidas")}
          >
            Partidas
            {playsMeta && (
              <span className={styles.tabBadge}>{playsMeta.total}</span>
            )}
          </button>
          <button
            className={`${styles.tab} ${activeTab === "coleccion" ? styles.tabActive : ""}`}
            onClick={() => goToTab("coleccion")}
          >
            Colección
            {collection && (
              <span className={styles.tabBadge}>{collection.length}</span>
            )}
          </button>
          {canManagePlayers && (
            <button
              className={`${styles.tab} ${activeTab === "jugadores" ? styles.tabActive : ""}`}
              onClick={() => goToTab("jugadores")}
            >
              Jugadores
              {playersTotal != null && (
                <span className={styles.tabBadge}>{playersTotal}</span>
              )}
            </button>
          )}
          {canManagePlayers && (
            <button
              className={`${styles.tab} ${activeTab === "ubicaciones" ? styles.tabActive : ""}`}
              onClick={() => goToTab("ubicaciones")}
            >
              Ubicaciones
              {locationsTotal != null && (
                <span className={styles.tabBadge}>{locationsTotal}</span>
              )}
            </button>
          )}
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
            onPlayLogAnother={canCreate ? handlePlayLogAnother : undefined}
            onMetaChange={handlePlaysMeta}
            canRefresh={canRefresh}
          />
        </div>
        <div style={{ display: activeTab === "coleccion" ? "block" : "none" }}>
          <ColeccionPanel
            bggUsername={bggUsername}
            onLoaded={handleCollectionLoaded}
            canRefresh={canRefresh}
            canCreate={canCreate}
          />
        </div>
        {canManagePlayers && (
          <div
            style={{ display: activeTab === "jugadores" ? "block" : "none" }}
          >
            <JugadoresPanel
              bggUsername={bggUsername}
              onTotalChange={handlePlayersTotal}
            />
          </div>
        )}
        {canManagePlayers && (
          <div
            style={{ display: activeTab === "ubicaciones" ? "block" : "none" }}
          >
            <UbicacionesPanel
              bggUsername={bggUsername}
              onTotalChange={handleLocationsTotal}
            />
          </div>
        )}

        {isGuest && <GuestFooter bggUsername={bggUsername} />}
      </div>

      {openPlay && (
        <PlayDetailModal
          play={openPlay}
          userMap={modalUserMap}
          onClose={() => setOpenPlay(null)}
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
