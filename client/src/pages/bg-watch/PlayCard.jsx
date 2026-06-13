import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../../components/shared/Avatar";
import { hasDisplayableScore } from "./playerScore";
import styles from "./BgWatchProfile.module.css";

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function relativeDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (days < 0) return "En el futuro";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `Hace ${w} ${w === 1 ? "semana" : "semanas"}`;
  }
  if (days < 365) {
    const mo = Math.floor(days / 30);
    return `Hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
  }
  const yr = Math.floor(days / 365);
  return `Hace ${yr} ${yr === 1 ? "año" : "años"}`;
}

// Día + mes abreviado (capitalizado) para el badge de fecha mobile: "18" / "May".
function dateParts(iso) {
  if (!iso) return { day: "", month: "" };
  const [y, m, d] = iso.split("-");
  const date = new Date(y, m - 1, d);
  const day = String(date.getDate());
  const monthRaw = date
    .toLocaleDateString("es-AR", { month: "short" })
    .replace(".", "");
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  return { day, month };
}

// Íconos inline del handoff "BG Watch Mobile" (sin libs de íconos). currentColor
// hereda el color del contenedor.
function PinIcon() {
  return (
    <svg
      className={styles.metaIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg
      className={styles.metaIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg
      className={styles.winnerCrownIcon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 7l4 12h12l4-12-6 4-4-9-4 9-6-4z" />
    </svg>
  );
}

// Un override local de curación (overlayName / overlayAvatar) gana sobre el
// perfil del miembro de TurnoCero — solo en la vista de BG Watch del dueño.
function resolvePlayerName(player, turnoceroUser) {
  return player.overlayName
    ? player.overlayName
    : turnoceroUser
      ? turnoceroUser.displayName || turnoceroUser.username
      : player.name || player.username || "Anónimo";
}

function PlayerChip({ player, turnoceroUser }) {
  const name = resolvePlayerName(player, turnoceroUser);

  const content = (
    <>
      {player.win && (
        <span className={styles.winIcon} aria-label="Ganador">
          🏆
        </span>
      )}
      {player.new && (
        <span
          className={styles.newIcon}
          aria-label="Nuevo"
          title="Primera vez que lo jugó"
        >
          ✨
        </span>
      )}
      {player.overlayAvatar?.url ? (
        <Avatar
          user={{
            _id: player.username || player.name,
            displayName: name,
            avatar: player.overlayAvatar,
          }}
          size="xs"
        />
      ) : (
        turnoceroUser && <Avatar user={turnoceroUser} size="xs" />
      )}
      <span className={styles.playerName}>{name}</span>
      {hasDisplayableScore(player.score) && (
        <span className={styles.playerScore}>{player.score}</span>
      )}
    </>
  );

  const classes = `${styles.playerChip} ${player.win ? styles.playerChipWinner : ""} ${turnoceroUser ? styles.playerChipLinked : ""}`;

  if (turnoceroUser) {
    return (
      <Link
        to={`/usuarios/${turnoceroUser._id}`}
        className={classes}
        onClick={(e) => e.stopPropagation()}
        title={`Ver perfil de ${name}`}
      >
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}

function PlayCardMenu({ onEdit, onDelete, onLogAnother }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const stop = (e) => e.stopPropagation();
  const handle = (e, fn) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <div
      className={styles.playCardMenu}
      ref={ref}
      onClick={stop}
      onKeyDown={stop}
    >
      <button
        type="button"
        className={styles.playCardMenuBtn}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Acciones"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className={styles.playCardMenuPop} role="menu">
          {onLogAnother && (
            <button
              type="button"
              className={styles.playCardMenuItem}
              role="menuitem"
              onClick={(e) => handle(e, onLogAnother)}
            >
              Cargar otra partida
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className={styles.playCardMenuItem}
              role="menuitem"
              onClick={(e) => handle(e, onEdit)}
            >
              Editar
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={`${styles.playCardMenuItem} ${styles.playCardMenuItemDanger}`}
              role="menuitem"
              onClick={(e) => handle(e, onDelete)}
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayCard({
  play,
  userMap,
  bggUsername,
  onClick,
  onEdit,
  onDelete,
  onLogAnother,
  index = 0,
}) {
  // Resultado del dueño del perfil: buscamos su asiento por username. Solo
  // mostramos el pill cuando lo encontramos (en partidas ajenas o sin match no
  // hay "ganaste/perdiste" que afirmar).
  const ownerSeat = useMemo(() => {
    if (!bggUsername || !play.players) return null;
    const lower = bggUsername.toLowerCase();
    return (
      play.players.find((p) => (p.username || "").toLowerCase() === lower) ||
      null
    );
  }, [play.players, bggUsername]);

  const sortedPlayers = useMemo(() => {
    if (!play.players || play.players.length === 0) return [];
    return [...play.players].sort((a, b) => {
      if (a.win !== b.win) return a.win ? -1 : 1;
      const aPos = a.position ? Number(a.position) : 999;
      const bPos = b.position ? Number(b.position) : 999;
      if (Number.isFinite(aPos) && Number.isFinite(bPos) && aPos !== bPos)
        return aPos - bPos;
      return 0;
    });
  }, [play.players]);

  // Línea de ganador (solo --phone, vía CSS): corona + avatar(es) + "Ganó X".
  // Los chips de todos los jugadores quedan para desktop.
  const winners = useMemo(
    () => sortedPlayers.filter((p) => p.win),
    [sortedPlayers],
  );

  const totalPlayers = play.players?.length || 0;

  // Victoria colectiva (equipos / cooperativa): más de un ganador. En ese caso
  // el "puesto" individual no tiene sentido, así que la columna derecha muestra
  // el resultado del equipo en vez de la posición.
  const isCollective = winners.length > 1;
  const teamWin = ownerSeat ? !!ownerSeat.win : true;
  const teamLabel = isCollective
    ? teamWin
      ? "Ganaron en equipo"
      : "Perdieron"
    : null;

  // Columna derecha (mobile): puesto del dueño sobre el total + su puntaje.
  // En perfiles ajenos (sin asiento del dueño) caemos al puntaje del ganador,
  // sin pastilla de puesto.
  const ownerPos = ownerSeat?.position ? Number(ownerSeat.position) : null;
  const rankLabel = ownerSeat
    ? ownerPos
      ? `${ownerPos}º de ${totalPlayers}`
      : ownerSeat.win
        ? "Ganaste"
        : "Perdiste"
    : null;
  const rightScore = ownerSeat
    ? hasDisplayableScore(ownerSeat.score)
      ? ownerSeat.score
      : null
    : winners[0] && hasDisplayableScore(winners[0].score)
      ? winners[0].score
      : null;

  const { day: dateDay, month: dateMonth } = dateParts(play.date);

  const truncatedComment = play.comments
    ? play.comments.length > 80
      ? `${play.comments.slice(0, 80)}…`
      : play.comments
    : null;

  const interactive = typeof onClick === "function";

  return (
    <div
      className={`${styles.playCard} ${interactive ? styles.playCardInteractive : ""} ${ownerSeat?.win ? styles.playCardWin : ""}`}
      style={{ "--i": index }}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className={styles.playDateBadge} aria-hidden="true">
        <span className={styles.playDateBadgeDay}>{dateDay}</span>
        <span className={styles.playDateBadgeMonth}>{dateMonth}</span>
      </div>

      <div className={styles.playThumb}>
        {play.gameThumbnail ? (
          <img
            src={play.gameThumbnail}
            alt={play.gameName || ""}
            loading="lazy"
          />
        ) : (
          <span className={styles.playThumbFallback}>🎲</span>
        )}
      </div>

      <div className={styles.playBody}>
        <div className={styles.playTopRow}>
          <span className={styles.playGameName}>{play.gameName || "—"}</span>
          <span className={styles.playDateBlock}>
            {ownerSeat && (
              <span
                className={`${styles.playOutcome} ${ownerSeat.win ? styles.playOutcomeWin : styles.playOutcomeLoss}`}
              >
                {ownerSeat.win ? "✦ " : "○ "}
                {/* En partidas por equipos/coop el resultado es del equipo,
                    como en mobile ("Ganaron en equipo" / "Perdieron"). */}
                {isCollective
                  ? teamLabel
                  : ownerSeat.win
                    ? "Ganaste"
                    : "Perdiste"}
              </span>
            )}
            <span className={styles.playDateRelative}>
              {relativeDate(play.date)}
            </span>
            <span className={styles.playDateAbs}>{formatDate(play.date)}</span>
          </span>
          {(onEdit || onDelete || onLogAnother) && (
            <PlayCardMenu
              onEdit={onEdit}
              onDelete={onDelete}
              onLogAnother={onLogAnother}
            />
          )}
        </div>

        {sortedPlayers.length > 0 && (
          <div className={styles.playPlayers}>
            {sortedPlayers.map((p, i) => (
              <PlayerChip
                key={`${p.username || p.name || "anon"}-${i}`}
                player={p}
                turnoceroUser={
                  p.username ? userMap?.[p.username.toLowerCase()] : null
                }
              />
            ))}
          </div>
        )}

        {/* Meta compacta (solo --phone): lugar + cantidad de jugadores. */}
        <div className={styles.playMeta}>
          {play.location && (
            <span className={styles.playMetaItem}>
              <PinIcon />
              {play.location}
            </span>
          )}
          {totalPlayers > 0 && (
            <span className={styles.playMetaItem}>
              <PeopleIcon />
              {totalPlayers} jug.
            </span>
          )}
        </div>

        {/* Roster (solo --phone): corona + TODOS los avatares, con el/los
            ganador(es) primero (pegados a la corona) y separados del resto por
            un pequeño gap. El resultado va a la columna derecha. */}
        {sortedPlayers.length > 0 && (
          <div className={styles.playWinnerLine}>
            {winners.length > 0 && (
              <span className={styles.playWinnerCrown}>
                <CrownIcon />
              </span>
            )}
            <span className={styles.playWinnerAvatars}>
              {sortedPlayers.map((p, i) => {
                const tcUser = p.username
                  ? userMap?.[p.username.toLowerCase()]
                  : null;
                const name = resolvePlayerName(p, tcUser);
                const avUser = p.overlayAvatar?.url
                  ? {
                      _id: p.username || p.name,
                      displayName: name,
                      avatar: p.overlayAvatar,
                    }
                  : tcUser || {
                      _id: p.username || p.name || name,
                      username: p.username,
                      displayName: name,
                    };
                // El primer no-ganador abre un gap respecto del bloque de
                // ganadores (separa al/los ganador(es) del resto).
                const splitFromWinners =
                  winners.length > 0 && !p.win && i === winners.length;
                return (
                  <Avatar
                    key={`${p.username || p.name || "anon"}-${i}`}
                    user={avUser}
                    size="xs"
                    className={splitFromWinners ? styles.rosterSplit : ""}
                  />
                );
              })}
            </span>
          </div>
        )}

        <div className={styles.playTags}>
          {play.location && (
            <span className={styles.playTag}>
              <span className={styles.tagIcon}>📍</span>
              {play.location}
            </span>
          )}
          {play.duration > 0 && (
            <span className={styles.playTag}>
              <span className={styles.tagIcon}>⏱</span>
              {play.duration} min
            </span>
          )}
          {play.quantity > 1 && (
            <span className={styles.playTag}>×{play.quantity} partidas</span>
          )}
          {play.incomplete && (
            <span className={`${styles.playTag} ${styles.playTagWarn}`}>
              Incompleta
            </span>
          )}
          {truncatedComment && (
            <span className={styles.playTagComment}>
              <span className={styles.tagIcon}>💬</span>
              {truncatedComment}
            </span>
          )}
        </div>
      </div>

      {/* Columna derecha (solo --phone): resultado + puntaje. En victorias
          colectivas el puesto individual se reemplaza por el resultado del
          equipo ("Ganaron en equipo" / "Perdieron"). */}
      {(teamLabel || rankLabel || rightScore != null) && (
        <div className={styles.playRight}>
          {isCollective
            ? teamLabel && (
                <span
                  className={`${styles.playTeamResult} ${teamWin ? styles.playTeamResultWin : styles.playTeamResultLoss}`}
                >
                  {teamLabel}
                </span>
              )
            : rankLabel && (
                <span
                  className={`${styles.playRankPill} ${ownerSeat?.win ? styles.playRankPillWin : styles.playRankPillLoss}`}
                >
                  {ownerSeat?.win ? "✦" : "○"} {rankLabel}
                </span>
              )}
          {rightScore != null && (
            <span className={styles.playRightScore}>{rightScore}</span>
          )}
        </div>
      )}
    </div>
  );
}
