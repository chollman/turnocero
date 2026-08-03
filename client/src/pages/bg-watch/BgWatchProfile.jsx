import Meeple from "../../components/shared/Meeple";
import Avatar from "../../components/shared/Avatar";
import { useCallback, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { bgWatchKeys, deleteBgWatchPlay } from "../../queries/bgWatch";
import ConfirmActionModal from "../../components/shared/ConfirmActionModal";
import BackButton from "../../components/shared/BackButton";
import PartidasPanel from "./PartidasPanel";
import BgWatchTabSelect from "./BgWatchTabSelect";
import ColeccionPanel from "./ColeccionPanel";
import JugadoresPanel from "./JugadoresPanel";
import UbicacionesPanel from "./UbicacionesPanel";
import StatsBar from "./StatsBar";
import { GuestBanner, GuestInlineCTA, GuestFooter } from "./BgWatchGuestCTAs";
import BgWatchSessionNotice from "./BgWatchSessionNotice";
import styles from "./BgWatchProfile.module.css";

export default function BgWatchProfile() {
  const { bggUsername } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation("bgwatch");
  const queryClient = useQueryClient();

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
  const [deletingPlay, setDeletingPlay] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
  // El detalle ahora es una página con ruta propia (compartible por short link).
  const handlePlayClick = useCallback(
    (play) => navigate(`/bg-watch/${bggUsername}/partidas/${play.id}`),
    [navigate, bggUsername],
  );
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
  const goToNewPlay = useCallback(
    () =>
      navigate(
        `/bg-watch/${bggUsername}/partidas/nueva?volver=${encodeURIComponent(
          location.pathname,
        )}`,
      ),
    [navigate, bggUsername, location.pathname],
  );

  // Tabs de sección. `badge` se muestra sólo cuando hay dato (null = oculto).
  const tabItems = [
    {
      id: "partidas",
      label: t("profile.tabs.partidas"),
      badge: playsMeta ? playsMeta.total : null,
    },
    {
      id: "coleccion",
      label: t("profile.tabs.coleccion"),
      badge: collection ? collection.length : null,
    },
    ...(canManagePlayers
      ? [
          {
            id: "jugadores",
            label: t("profile.tabs.jugadores"),
            badge: playersTotal,
          },
        ]
      : []),
    ...(canManagePlayers
      ? [
          {
            id: "ubicaciones",
            label: t("profile.tabs.ubicaciones"),
            badge: locationsTotal,
          },
        ]
      : []),
  ];

  const confirmDelete = async () => {
    if (!deletingPlay) return;
    setDeleting(true);
    try {
      await deleteBgWatchPlay(deletingPlay.id);
      setDeletingPlay(null);
      queryClient.invalidateQueries({
        queryKey: [...bgWatchKeys.all, "partidas", bggUsername],
      });
      queryClient.invalidateQueries({
        queryKey: bgWatchKeys.juegosJugados(bggUsername),
      });
      queryClient.invalidateQueries({
        queryKey: bgWatchKeys.resumen(bggUsername),
      });
    } catch (err) {
      alert(err.response?.data?.message || t("profile.deletePlayError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.page}>
      {isGuest && <GuestBanner bggUsername={bggUsername} />}
      <div className={styles.inner}>
        <BackButton onClick={() => navigate(-1)} flush>
          {t("common.back")}
        </BackButton>

        <div className={styles.hero}>
          <div className={styles.heroAvatar}>
            <Avatar
              user={
                isOwnProfile && user
                  ? user
                  : { _id: bggUsername, username: bggUsername }
              }
              size="xl"
            />
          </div>
          <div className={styles.heroMain}>
            <div className={styles.eyebrow}>
              <Meeple />
              {t("common.bgWatchBrand")} ·{" "}
              {isOwnProfile
                ? t("profile.eyebrowOwn")
                : t("profile.eyebrowPublic")}
            </div>
            <h1 className={styles.heroTitle}>{bggUsername}</h1>
            <div className={styles.heroLinks}>
              <a
                href={`https://boardgamegeek.com/user/${bggUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.bggLink}
              >
                {t("profile.viewOnBgg")}
                <span className={styles.bggLinkIcon}> ↗</span>
              </a>
              {/* "Ver la comunidad" vive dentro del hero en desktop; en mobile
                  se oculta acá y se muestra la copia de fuera del hero. */}
              <Link
                to="/bg-watch/comunidad"
                className={`${styles.bggLink} ${styles.comunidadInline}`}
              >
                {t("profile.viewCommunityInline")}
              </Link>
              {/* En mobile "Nueva partida" ocupa el lugar que dejó "Ver la
                  comunidad" (en desktop usa la columna de acciones del hero). */}
              {canCreate && (
                <button
                  type="button"
                  className={`${styles.newPlayBtn} ${styles.newPlayInline}`}
                  onClick={goToNewPlay}
                >
                  {t("profile.newPlay")}
                </button>
              )}
            </div>
          </div>
          {canCreate && (
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.newPlayBtn}
                onClick={goToNewPlay}
              >
                {t("profile.newPlayPlus")}
              </button>
            </div>
          )}
        </div>

        {/* En mobile "Ver la comunidad" se muestra por fuera del hero como CTA
            secundario (su lugar adentro lo ocupa "Nueva partida"). En desktop
            esta copia se oculta — el link vive dentro del hero. */}
        <Link to="/bg-watch/comunidad" className={styles.comunidadBtn}>
          <Meeple />
          {t("profile.viewCommunity")}
          <span className={styles.comunidadArrow} aria-hidden="true">
            →
          </span>
        </Link>

        {sessionExpired && <BgWatchSessionNotice />}

        <StatsBar collection={collection} playsMeta={playsMeta} />

        {isGuest && <GuestInlineCTA />}

        {/* Misma lista para la fila de tabs (desktop) y el dropdown (mobile);
            la visibilidad la resuelve el CSS (.tabs vs .tabSelect en --phone). */}
        <div className={styles.tabs}>
          {tabItems.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ""}`}
              onClick={() => goToTab(t.id)}
            >
              {t.label}
              {t.badge != null && (
                <span className={styles.tabBadge}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
        <BgWatchTabSelect
          tabs={tabItems}
          activeId={activeTab}
          onSelect={goToTab}
        />

        {/* Both panels mounted (preserve state when switching tabs) */}
        <div style={{ display: activeTab === "partidas" ? "block" : "none" }}>
          <PartidasPanel
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

      <ConfirmActionModal
        isOpen={!!deletingPlay}
        title={t("profile.deleteTitle")}
        message={
          deletingPlay
            ? t("profile.deleteMessage", {
                game: deletingPlay.gameName,
                date: deletingPlay.date || "?",
              })
            : ""
        }
        confirmLabel={t("profile.deleteConfirm")}
        cancelLabel={t("common:actions.cancel")}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeletingPlay(null)}
      />
    </div>
  );
}
