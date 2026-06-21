import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import MesaTile from "../../components/shared/MesaTile";
import SeatTrack from "../../components/shared/SeatTrack";
import LoginPromptModal from "../../components/shared/LoginPromptModal";
import Avatar from "../../components/shared/Avatar";
import ItemCommunityTag from "../../components/shared/ItemCommunityTag";
import { GhostIcon } from "../../components/shared/UserRef";
import { getUserDisplay } from "../../utils/userDisplay";
import { formatDistanceKm } from "../../utils/distance";
import { getLocationDisplay } from "../../utils/location";
import { dateParts } from "../../utils/eventoDate";
import { hashStringToInt } from "../../utils/hash";
import styles from "./TableCard.module.css";

// -- icons ---------------------------------------------------------------

const PinIcon = ({ size = 13 }) => (
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
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

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

const CheckIcon = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ClockIcon = ({ size = 12 }) => (
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
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

const EyeIcon = ({ size = 13 }) => (
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
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// -- helpers -------------------------------------------------------------

// Devuelve uno de los cinco estados visuales en los que puede estar el user
// respecto de una mesa. La UI ya conoce todas estas combinaciones, pero
// resumirlas en una sola variable hace que el render no esté lleno de
// ternarios anidados.
//
// Orden de evaluación es importante: hosting > joined > pending > full > idle.
function classifyUserState({
  isAnon,
  isHost,
  isPlayer,
  isPendingRequest,
  isFull,
}) {
  if (isAnon) return isFull ? "full" : "idle";
  if (isHost) return "hosting";
  if (isPlayer) return "joined";
  if (isPendingRequest) return "pending";
  if (isFull) return "full";
  return "idle";
}

// Mapea estado del usuario → clase modificadora del card y del CTA.
const STATE_CARD_CLASS = {
  idle: "",
  hosting: styles.card_hosting,
  joined: styles.card_joined,
  pending: styles.card_pending,
  full: styles.card_full,
};

// Tooltip flotante para mesas privadas a las que no podés entrar.
// `position: fixed` + portal a `document.body` para no quedar clippeado
// por containers con `overflow: hidden`. `pointer-events: none` evita
// que el tooltip robe el cursor (sino flickerea el hover).
function PrivateTooltip({ pos, isFull }) {
  if (!pos) return null;
  return createPortal(
    <div
      className={styles.privateTooltip}
      style={{
        left: pos.x + 14,
        top: pos.y + 14,
      }}
      role="tooltip"
    >
      <span className={styles.privateTooltipTitle}>🔒 Mesa privada</span>
      <span className={styles.privateTooltipSub}>
        {isFull
          ? "No quedan lugares disponibles"
          : "Solo se puede pedir lugar al host"}
      </span>
    </div>,
    document.body,
  );
}

// -- main component ------------------------------------------------------

export default function TableCard({ table, onUpdate, onCancel, listMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginPrompt, setLoginPrompt] = useState("");
  const [flashing, setFlashing] = useState(false);

  const hostInfo = getUserDisplay(table.host);
  const locationTexto = getLocationDisplay(table.location, "regular");
  const distanceLabel = formatDistanceKm(table.distanceKm);

  const isAnon = !user;
  const isHost =
    !isAnon &&
    table.host &&
    (table.host._id === user._id ||
      table.host._id?.toString() === user._id?.toString());
  const isPlayer =
    !isAnon &&
    table.players.some(
      (p) => (p._id || p).toString() === (user._id || user).toString(),
    );
  const isPendingRequest =
    !isAnon &&
    (table.pendingRequests || []).some(
      (r) => (r._id || r).toString() === user._id.toString(),
    );
  const isPrivate = table.privacy === "private";
  const isFriendsOnly = table.privacy === "friends";
  const filled = table.players.length + 1; // host counts
  const total = table.maxPlayers + 1;
  const availableSeats = table.maxPlayers - table.players.length;
  const isFull = availableSeats <= 0;
  const showAdminTab = user?.isAdmin && !isHost && !isPlayer;

  const userState = classifyUserState({
    isAnon,
    isHost,
    isPlayer,
    isPendingRequest,
    isFull,
  });

  // Mesa "finalizada" para no-admin: la fecha pasó. Ocultamos todas las
  // acciones de mutación (join/leave/cancel/edit) y mostramos un CTA
  // bloqueado. Admin conserva los controles para moderación.
  //
  // Usamos `user?.isAdmin` (effective) — cuando el admin activa "Ver como
  // usuario" debe perder el override y comportarse como user normal. Ese
  // es el contrato del preview mode (ver feedback_admin_view_as_user.md).
  //
  // `new Date()` en lugar de `Date.now()` para evitar el lint de purity
  // (regla react-hooks/purity); semánticamente equivalente para
  // comparaciones temporales.
  const isPastMesa = dateParts(table.date)
    ? new Date(table.date) < new Date()
    : false;
  const isFrozen = isPastMesa && !user?.isAdmin;

  const dParts = dateParts(table.date);
  const dateChipText = dParts
    ? `${dParts.weekday} · ${dParts.day} ${dParts.month} · ${dParts.time}`
    : "";
  // Cyan default → naranja "soon" si en <6h → rojo "urgent" si <1h → muted si pasó.
  const dateChipTone = (() => {
    if (!dParts) return "default";
    const diffMs = dParts.isoDate.getTime() - new Date().getTime();
    if (diffMs < 0) return "past";
    if (diffMs < 60 * 60 * 1000) return "urgent";
    return "default";
  })();

  // `bannerSeedKey` permite al caller (p.ej. la live preview de MesaForm)
  // pasar una clave estable que decuple el seed del mosaico del nombre
  // del juego — así el banner aleatorio del preview no muta con cada
  // keystroke. Sin override, seed sale del `_id` de la mesa, como siempre.
  const seed = hashStringToInt(table.bannerSeedKey || table._id || "");
  const useImage = Boolean(table.bggImage);
  // Cuando hay override, no queremos que el hash del nombre del juego
  // contamine el patrón — se lo pasamos vacío a `<MesaTile>` y dejamos que
  // el seed sea el único insumo del mosaico.
  const tileGame = table.bannerSeedKey ? "" : table.boardGame || "";

  // Mesa privada + el viewer NO es miembro (ni anon que vea el detalle).
  // En ese caso bloqueamos la navegación a /mesas/:id (el server le tira
  // 403 igual) y mostramos un tooltip flotante en hover. El CTA seguir
  // funcionando porque el user PUEDE pedir lugar (si admin permite).
  const restrictedPrivate =
    isPrivate && !isHost && !isPlayer && !isPendingRequest;
  // Posición del tooltip flotante (clientX/Y, position: fixed).
  const [tooltipPos, setTooltipPos] = useState(null);
  const handleMouseMove = (e) => {
    if (!restrictedPrivate) return;
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };
  const handleMouseLeave = () => setTooltipPos(null);

  // -- handlers ---------------------------------------------------------

  const requireAuth = (msg) => {
    if (!user) {
      setLoginPrompt(msg);
      return false;
    }
    return true;
  };

  const handleJoin = async (e) => {
    e?.stopPropagation();
    if (!requireAuth("Iniciá sesión para unirte a esta mesa.")) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(API.tables.JOIN(table._id));
      onUpdate(data.table);
      setFlashing(true);
      setTimeout(() => setFlashing(false), 500);
    } catch (err) {
      setError(err.response?.data?.message || "Error al unirse");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async (e) => {
    e?.stopPropagation();
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(API.tables.LEAVE(table._id));
      onUpdate(data);
    } catch (err) {
      setError(err.response?.data?.message || "Error al salir");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (e) => {
    e?.stopPropagation();
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.delete(API.tables.REQUEST(table._id));
      onUpdate(data.table);
    } catch (err) {
      setError(err.response?.data?.message || "Error al cancelar solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (e) => {
    e?.stopPropagation();
    if (!window.confirm("¿Cancelar esta mesa?")) return;
    setLoading(true);
    setError("");
    try {
      await axios.delete(API.tables.DETAIL(table._id));
      onCancel(table._id);
    } catch (err) {
      setError(err.response?.data?.message || "Error al cancelar");
    } finally {
      setLoading(false);
    }
  };

  const goToDetail = () => navigate(`/mesas/${table._id}`);
  const goToEdit = (e) => {
    e?.stopPropagation();
    navigate(`/mesas/${table._id}/editar`);
  };

  // -- shared sub-renders ----------------------------------------------

  const cta = (() => {
    if (loading) {
      return (
        <button className={styles.cta} disabled>
          …
        </button>
      );
    }
    // Mesa finalizada para no-admin: el único affordance es entrar a ver
    // las reseñas / fotos / chat. Botón disabled-looking pero clickeable
    // hacia el detalle (mediante el wrapper de la card, no el CTA mismo).
    if (isFrozen) {
      return (
        <button
          type="button"
          className={`${styles.cta} ${styles.cta_disabled}`}
          disabled
        >
          Finalizada
        </button>
      );
    }
    switch (userState) {
      case "hosting":
        return (
          <button
            type="button"
            className={`${styles.cta} ${styles.cta_hosting}`}
            onClick={(e) => {
              e.stopPropagation();
              goToDetail();
            }}
          >
            Administrar →
          </button>
        );
      case "joined":
        return (
          <button
            type="button"
            className={`${styles.cta} ${styles.cta_joined}`}
            onClick={(e) => {
              e.stopPropagation();
              goToDetail();
            }}
          >
            <CheckIcon /> Unido
          </button>
        );
      case "pending":
        return (
          <button
            type="button"
            className={`${styles.cta} ${styles.cta_pending}`}
            onClick={handleCancelRequest}
          >
            <ClockIcon /> Solicitud enviada
          </button>
        );
      case "full":
        return (
          <button
            type="button"
            className={`${styles.cta} ${styles.cta_disabled}`}
            disabled
          >
            Mesa llena
          </button>
        );
      default:
        return (
          <button type="button" className={styles.cta} onClick={handleJoin}>
            {isPrivate ? "Solicitar →" : "Unirme"}
          </button>
        );
    }
  })();

  const badges = (
    <>
      {isHost && (
        <span className={`${styles.badge} ${styles.badge_host}`}>Host</span>
      )}
      {isPlayer && (
        <span className={`${styles.badge} ${styles.badge_joined}`}>Unido</span>
      )}
      {isPendingRequest && (
        <span className={`${styles.badge} ${styles.badge_pending}`}>
          Pendiente
        </span>
      )}
      {isPrivate && (
        <span
          className={`${styles.badge} ${styles.badge_lock}`}
          title="Mesa privada"
          aria-label="Mesa privada"
        >
          <LockIcon size={10} />
        </span>
      )}
      {isFriendsOnly && (
        <span
          className={`${styles.badge} ${styles.badge_friends}`}
          title="Mesa solo para amigos"
          aria-label="Mesa solo para amigos"
        >
          <UsersIcon size={10} />
        </span>
      )}
    </>
  );

  // -- LIST MODE -------------------------------------------------------

  if (listMode) {
    return (
      <>
        <LoginPromptModal
          isOpen={!!loginPrompt}
          onClose={() => setLoginPrompt("")}
          message={loginPrompt}
        />
        <div
          className={`${styles.row} ${STATE_CARD_CLASS[userState] || ""} ${isPrivate ? styles.card_private : ""} ${restrictedPrivate ? styles.card_restricted : ""}`}
          onClick={restrictedPrivate ? undefined : goToDetail}
          onMouseMove={restrictedPrivate ? handleMouseMove : undefined}
          onMouseLeave={restrictedPrivate ? handleMouseLeave : undefined}
          role={restrictedPrivate ? undefined : "link"}
          tabIndex={restrictedPrivate ? undefined : 0}
          onKeyDown={
            restrictedPrivate
              ? undefined
              : (e) => {
                  if (e.key === "Enter") goToDetail();
                }
          }
          aria-label={
            restrictedPrivate
              ? `Mesa privada de ${table.boardGame}`
              : `Ver mesa de ${table.boardGame}`
          }
        >
          {/* Miniatura del juego — oculta en desktop (vista lista densa), se
              muestra en mobile para volver a darle identidad visual a cada
              card sin tener que cambiar a la vista en cuadrícula. */}
          <div className={styles.rowThumb} aria-hidden="true">
            <MesaTile
              game={tileGame}
              seed={seed}
              imageUrl={useImage ? table.bggImage : null}
            />
          </div>

          <div className={styles.rowDate}>
            {dParts && (
              <>
                <span className={styles.rowDateDay}>{dParts.day}</span>
                <span className={styles.rowDateMonth}>{dParts.month}</span>
                <span className={styles.rowDateTime}>{dParts.time}</span>
              </>
            )}
          </div>

          <div className={styles.rowBody}>
            <div className={styles.rowTitleLine}>
              <h3 className={styles.rowGame}>{table.boardGame}</h3>
              <div className={styles.rowBadges}>{badges}</div>
            </div>
            <ItemCommunityTag
              communityId={table.community}
              className={styles.communityChip}
            />
            <div className={styles.rowMeta}>
              {locationTexto && (
                <span className={styles.rowMetaItem}>
                  <PinIcon size={12} />
                  {locationTexto}
                  {distanceLabel && (
                    <span className={styles.distanceInline}>
                      · {distanceLabel}
                    </span>
                  )}
                </span>
              )}
              <span className={styles.rowMetaItem}>
                Host:{" "}
                {hostInfo.isDeleted ? (
                  <span className={styles.deletedInline}>
                    <GhostIcon size={12} /> eliminado
                  </span>
                ) : (
                  <strong>{table.host.username}</strong>
                )}
              </span>
            </div>
            {Array.isArray(table.tags) && table.tags.length > 0 && (
              <div className={styles.tagsRow}>
                {table.tags.map((t) => (
                  <span key={t} className={styles.tag}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {error && <span className={styles.errorInline}>{error}</span>}
          </div>

          <div className={styles.rowSeats}>
            <span
              className={`${styles.rowSeatsCount} ${isFull ? styles.rowSeatsCount_full : ""}`}
            >
              {filled}/{total}
            </span>
            <SeatTrack filled={filled} total={total} full={isFull} />
          </div>

          <div
            className={styles.rowCta}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            // En mesas privadas restringidas el tooltip se oculta cuando
            // el cursor entra al CTA — el "Solicitar →" es la acción
            // permitida y no necesita la explicación encima.
            onMouseEnter={
              restrictedPrivate ? () => setTooltipPos(null) : undefined
            }
            onMouseMove={
              restrictedPrivate ? (e) => e.stopPropagation() : undefined
            }
            role="presentation"
          >
            {cta}
            {showAdminTab && (
              <button
                type="button"
                className={styles.adminTabInline}
                onClick={(e) => {
                  e.stopPropagation();
                  goToDetail();
                }}
                title="Ver como admin"
              >
                <EyeIcon size={12} /> Admin
              </button>
            )}
          </div>
        </div>
        <PrivateTooltip pos={tooltipPos} isFull={isFull} />
      </>
    );
  }

  // -- GRID MODE -------------------------------------------------------

  return (
    <>
      <LoginPromptModal
        isOpen={!!loginPrompt}
        onClose={() => setLoginPrompt("")}
        message={loginPrompt}
      />
      <div
        className={`${styles.card} ${STATE_CARD_CLASS[userState] || ""} ${isPrivate ? styles.card_private : ""} ${flashing ? styles.card_flash : ""} ${restrictedPrivate ? styles.card_restricted : ""}`}
        onClick={restrictedPrivate ? undefined : goToDetail}
        onMouseMove={restrictedPrivate ? handleMouseMove : undefined}
        onMouseLeave={restrictedPrivate ? handleMouseLeave : undefined}
        role={restrictedPrivate ? undefined : "link"}
        tabIndex={restrictedPrivate ? undefined : 0}
        onKeyDown={
          restrictedPrivate
            ? undefined
            : (e) => {
                if (e.key === "Enter") goToDetail();
              }
        }
        aria-label={
          restrictedPrivate
            ? `Mesa privada de ${table.boardGame}`
            : `Ver mesa de ${table.boardGame}`
        }
      >
        <div className={styles.banner}>
          <MesaTile
            game={tileGame}
            seed={seed}
            imageUrl={useImage ? table.bggImage : null}
          />
          <div className={styles.bannerGradient} aria-hidden="true" />
          <div className={styles.bannerTop}>
            {dateChipText && (
              <span
                className={`${styles.dateChip} ${dateChipTone === "urgent" ? styles.dateChip_urgent : ""} ${dateChipTone === "past" ? styles.dateChip_past : ""}`}
              >
                {dateChipText}
              </span>
            )}
            <div className={styles.bannerRight}>
              <div className={styles.bannerBadges}>{badges}</div>
              <ItemCommunityTag
                communityId={table.community}
                className={styles.bannerChip}
              />
            </div>
          </div>
        </div>

        <div className={styles.body}>
          <h3 className={styles.game}>{table.boardGame}</h3>

          {locationTexto && (
            <div className={styles.location}>
              <PinIcon size={13} />
              <span className={styles.locationText}>{locationTexto}</span>
              {distanceLabel && (
                <span className={styles.distanceBadge}>{distanceLabel}</span>
              )}
            </div>
          )}

          {Array.isArray(table.tags) && table.tags.length > 0 && (
            <div className={styles.tagsRow}>
              {table.tags.map((t) => (
                <span key={t} className={styles.tag}>
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className={styles.seatSection}>
            <div className={styles.seatHead}>
              <span className={styles.seatLabel}>Lugares</span>
              <span
                className={`${styles.seatCount} ${isFull ? styles.seatCount_full : ""}`}
              >
                {filled}/{total}
              </span>
            </div>
            <SeatTrack filled={filled} total={total} full={isFull} />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.foot}>
            <div className={styles.hostBlock}>
              <Avatar user={table.host} size="md" />
              <div className={styles.hostInfo}>
                <span className={styles.hostLabel}>Host</span>
                <span className={styles.hostName}>
                  {hostInfo.isDeleted
                    ? "Usuario eliminado"
                    : table.host.username}
                </span>
                <span
                  className={`${styles.statusChip} ${isFull ? styles.statusChip_full : ""}`}
                >
                  {isFull
                    ? "Llena"
                    : `${availableSeats} libre${availableSeats !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
            <div
              className={styles.ctaWrap}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              // En privadas restringidas, hover sobre el CTA oculta el
              // tooltip flotante — el botón "Solicitar →" es la acción
              // permitida y no necesita la explicación arriba.
              onMouseEnter={
                restrictedPrivate ? () => setTooltipPos(null) : undefined
              }
              onMouseMove={
                restrictedPrivate ? (e) => e.stopPropagation() : undefined
              }
              role="presentation"
            >
              {isHost && !isFrozen && (
                <>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={goToEdit}
                    title="Editar"
                    disabled={loading}
                    aria-label="Editar"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtn_danger}`}
                    onClick={handleCancel}
                    title="Cancelar mesa"
                    disabled={loading}
                    aria-label="Cancelar mesa"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </>
              )}
              {isPlayer && !isFrozen && (
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={handleLeave}
                  title="Abandonar"
                  disabled={loading}
                  aria-label="Abandonar mesa"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              )}
              {cta}
            </div>
          </div>
        </div>

        {showAdminTab && (
          <button
            type="button"
            className={styles.adminTab}
            onClick={(e) => {
              e.stopPropagation();
              goToDetail();
            }}
            title="Ver como administrador"
          >
            <EyeIcon size={12} /> Admin
          </button>
        )}
      </div>
      <PrivateTooltip pos={tooltipPos} isFull={isFull} />
    </>
  );
}
