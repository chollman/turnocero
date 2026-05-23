import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import GameTile from "../../components/shared/GameTile";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay, DELETED_USER_LABEL } from "../../utils/userDisplay";
import { formatDistanceKm } from "../../utils/distance";
import TableDetailSkeleton from "./TableDetailSkeleton";
import TableChat from "./TableChat";
import TableComments from "./TableComments";
import TableGallery from "./TableGallery";
import TableRatings from "./TableRatings";
import styles from "./TableDetail.module.css";

const REACTION_EMOJIS = ["❤️", "🎲", "🔥", "👍", "😄"];

// Small inline link rendered next to a player's name when they have an active
// BG Watch (i.e. populated `bggUsername`). Click → their BG Watch profile.
function PlayerBgWatchLink({ user }) {
  if (!user?.bggUsername) return null;
  return (
    <Link
      to={`/bg-watch/${encodeURIComponent(user.bggUsername)}`}
      className={styles.playerChipBgWatch}
      title={`Ver historial de partidas de @${user.username}`}
      aria-label={`Ver BG Watch de ${user.username}`}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        viewBox="0 0 24 24"
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

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function getDateChip(dateStr) {
  const date = new Date(dateStr);
  const weekday = date
    .toLocaleDateString("es-AR", { weekday: "short" })
    .toUpperCase()
    .replace(/\./g, "");
  const day = date.getDate();
  const month = date
    .toLocaleDateString("es-AR", { month: "short" })
    .toUpperCase()
    .replace(/\./g, "");
  const time = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${weekday} · ${day} ${month} · ${time}`;
}

function SeatTrack({ filled, total }) {
  const pct = Math.min(100, (filled / total) * 100);
  return (
    <div className={styles.seatTrack}>
      <div className={styles.seatFill} style={{ width: `${pct}%` }} />
      {Array.from({ length: total - 1 }).map((_, i) => (
        <span
          key={i}
          className={styles.seatDivider}
          style={{ left: `${((i + 1) / total) * 100}%` }}
        />
      ))}
    </div>
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
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
  const [joinError, setJoinError] = useState("");
  const [followLoading, setFollowLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [cancelTableLoading, setCancelTableLoading] = useState(false);
  const [cancelTableError, setCancelTableError] = useState("");
  const [loginPrompt, setLoginPrompt] = useState("");
  const [accessError, setAccessError] = useState("");

  const [mobileTab, setMobileTab] = useState("chat");

  const isParticipant = (t) => {
    if (!t || !user) return false;
    const uid = user._id.toString();
    return (
      t.host?._id?.toString() === uid ||
      t.players.some((p) => p && (p._id || p).toString() === uid)
    );
  };

  useEffect(() => {
    setActiveTable(id);
    return () => setActiveTable(null);
  }, [id, setActiveTable]);

  useEffect(() => {
    const fetchTable = async () => {
      try {
        const { data } = await axios.get(API.tables.DETAIL(id));
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
        if (err.response?.status === 403) {
          setAccessError("Esta mesa es privada");
        } else {
          navigate("/", { replace: true });
        }
      } finally {
        setLoadingTable(false);
      }
    };
    fetchTable();
    // Intencionalmente solo `[id]`: `user`/`isParticipant` se usan dentro pero
    // NO queremos refetchear cuando cambia el user — la mesa es la misma, el
    // gating de privacy se re-evalúa con el render normal. `navigate` y los
    // setters son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Comments, ratings, gallery e images se manejan en sus sub-componentes
  // ahora — cada uno fetchea lo suyo y owna su state. El chat (messages
  // + socket + auto-scroll) también vive en TableChat. TableDetail solo
  // coordina la data del propio recurso (`table`) y los flujos de
  // join/leave/follow/cancel.

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
    // Snapshot ANTES del optimistic update — el rollback en el catch
    // necesita el valor previo. Mantener `currentFollowers` en la closure
    // hace el contrato explícito (no `prev` adentro del setter, que perdería
    // ref si llega un broadcast del socket entre el optimistic y el catch).
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
      // Rollback explícito al snapshot pre-optimistic + toast — sin el
      // toast el usuario veía el toggle "ir y volver" sin entender por qué.
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
    setJoinError("");
    try {
      const { data } = await axios.post(API.tables.JOIN(id));
      setTable(data.table);
      setPendingRequests(data.table.pendingRequests || []);
    } catch (err) {
      setJoinError(err.response?.data?.message || "Error al unirse");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("¿Abandonar esta mesa?")) return;
    setLeaveLoading(true);
    setLeaveError("");
    try {
      await axios.post(API.tables.LEAVE(id));
      navigate("/");
    } catch (err) {
      setLeaveError(
        err.response?.data?.message || "Error al abandonar la mesa",
      );
      setLeaveLoading(false);
    }
  };

  const handleCancelTable = async () => {
    if (
      !window.confirm("¿Cancelar esta mesa? Esta acción no se puede deshacer.")
    )
      return;
    setCancelTableLoading(true);
    try {
      await axios.delete(API.tables.DETAIL(id));
      navigate("/");
    } catch (err) {
      setCancelTableError(
        err.response?.data?.message || "Error al cancelar la mesa",
      );
      setCancelTableLoading(false);
    }
  };

  const handleCancelJoinRequest = async () => {
    setJoinLoading(true);
    setJoinError("");
    try {
      const { data } = await axios.delete(API.tables.REQUEST(id));
      setTable(data.table);
      setPendingRequests(data.table.pendingRequests || []);
    } catch (err) {
      setJoinError(
        err.response?.data?.message || "Error al cancelar solicitud",
      );
    } finally {
      setJoinLoading(false);
    }
  };

  const handleReact = async (emoji) => {
    if (!user) {
      setLoginPrompt("Iniciá sesión para reaccionar a esta mesa.");
      return;
    }
    const currentReactions = table.reactions || [];
    const existing = currentReactions.find(
      (r) => r.user?.toString() === user._id.toString(),
    );
    let newReactions;
    if (existing) {
      if (existing.emoji === emoji) {
        newReactions = currentReactions.filter(
          (r) => r.user?.toString() !== user._id.toString(),
        );
      } else {
        newReactions = currentReactions.map((r) =>
          r.user?.toString() === user._id.toString() ? { ...r, emoji } : r,
        );
      }
    } else {
      newReactions = [...currentReactions, { user: user._id, emoji }];
    }
    setTable((prev) => ({ ...prev, reactions: newReactions }));
    try {
      const { data } = await axios.post(API.tables.REACT(id), { emoji });
      setTable((prev) => ({ ...prev, reactions: data.reactions }));
    } catch {
      setTable((prev) => ({ ...prev, reactions: currentReactions }));
      addToast({
        type: "error",
        message: "No pudimos guardar tu reacción.",
      });
    }
  };

  // Callback usado por TableGallery para sincronizar `table.images` cuando
  // sube/borra una imagen — TableGallery owna el upload/delete pero el
  // padre necesita el array actualizado para sus chequeos de count.
  const handleImagesChange = useCallback((nextImages) => {
    setTable((prev) => ({ ...prev, images: nextImages }));
  }, []);

  if (loadingTable) {
    return <TableDetailSkeleton />;
  }

  if (accessError) {
    return (
      <div className={styles.loadingWrapper}>
        <span style={{ fontSize: "2rem" }}>🔒</span>
        <p style={{ color: "var(--text-secondary)", marginTop: "1rem" }}>
          {accessError}
        </p>
        <button
          style={{
            marginTop: "1rem",
            color: "var(--amber)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-display)",
            fontSize: "14px",
          }}
          onClick={() => navigate("/")}
        >
          ← Volver al inicio
        </button>
      </div>
    );
  }

  if (!table) return null;

  const isAnon = !user;
  const isHost = !isAnon && table.host?._id?.toString() === user._id.toString();
  const hostInfo = getUserDisplay(table.host);
  const isViewingAsAdmin = !isAnon && user.isAdmin && !isParticipant(table);
  const isGuest = !isParticipant(table) && !user?.isAdmin;
  const isPlayer = isParticipant(table) && !isHost;
  const isFull = table.players.length >= table.maxPlayers;
  const isPendingRequest =
    !isAnon &&
    (table.pendingRequests || []).some(
      (r) => (r._id || r).toString() === user._id.toString(),
    );
  const isPrivate = table.privacy === "private";
  // `table.location` puede ser string legacy o subdoc { texto, lat, lng }.
  const locationTexto =
    typeof table.location === "string"
      ? table.location
      : table.location?.texto || "";
  const distanceLabel = formatDistanceKm(table.distanceKm);
  const isFollowing =
    !isAnon &&
    (table.followers || []).some((f) => f.toString() === user._id.toString());
  const filled = table.players.length + 1;
  const total = table.maxPlayers + 1;
  const availableSeats = table.maxPlayers - table.players.length;
  const seed = hashStr(table._id || "") % 10;

  const actionError = cancelTableError || leaveError || joinError;

  const actionButtons = (
    <>
      {actionError && <p className={styles.actionError}>{actionError}</p>}
      {isHost && (
        <>
          <button
            className={styles.btnActEdit}
            onClick={() => navigate(`/mesas/${id}/editar`)}
            disabled={cancelTableLoading}
          >
            Editar mesa
          </button>
          <button
            className={styles.btnActCancel}
            onClick={handleCancelTable}
            disabled={cancelTableLoading}
          >
            {cancelTableLoading ? "…" : "Cancelar mesa"}
          </button>
        </>
      )}
      {isPlayer && (
        <button
          className={styles.btnActLeave}
          onClick={handleLeave}
          disabled={leaveLoading}
        >
          {leaveLoading ? "…" : "Abandonar mesa"}
        </button>
      )}
      {isGuest && isPendingRequest && (
        <button
          className={styles.btnActPending}
          onClick={handleCancelJoinRequest}
          disabled={joinLoading}
        >
          {joinLoading ? "…" : "Solicitud enviada · Cancelar"}
        </button>
      )}
      {isGuest && !isAnon && !isPendingRequest && (
        <button
          className={styles.btnActJoin}
          onClick={handleGuestJoin}
          disabled={joinLoading || isFull}
        >
          {joinLoading
            ? "…"
            : isFull
              ? "Mesa completa"
              : isPrivate
                ? "Solicitar unirse"
                : "Unirme a la mesa"}
        </button>
      )}
      {isAnon && !isFull && (
        <button
          className={styles.btnActJoin}
          onClick={() =>
            setLoginPrompt("Iniciá sesión para unirte a esta mesa.")
          }
        >
          Unirme a la mesa
        </button>
      )}
      {isGuest && !isAnon && (
        <button
          className={`${styles.btnFollow} ${isFollowing ? styles.btnFollowing : ""}`}
          onClick={handleFollow}
          disabled={followLoading}
        >
          {isFollowing ? "🔔 Siguiendo" : "🔕 Seguir"}
        </button>
      )}
      {isAnon && (
        <button
          className={styles.btnFollow}
          onClick={() => setLoginPrompt("Iniciá sesión para seguir esta mesa.")}
        >
          🔕 Seguir
        </button>
      )}
      {(isHost || isPlayer) && (
        <button
          className={styles.btnShareCompartida}
          onClick={() => navigate(`/compartidas?mesa=${id}`)}
        >
          📸 Compartir compartida
        </button>
      )}
    </>
  );

  return (
    <>
      <LoginPromptModal
        isOpen={!!loginPrompt}
        onClose={() => setLoginPrompt("")}
        message={loginPrompt}
      />
      <div className={styles.page}>
        <div className="container">
          {/* Hero */}
          <div className={styles.hero}>
            <div className={styles.heroTile}>
              <GameTile
                game={table.boardGame}
                seed={seed}
                size="100%"
                imageUrl={table.bggImage || null}
              />
            </div>
            <div className={styles.heroGradient} />

            <button
              className={styles.backBtn}
              onClick={() => {
                // Si la mesa pertenece a un evento, "volver" lleva al detalle
                // del evento (tab Mesas) en lugar de hacer history.back —
                // garantiza que la navegación tenga sentido aunque el user
                // haya llegado a la mesa via deep-link o notif.
                if (table.eventoId) {
                  navigate(`/eventos/${table.eventoId}?tab=mesas`);
                } else {
                  navigate(-1);
                }
              }}
            >
              ← {table.eventoId ? "Volver al evento" : "Volver"}
            </button>

            <div className={styles.heroBadges}>
              {isHost && <span className={styles.hostBadge}>HOST</span>}
              {isPlayer && <span className={styles.playerBadge}>UNIDO</span>}
              {table.status === "cancelled" && (
                <span className={styles.cancelledBadge}>CANCELADA</span>
              )}
              {isPrivate && (
                <span className={styles.lockBadge}>
                  <LockIcon size={10} />
                </span>
              )}
            </div>

            <div className={styles.heroMeta}>
              <h1 className={styles.heroGameTitle}>{table.boardGame}</h1>
              <div className={styles.heroChips}>
                <span className={styles.heroChip}>
                  <span className={styles.heroChipDot}>●</span>
                  {getDateChip(table.date)}
                </span>
                {locationTexto && (
                  <span className={styles.heroChip}>
                    📍 {locationTexto}
                    {distanceLabel && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: "var(--green)",
                          fontWeight: 700,
                        }}
                      >
                        · {distanceLabel}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mobile meta rows — date + location below hero (mobile only) */}
          <div className={styles.mobileMetaRows}>
            <div className={styles.mobileMetaRow}>
              <span className={styles.mobileMetaIcon}>📅</span>
              <span>{getDateChip(table.date)}</span>
            </div>
            {locationTexto && (
              <div className={styles.mobileMetaRow}>
                <span className={styles.mobileMetaIcon}>📍</span>
                <span>
                  {locationTexto}
                  {distanceLabel && (
                    <span
                      style={{
                        marginLeft: 6,
                        color: "var(--green)",
                        fontWeight: 700,
                      }}
                    >
                      {" "}
                      · {distanceLabel}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Actions bar */}
          {table.status !== "cancelled" &&
            (isHost || isPlayer || isGuest || isAnon) && (
              <div className={styles.actionsBar}>
                <div className={styles.actionsRow}>{actionButtons}</div>
              </div>
            )}

          {isViewingAsAdmin && (
            <div className={styles.adminBanner}>
              👁 Estás viendo esta mesa como administrador
            </div>
          )}

          {/* Content */}
          <div
            className={`${styles.content} ${isGuest ? styles.contentSingle : ""}`}
          >
            {/* Left column */}
            <div className={styles.mainCol}>
              {/* Seat track card */}
              <div className={styles.card}>
                <div className={styles.seatCardHeader}>
                  <span className={styles.eyebrow}>LUGARES</span>
                  <span className={styles.seatCount}>
                    {filled}/{total}
                  </span>
                </div>
                <SeatTrack filled={filled} total={total} />
                <span
                  className={isFull ? styles.statusFull : styles.statusOpen}
                >
                  ●{" "}
                  {isFull
                    ? "Mesa completa"
                    : `${availableSeats} lugar${availableSeats !== 1 ? "es" : ""} libre${availableSeats !== 1 ? "s" : ""}`}
                </span>
              </div>

              {/* Description */}
              {table.description && (
                <div className={styles.card}>
                  <span className={styles.eyebrow}>SOBRE LA PARTIDA</span>
                  <p className={styles.descriptionText}>{table.description}</p>
                </div>
              )}

              {/* Reactions */}
              {(() => {
                const reactions = table.reactions || [];
                const myReaction = user
                  ? reactions.find(
                      (r) => r.user?.toString() === user._id.toString(),
                    )?.emoji || null
                  : null;
                return (
                  <div className={styles.card}>
                    <span className={styles.eyebrow}>¿QUÉ TE PARECE?</span>
                    <div className={styles.reactionBar}>
                      {REACTION_EMOJIS.map((emoji) => {
                        const count = reactions.filter(
                          (r) => r.emoji === emoji,
                        ).length;
                        return (
                          <button
                            key={`${emoji}-${myReaction === emoji}`}
                            className={`${styles.reactionBtn} ${myReaction === emoji ? styles.reactionActive : ""}`}
                            onClick={() => handleReact(emoji)}
                          >
                            <span>{emoji}</span>
                            {count > 0 && (
                              <span className={styles.reactionCount}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* EN LA MESA */}
              <div className={styles.card}>
                <span className={styles.eyebrow}>EN LA MESA</span>
                <div className={styles.playerChips}>
                  <div className={styles.playerChip}>
                    <Avatar user={table.host} size="xs" />
                    <span className={styles.playerChipName}>
                      {hostInfo.isDeleted
                        ? DELETED_USER_LABEL
                        : table.host.username}
                    </span>
                    {!hostInfo.isDeleted && (
                      <PlayerBgWatchLink user={table.host} />
                    )}
                    <span className={styles.hostTag}>Host</span>
                  </div>
                  {table.players.filter(Boolean).map((p) => {
                    const playerInfo = getUserDisplay(p);
                    return (
                      <div key={p._id || p} className={styles.playerChip}>
                        <Avatar user={p} size="xs" />
                        <span className={styles.playerChipName}>
                          {playerInfo.isDeleted
                            ? DELETED_USER_LABEL
                            : p.username}
                        </span>
                        {!playerInfo.isDeleted && (
                          <PlayerBgWatchLink user={p} />
                        )}
                        {user &&
                          (p._id || p).toString() === user._id.toString() && (
                            <span className={styles.youTag}>vos</span>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {isGuest && (
                <p className={styles.chatPrivateNote}>
                  El chat es privado y solo está disponible para los miembros.
                </p>
              )}

              {/* Pending requests — host only, private tables */}
              {isHost && isPrivate && (
                <div className={styles.card}>
                  <div className={styles.requestsHeader}>
                    <span className={styles.eyebrow}>
                      SOLICITUDES PENDIENTES
                    </span>
                    {pendingRequests.length > 0 && (
                      <span className={styles.requestsBadge}>
                        {pendingRequests.length}
                      </span>
                    )}
                  </div>
                  {requestError && (
                    <p className={styles.requestsError}>{requestError}</p>
                  )}
                  {pendingRequests.length === 0 ? (
                    <p className={styles.requestsEmpty}>
                      No hay solicitudes pendientes.
                    </p>
                  ) : (
                    <ul className={styles.requestsList}>
                      {pendingRequests.map((req) => (
                        <li key={req._id} className={styles.requestItem}>
                          <Avatar user={req} size="sm" />
                          <span className={styles.requestUsername}>
                            {req.username}
                          </span>
                          <div className={styles.requestActions}>
                            <button
                              className={styles.btnAccept}
                              onClick={() => handleRequest(req._id, "accept")}
                              disabled={requestLoading !== null}
                            >
                              {requestLoading === `${req._id}accept`
                                ? "…"
                                : "Aceptar"}
                            </button>
                            <button
                              className={styles.btnReject}
                              onClick={() => handleRequest(req._id, "reject")}
                              disabled={requestLoading !== null}
                            >
                              {requestLoading === `${req._id}reject`
                                ? "…"
                                : "Rechazar"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Mobile tab bar — participants only, hidden on desktop */}
              {!isGuest && (
                <div className={styles.mobileTabBar}>
                  {[
                    { id: "chat", label: "CHAT" },
                    { id: "fotos", label: "FOTOS" },
                    { id: "resenas", label: "RESEÑAS" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      className={`${styles.mobileTabBtn} ${mobileTab === id ? styles.mobileTabActive : ""}`}
                      onClick={() => setMobileTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Gallery */}
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
                className={
                  !isGuest && mobileTab !== "fotos" ? styles.mobileHidden : ""
                }
              />

              {/* Comments */}
              <TableComments
                tableId={id}
                user={user}
                isHost={isHost}
                isAnon={isAnon}
                onRequireLogin={setLoginPrompt}
                className={
                  !isGuest && mobileTab !== "resenas" ? styles.mobileHidden : ""
                }
              />

              {/* Ratings */}
              <TableRatings
                tableId={id}
                user={user}
                canRate={
                  new Date(table.date) < new Date() && isParticipant(table)
                }
                className={
                  !isGuest && mobileTab !== "resenas" ? styles.mobileHidden : ""
                }
              />
            </div>

            {/* Right column: Chat */}
            {!isGuest && (
              <TableChat
                tableId={id}
                user={user}
                isViewingAsAdmin={isViewingAsAdmin}
                className={mobileTab !== "chat" ? styles.mobileHidden : ""}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
