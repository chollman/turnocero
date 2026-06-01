import Meeple from "../../components/shared/Meeple";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import MesaTile from "../../components/shared/MesaTile";
import TableMap from "../../components/shared/TableMap";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import Avatar from "../../components/shared/Avatar";
import InfoTooltip from "../../components/shared/InfoTooltip";
import { getUserDisplay, DELETED_USER_LABEL } from "../../utils/userDisplay";
import { formatDistanceKm } from "../../utils/distance";
import { getLocationDisplay } from "../../utils/location";
import { dateParts } from "../../utils/eventoDate";
import { hashStringToInt } from "../../utils/hash";
import TableDetailSkeleton from "./TableDetailSkeleton";
import TableChat from "./TableChat";
import TableComments from "./TableComments";
import TableGallery from "./TableGallery";
import TableRatings from "./TableRatings";
import TableTutorials from "./TableTutorials";
import TableBga from "./TableBga";
import MesaStub from "./MesaStub";
import styles from "./TableDetail.module.css";

// Small inline link next to a player's name when they have an active BG Watch.
function PlayerBgWatchLink({ user }) {
  if (!user?.bggUsername) return null;
  return (
    <Link
      to={`/bg-watch/${encodeURIComponent(user.bggUsername)}`}
      className={styles.playerBgWatch}
      title={`Ver historial de partidas de @${user.username}`}
      aria-label={`Ver BG Watch de ${user.username}`}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    </Link>
  );
}

const LockIcon = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UsersIcon = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ChairIcon = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 19v2M18 19v2" />
    <path d="M6 19h12" />
    <path d="M5 12h14v7H5z" />
    <path d="M7 12V8a5 5 0 0 1 10 0v4" />
  </svg>
);

const CommentIcon = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BellIcon = ({ size = 13, filled = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function TableDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { setActiveTable, addToast } = useNotifications();
  const navigate = useNavigate();

  const [table, setTable] = useState(null);
  const [loadingTable, setLoadingTable] = useState(true);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestError, setRequestError] = useState("");
  const [requestLoading, setRequestLoading] = useState(null);

  const [joinLoading, setJoinLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [cancelTableLoading, setCancelTableLoading] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState("");
  const [accessError, setAccessError] = useState("");
  // Default "fotos" desde que el chat se movió al stub del aside; los tabs
  // restantes en mobile sólo alternan fotos / reseñas en main.
  const [mobileTab, setMobileTab] = useState("fotos");
  // Avg + count bubblean desde TableRatings para poder pintarlos en el
  // sectionHead de "Valoraciones".
  const [ratingsSummary, setRatingsSummary] = useState({
    avg: null,
    count: 0,
  });
  // Cantidad de comentarios bubbleada desde TableComments para el
  // sectionHead de "Comentarios".
  const [commentsCount, setCommentsCount] = useState(0);

  const isParticipant = useCallback(
    (t) => {
      if (!t || !user) return false;
      const uid = user._id.toString();
      return (
        t.host?._id?.toString() === uid ||
        t.players.some((p) => p && (p._id || p).toString() === uid)
      );
    },
    [user],
  );

  useEffect(() => {
    setActiveTable(id);
    return () => setActiveTable(null);
  }, [id, setActiveTable]);

  useEffect(() => {
    const ac = new AbortController();
    const fetchTable = async () => {
      try {
        const { data } = await axios.get(API.tables.DETAIL(id), {
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (
          data.privacy === "private" &&
          !isParticipant(data) &&
          !user?.isAdmin
        ) {
          navigate("/", { replace: true });
          return;
        }
        setTable(data);
        setPendingRequests(data.pendingRequests || []);
      } catch (err) {
        if (axios.isCancel(err)) return;
        if (err.response?.status === 403) {
          setAccessError("Esta mesa es privada");
        } else {
          navigate("/", { replace: true });
        }
      } finally {
        if (!ac.signal.aborted) setLoadingTable(false);
      }
    };
    fetchTable();
    return () => ac.abort();
    // Intencional: `user`/`isParticipant` cambian con la sesión pero NO
    // queremos refetchear cuando cambia el user — la mesa es la misma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // -- Handlers ---------------------------------------------------------

  const handleRequest = async (userId, action) => {
    setRequestLoading(userId + action);
    setRequestError("");
    try {
      const { data } = await axios.post(
        action === "accept"
          ? API.tables.REQUEST_ACCEPT(id, userId)
          : API.tables.REQUEST_REJECT(id, userId),
      );
      setTable(data);
      setPendingRequests(data.pendingRequests || []);
    } catch (err) {
      setRequestError(
        err.response?.data?.message || "Error al procesar la solicitud",
      );
    } finally {
      setRequestLoading(null);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      setLoginPrompt("Iniciá sesión para seguir esta mesa.");
      return;
    }
    setFollowLoading(true);
    const currentFollowers = table.followers || [];
    const isFollowing = currentFollowers.some(
      (f) => f.toString() === user._id.toString(),
    );
    const newFollowers = isFollowing
      ? currentFollowers.filter((f) => f.toString() !== user._id.toString())
      : [...currentFollowers, user._id];
    setTable((prev) => ({ ...prev, followers: newFollowers }));
    try {
      const { data } = await axios.post(API.tables.FOLLOW(id));
      setTable((prev) => ({ ...prev, followers: data.followers }));
    } catch {
      setTable((prev) => ({ ...prev, followers: currentFollowers }));
      addToast({
        type: "error",
        message: "No pudimos actualizar tu follow. Probá de nuevo.",
      });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleGuestJoin = async () => {
    if (!user) {
      setLoginPrompt("Iniciá sesión para unirte a esta mesa.");
      return;
    }
    setJoinLoading(true);
    try {
      const { data } = await axios.post(API.tables.JOIN(id));
      setTable(data.table);
      setPendingRequests(data.table.pendingRequests || []);
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.message || "Error al unirse",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeave = async () => {
    setLeaveLoading(true);
    try {
      await axios.post(API.tables.LEAVE(id));
      navigate("/");
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.message || "Error al abandonar la mesa",
      });
      setLeaveLoading(false);
    }
  };

  const handleCancelTable = async () => {
    setCancelTableLoading(true);
    try {
      await axios.delete(API.tables.DETAIL(id));
      navigate("/");
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.message || "Error al cancelar la mesa",
      });
      setCancelTableLoading(false);
    }
  };

  const handleCancelJoinRequest = async () => {
    setJoinLoading(true);
    try {
      const { data } = await axios.delete(API.tables.REQUEST(id));
      setTable(data.table);
      setPendingRequests(data.table.pendingRequests || []);
    } catch (err) {
      addToast({
        type: "error",
        message: err.response?.data?.message || "Error al cancelar solicitud",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const handleImagesChange = useCallback((nextImages) => {
    setTable((prev) => ({ ...prev, images: nextImages }));
  }, []);

  // -- Derived ----------------------------------------------------------

  // El "Volver al listado" siempre va a /mesas, sin importar de dónde
  // venga el viewer (deep link, link desde una notif, navegación in-app,
  // o una mesa del evento). Antes había branching para mandar mesas de
  // eventos al detalle del evento — eso confundía al user que llegó a
  // la mesa desde /mesas.
  //
  // El click dispara un slide-out (espejo del slideInFromTop de PageTransition):
  // /mesas/:id → /mesas es same-section y PageTransition no la anima, así que
  // disparamos la animación manualmente y navegamos cuando termina.
  const [exiting, setExiting] = useState(false);
  const goBack = useCallback(() => {
    if (exiting) return;
    setExiting(true);
  }, [exiting]);
  const handlePageAnimationEnd = (e) => {
    if (e.target !== e.currentTarget) return; // ignorar nested animations
    if (e.animationName.includes("tableDetailExit") && exiting) {
      navigate("/mesas");
    }
  };

  const userState = useMemo(() => {
    if (!table) return "idle";
    if (table.status === "cancelled") return "cancelled";
    if (!user) return "anon";
    const uid = user._id.toString();
    if (table.host?._id?.toString() === uid) return "hosting";
    if (table.players.some((p) => (p._id || p).toString() === uid))
      return "joined";
    if (
      (table.pendingRequests || []).some((p) => (p._id || p).toString() === uid)
    )
      return "pending";
    if (table.players.length >= table.maxPlayers) return "full";
    return "idle";
  }, [table, user]);

  if (loadingTable) return <TableDetailSkeleton />;

  if (accessError) {
    return (
      <div
        className={`${styles.page} ${exiting ? styles.pageExit : ""}`}
        onAnimationEnd={handlePageAnimationEnd}
      >
        <div className={styles.inner}>
          <p style={{ fontSize: "2rem" }}>🔒</p>
          <p style={{ color: "var(--text-secondary)" }}>{accessError}</p>
          <button
            className={styles.backBtn}
            onClick={goBack}
            disabled={exiting}
          >
            ← Volver al listado
          </button>
        </div>
      </div>
    );
  }

  if (!table) return null;

  const hostInfo = getUserDisplay(table.host);
  const isViewingAsAdmin =
    user?.isAdmin && !isParticipant(table) && userState !== "hosting";
  const isGuest = !isParticipant(table) && !user?.isAdmin;
  const isHost = userState === "hosting";
  const isPlayer = userState === "joined";
  const isCancelled = table.status === "cancelled";
  const isPrivate = table.privacy === "private";
  const isFriendsOnly = table.privacy === "friends";
  const isPublic = (table.privacy || "public") === "public";
  const isFull = table.players.length >= table.maxPlayers;
  const filled = table.players.length + 1;
  const total = table.maxPlayers + 1;
  const availableSeats = table.maxPlayers - table.players.length;
  // Mesa "finalizada": la fecha programada ya pasó. Para todos menos admin
  // congelamos las acciones (edit/cancel/join/leave/accept/reject). Chat,
  // fotos, comentarios y ratings siguen activos como "post-game".
  //
  // Usamos `user?.isAdmin` (effective) y NO `isActuallyAdmin` (DB flag real)
  // — cuando el admin está en modo "Ver como usuario" queremos que pierda
  // el override y experimente el freeze como cualquier user normal. Esa es
  // toda la idea del preview. Ver feedback_admin_view_as_user.md.
  //
  // `new Date(...)` en lugar de `Date.now()` para evitar el lint de purity
  // (regla react-hooks/purity); semánticamente equivalente para esta
  // comparación.
  const isPastMesa = new Date(table.date) < new Date();
  const isFrozen = isPastMesa && !user?.isAdmin;

  const locationTexto = getLocationDisplay(table.location, "regular");
  const distanceLabel = formatDistanceKm(table.distanceKm);
  const isFollowing =
    user &&
    (table.followers || []).some((f) => f.toString() === user._id.toString());
  const seed = hashStringToInt(table._id || "");
  const useImage = Boolean(table.bggImage);
  const dParts = dateParts(table.date);

  // Cuando la mesa ya pasó y el viewer no es admin, el MesaStub renderiza
  // el estado congelado en lugar del CTA habitual — sin importar si era
  // host/joined/pending/idle/full. Admin ve el badge "Finalizada" pero
  // conserva sus controles (state = userState normal).
  const stubUserState = isCancelled
    ? "cancelled"
    : isFrozen
      ? "past"
      : !user
        ? "anon"
        : userState;

  const showChat = isHost || isPlayer;
  const showAdminBanner = isViewingAsAdmin;

  return (
    <>
      <LoginPromptModal
        isOpen={!!loginPrompt}
        onClose={() => setLoginPrompt("")}
        message={loginPrompt}
      />
      <div
        className={`${styles.page} ${exiting ? styles.pageExit : ""}`}
        onAnimationEnd={handlePageAnimationEnd}
      >
        <div className={styles.inner}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={goBack}
            disabled={exiting}
          >
            ← Volver al listado
          </button>

          {showAdminBanner && (
            <div className={styles.adminBanner}>
              👁 Estás viendo esta mesa como administrador
            </div>
          )}

          {isPastMesa && !isCancelled && (
            <div className={styles.pastBanner} role="status">
              <span aria-hidden="true">🎲</span>
              <span>
                <strong>Mesa finalizada.</strong> Ya no se permite editar,
                cancelar, unirse ni salir — pero el chat, las fotos, los
                comentarios y la calificación siguen abiertos.
                {user?.isAdmin && (
                  <span className={styles.pastBannerAdminNote}>
                    {" "}
                    Como admin podés seguir editando si hace falta.
                  </span>
                )}
              </span>
            </div>
          )}

          <div className={styles.layout}>
            {/* Banner — hermano de .main para poder reordenar el grid
                (banner / aside / main) con grid-template-areas. */}
            <div className={styles.banner}>
              <MesaTile
                game={table.boardGame || ""}
                seed={seed}
                imageUrl={useImage ? table.bggImage : null}
              />
              <div className={styles.bannerOverlay} />
              <div className={styles.bannerEyebrow}>
                Mesa de{" "}
                {hostInfo.isDeleted ? (
                  DELETED_USER_LABEL
                ) : (
                  <Link
                    to={`/usuarios/${table.host._id}`}
                    className={styles.userLink}
                  >
                    {table.host?.username}
                  </Link>
                )}
              </div>
              <div className={styles.bannerContent}>
                <div className={styles.bannerLeft}>
                  <h1 className={styles.bannerTitle}>{table.boardGame}</h1>
                  {Array.isArray(table.tags) && table.tags.length > 0 && (
                    <div className={styles.bannerTags}>
                      {table.tags.map((t) => (
                        <span key={t} className={styles.bannerTag}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.bannerRight}>
                  <div className={styles.bannerBadges}>
                    {isHost && (
                      <span
                        className={`${styles.bannerBadge} ${styles.bannerBadge_host}`}
                      >
                        Host
                      </span>
                    )}
                    {isPlayer && (
                      <span
                        className={`${styles.bannerBadge} ${styles.bannerBadge_joined}`}
                      >
                        Unido
                      </span>
                    )}
                    {isCancelled && (
                      <span
                        className={`${styles.bannerBadge} ${styles.bannerBadge_cancelled}`}
                      >
                        Cancelada
                      </span>
                    )}
                    {isPrivate && (
                      <span
                        className={`${styles.bannerBadge} ${styles.bannerBadge_lock}`}
                      >
                        <LockIcon size={10} /> Privada
                      </span>
                    )}
                    {isFriendsOnly && (
                      <span
                        className={`${styles.bannerBadge} ${styles.bannerBadge_friends}`}
                      >
                        <UsersIcon size={10} /> Amigos
                      </span>
                    )}
                  </div>
                  {dParts && (
                    <div className={styles.bannerDate}>
                      {dParts.weekday} · {dParts.day} {dParts.month} ·{" "}
                      {dParts.time}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <main className={styles.main}>
              {/* Meta row */}
              <div className={styles.metaRow}>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Cuándo</span>
                  <span className={styles.metaValue}>
                    {dParts
                      ? `${dParts.weekday} ${dParts.day} ${dParts.month}`
                      : "—"}
                  </span>
                  {dParts && (
                    <span className={styles.metaValueAccent}>
                      {dParts.time} hs
                    </span>
                  )}
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Dónde</span>
                  <span className={styles.metaValue} title={locationTexto}>
                    {locationTexto || "Por confirmar"}
                  </span>
                  {distanceLabel && (
                    <span className={styles.metaDistance}>
                      📍 {distanceLabel}
                    </span>
                  )}
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Jugadores</span>
                  <span className={styles.metaValue}>
                    {filled}/{total}
                  </span>
                  <span className={styles.metaValueAccent}>
                    {isFull
                      ? "mesa llena"
                      : `${availableSeats} lugar${availableSeats !== 1 ? "es" : ""} libre${availableSeats !== 1 ? "s" : ""}`}
                  </span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaLabel}>Privacidad</span>
                  <span className={styles.metaValue}>
                    {isPrivate
                      ? "Privada"
                      : isFriendsOnly
                        ? "Amigos"
                        : "Pública"}
                  </span>
                  <span className={styles.metaValueAccent}>
                    {isPrivate
                      ? "Requiere aprobación"
                      : isFriendsOnly
                        ? "Solo amigos del host"
                        : "Abierta a todos"}
                  </span>
                </div>
              </div>

              {/* Description */}
              {table.description && (
                <section className={styles.section}>
                  <header className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>
                      <Meeple />Sobre la partida
                    </span>
                    <span className={styles.sectionRule} />
                  </header>
                  <p className={styles.text}>{table.description}</p>
                </section>
              )}

              {/* Rules */}
              {table.rules && (
                <section className={styles.section}>
                  <header className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>
                      <Meeple />Reglas de la casa
                    </span>
                    <span className={styles.sectionRule} />
                  </header>
                  <p className={styles.text}>{table.rules}</p>
                </section>
              )}

              {/* Alrededor de la mesa */}
              <section className={styles.section}>
                <header className={styles.sectionHead}>
                  <span className={styles.sectionLabel}>
                    <Meeple />Alrededor de la mesa
                  </span>
                  <span className={styles.sectionRule} />
                  <span className={styles.sectionCount}>
                    {filled} de {total}
                  </span>
                </header>
                <div className={styles.tableMapWrap}>
                  <div className={styles.tableMapLegend}>
                    <span>
                      <span
                        className={`${styles.legendDot} ${styles.legendDot_host}`}
                      />
                      Host
                    </span>
                    <span>
                      <span className={styles.legendDot} />
                      Jugador
                    </span>
                    <span>
                      <span
                        className={`${styles.legendDot} ${styles.legendDot_you}`}
                      />
                      Vos
                    </span>
                    <span>
                      <span
                        className={`${styles.legendDot} ${styles.legendDot_empty}`}
                      />
                      Libre
                    </span>
                  </div>
                  <div className={styles.tableMap}>
                    <TableMap
                      host={table.host}
                      players={table.players || []}
                      maxPlayers={table.maxPlayers}
                      currentUserId={user?._id}
                      game={table.boardGame}
                      imageUrl={table.bggImage || table.bggThumbnail || null}
                    />
                  </div>
                  <div className={styles.playersList}>
                    <div
                      className={`${styles.playerRow} ${styles.playerRow_host}`}
                    >
                      <Avatar user={table.host} size="md" />
                      <div className={styles.playerInfo}>
                        <span className={styles.playerName}>
                          {hostInfo.isDeleted ? (
                            DELETED_USER_LABEL
                          ) : (
                            <Link
                              to={`/usuarios/${table.host._id}`}
                              className={styles.userLink}
                            >
                              {table.host.username}
                            </Link>
                          )}
                          {!hostInfo.isDeleted && (
                            <PlayerBgWatchLink user={table.host} />
                          )}
                        </span>
                        {table.host?.bggUsername && (
                          <span className={styles.playerHandle}>
                            @{table.host.bggUsername} · BGG
                          </span>
                        )}
                      </div>
                      <span
                        className={`${styles.playerRole} ${styles.playerRole_host}`}
                      >
                        Host
                      </span>
                    </div>
                    {table.players.filter(Boolean).map((p) => {
                      const pInfo = getUserDisplay(p);
                      const isYou =
                        user && (p._id || p).toString() === user._id.toString();
                      return (
                        <div
                          key={p._id || p}
                          className={`${styles.playerRow} ${isYou ? styles.playerRow_you : ""}`}
                        >
                          <Avatar user={p} size="md" />
                          <div className={styles.playerInfo}>
                            <span className={styles.playerName}>
                              {pInfo.isDeleted ? (
                                DELETED_USER_LABEL
                              ) : (
                                <Link
                                  to={`/usuarios/${p._id || p}`}
                                  className={styles.userLink}
                                >
                                  {p.username}
                                </Link>
                              )}
                              {!pInfo.isDeleted && (
                                <PlayerBgWatchLink user={p} />
                              )}
                            </span>
                            {p.bggUsername && (
                              <span className={styles.playerHandle}>
                                @{p.bggUsername} · BGG
                              </span>
                            )}
                          </div>
                          <span
                            className={`${styles.playerRole} ${isYou ? styles.playerRole_you : ""}`}
                          >
                            {isYou ? "Vos" : "Jugador"}
                          </span>
                        </div>
                      );
                    })}
                    {Array.from({ length: availableSeats }).map((_, i) => (
                      <div key={`empty-${i}`} className={styles.emptyRow}>
                        <span className={styles.emptyIcon}>
                          <ChairIcon size={16} />
                        </span>
                        <span className={styles.emptyLabel}>
                          Lugar libre · esperando jugador
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <TableTutorials
                boardGame={table.boardGame}
                tutorialMode={table.tutorialMode}
                tutorialVideoId={table.tutorialVideoId}
              />
              <TableBga
                boardGame={table.boardGame}
                bgaUrl={table.bgaUrl}
              />

              {/* Pending requests — host only on private tables */}
              {isHost && isPrivate && (
                <section className={styles.section}>
                  <header className={styles.sectionHead}>
                    <span className={styles.sectionLabel}>
                      <Meeple />Solicitudes pendientes
                    </span>
                    <span className={styles.sectionRule} />
                    <span className={styles.sectionCount}>
                      {pendingRequests.length}
                    </span>
                  </header>
                  {requestError && (
                    <p className={styles.pendingError}>{requestError}</p>
                  )}
                  {pendingRequests.length === 0 ? (
                    <p className={styles.pendingEmpty}>
                      No hay solicitudes pendientes.
                    </p>
                  ) : (
                    pendingRequests.map((req) => (
                      <div key={req._id} className={styles.pendingReq}>
                        <Avatar user={req} size="md" />
                        <div className={styles.pendingBody}>
                          <span className={styles.playerName}>
                            <Link
                              to={`/usuarios/${req._id}`}
                              className={styles.userLink}
                            >
                              {req.username}
                            </Link>
                          </span>
                          <span className={styles.playerHandle}>
                            quiere unirse
                          </span>
                        </div>
                        <div className={styles.pendingActions}>
                          <button
                            type="button"
                            className={styles.pendingReject}
                            onClick={() => handleRequest(req._id, "reject")}
                            disabled={requestLoading !== null}
                          >
                            {requestLoading === `${req._id}reject`
                              ? "…"
                              : "Rechazar"}
                          </button>
                          <button
                            type="button"
                            className={styles.pendingAccept}
                            onClick={() => handleRequest(req._id, "accept")}
                            disabled={requestLoading !== null}
                          >
                            {requestLoading === `${req._id}accept`
                              ? "…"
                              : "Aceptar"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              )}

              {/* Mobile tab bar — only for participants. El chat ya no vive
                  en main (lo movimos al stub del aside con InfoTooltip que
                  aclara la privacidad), así que sólo quedan fotos y reseñas
                  como tabs alternables en mobile. */}
              {!isGuest && (
                <div className={styles.mobileTabBar}>
                  {[
                    { id: "fotos", label: "Fotos" },
                    { id: "resenas", label: "Comentarios" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.mobileTabBtn} ${mobileTab === id ? styles.mobileTabActive : ""}`}
                      onClick={() => setMobileTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {isGuest && !user && (
                <p className={styles.text} style={{ fontStyle: "italic" }}>
                  El chat es privado y solo está disponible para los miembros.
                </p>
              )}

              {/* Gallery */}
              <section
                className={`${styles.section} ${!isGuest && mobileTab !== "fotos" ? styles.mobileHidden : ""}`}
              >
                <header
                  className={`${styles.sectionHead} ${styles.sectionHead_tabbed}`}
                >
                  <span className={styles.sectionLabel}>
                    <Meeple />Fotos de la mesa
                  </span>
                  <span className={styles.sectionRule} />
                  {(table.images || []).length > 0 && (
                    <span className={styles.sectionCount}>
                      {(table.images || []).length}/10
                    </span>
                  )}
                </header>
                <TableGallery
                  tableId={id}
                  images={table.images || []}
                  canUpload={
                    isParticipant(table) &&
                    !isViewingAsAdmin &&
                    (table.images || []).length < 10
                  }
                  canDeleteImage={(img) => {
                    const isUploader =
                      user &&
                      (img.uploader?._id || img.uploader)?.toString() ===
                        user._id.toString();
                    return isUploader || isHost || user?.isAdmin;
                  }}
                  onImagesChange={handleImagesChange}
                />
              </section>

              {/* Comments */}
              <section
                className={`${styles.section} ${!isGuest && mobileTab !== "resenas" ? styles.mobileHidden : ""}`}
              >
                <header
                  className={`${styles.sectionHead} ${styles.sectionHead_tabbed}`}
                >
                  <span className={styles.sectionLabel}><Meeple />Comentarios</span>
                  <span className={styles.sectionRule} />
                  {commentsCount > 0 && (
                    <span className={styles.sectionCount}>
                      <CommentIcon size={12} /> {commentsCount}
                    </span>
                  )}
                </header>
                <TableComments
                  tableId={id}
                  user={user}
                  isHost={isHost}
                  isAnon={!user}
                  canPost={isPublic}
                  onRequireLogin={setLoginPrompt}
                  onCountChange={setCommentsCount}
                />
              </section>

              {/* Ratings */}
              <section
                className={`${styles.section} ${!isGuest && mobileTab !== "resenas" ? styles.mobileHidden : ""}`}
              >
                <header className={styles.sectionHead}>
                  <span className={styles.sectionLabel}>
                    <Meeple />Valoraciones
                    <InfoTooltip label="Acerca de las valoraciones">
                      Una vez finalizada la mesa, los participantes pueden dejar
                      una valoración de 1 a 5 estrellas y un comentario opcional
                      para reflejar cómo estuvo la sesión. Ayuda a otros
                      jugadores a saber qué esperar del host y del grupo.
                    </InfoTooltip>
                  </span>
                  <span className={styles.sectionRule} />
                  {ratingsSummary.count > 0 && ratingsSummary.avg !== null && (
                    <span className={styles.sectionCount}>
                      ★ {ratingsSummary.avg.toFixed(1)} ({ratingsSummary.count})
                    </span>
                  )}
                </header>
                <TableRatings
                  tableId={id}
                  user={user}
                  canRate={
                    isPublic &&
                    new Date(table.date) < new Date() &&
                    isParticipant(table)
                  }
                  lockedByPrivacy={
                    !isPublic &&
                    new Date(table.date) < new Date() &&
                    isParticipant(table)
                  }
                  onSummaryChange={setRatingsSummary}
                />
              </section>
            </main>

            {/* Aside: sticky como bloque (stub + secondary actions) */}
            <aside className={styles.aside}>
              <MesaStub
                table={table}
                userState={stubUserState}
                pendingCount={pendingRequests.length}
                busy={
                  joinLoading ||
                  leaveLoading ||
                  cancelTableLoading ||
                  followLoading
                }
                onJoin={handleGuestJoin}
                onCancelRequest={handleCancelJoinRequest}
                onLeave={handleLeave}
                onEdit={() => navigate(`/mesas/${id}/editar`)}
                onCancelMesa={handleCancelTable}
                onLoginRequest={() =>
                  setLoginPrompt("Iniciá sesión para unirte a esta mesa.")
                }
                chatSlot={
                  showChat ? (
                    <>
                      <header className={styles.sectionHead}>
                        <span className={styles.sectionLabel}>
                          <Meeple />Chat de la mesa
                          <InfoTooltip label="Privacidad del chat">
                            El chat es privado. Sólo el host y los jugadores
                            unidos a esta mesa pueden ver y enviar mensajes —
                            ningún visitante externo puede leerlo, ni siquiera
                            si tiene el link de la mesa.
                          </InfoTooltip>
                        </span>
                        <span className={styles.sectionRule} />
                      </header>
                      <TableChat
                        tableId={id}
                        user={user}
                        isViewingAsAdmin={isViewingAsAdmin}
                      />
                    </>
                  ) : null
                }
              />
              {/* Secondary actions: Follow + Share compartida.
                  Solo en mesas públicas — privadas/amigos son "ocultas" y
                  no tiene sentido exponerlas vía notificación de cupo o
                  Compartidas públicas. Ver feedback de privacy 2026-05. */}
              {!isCancelled && isPublic && (
                <div className={styles.secondaryActions}>
                  <button
                    type="button"
                    className={`${styles.secondaryBtn} ${isFollowing ? styles.secondaryBtn_following : ""}`}
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    <BellIcon size={13} filled={isFollowing} />
                    {isFollowing ? "Siguiendo" : "Seguir mesa"}
                  </button>
                  {(isHost || isPlayer) && (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => navigate(`/compartidas?mesa=${id}`)}
                    >
                      📸 Compartir
                    </button>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
