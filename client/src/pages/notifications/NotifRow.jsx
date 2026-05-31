import Avatar from "../../components/shared/Avatar";
import NotifIcon from "./NotifIcons";
import {
  getDomainMeta,
  getNotifMeta,
  getCountBadge,
  isActionable,
  notifTarget,
} from "../../utils/notifDomains";
import { formatTimeAgo } from "../../utils/time";
import styles from "./NotifRow.module.css";

// Deriva los actores a pintar. Tipos agregables traen `actors[]`; amigos/dm no,
// pero tienen fromUserId/fromUsername → fallback a un actor único.
function getActors(n) {
  if (Array.isArray(n.actors) && n.actors.length) return n.actors;
  if (n.fromUserId)
    return [{ userId: n.fromUserId, username: n.fromUsername || "" }];
  return [];
}

export default function NotifRow({
  notif,
  onNavigate,
  onMarkRead,
  onDismiss,
  onAccept,
  onReject,
}) {
  const domain = getDomainMeta(notif.type);
  const meta = getNotifMeta(notif);
  const actors = getActors(notif);
  const countBadge = getCountBadge(notif);
  const grouped = actors.length > 1;

  // ¿Se puede resolver inline (aceptar/rechazar) desde la fila?
  const canInline =
    notif.type === "friend_request"
      ? !!notif.fromUserId
      : notif.type === "join_request"
        ? actors.length <= 1 && !!actors[0]?.userId
        : false;
  const showActions = isActionable(notif) && canInline;

  const rowClass = [
    styles.row,
    !notif.read && styles.unread,
    showActions && styles.actionable,
  ]
    .filter(Boolean)
    .join(" ");

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNavigate(notif);
    }
  };

  const domainPip = (
    <span
      className={styles.pip}
      style={{ "--rowColor": `var(${domain.colorVar})` }}
    >
      <NotifIcon name={domain.icon} size={11} />
    </span>
  );

  return (
    <li
      className={rowClass}
      style={{ "--rowColor": `var(${domain.colorVar})` }}
    >
      {/* Visual izquierdo: 3 variantes */}
      {grouped ? (
        <span className={styles.avatarStack}>
          <span className={styles.groupAvatars}>
            {actors.slice(0, 3).map((a, i) => (
              <Avatar
                key={a.userId || i}
                user={{ _id: a.userId, username: a.username }}
                size="sm"
                className={styles.gAv}
              />
            ))}
            {actors.length > 3 && (
              <span className={`${styles.gAv} ${styles.gMore}`}>
                +{actors.length - 3}
              </span>
            )}
          </span>
          {domainPip}
        </span>
      ) : actors.length === 1 ? (
        <span className={styles.avatarStack}>
          <Avatar
            user={{ _id: actors[0].userId, username: actors[0].username }}
            size="md"
          />
          {domainPip}
        </span>
      ) : (
        <span
          className={styles.domainIcon}
          style={{ "--rowColor": `var(${domain.colorVar})` }}
        >
          <NotifIcon name={domain.icon} size={19} />
        </span>
      )}

      {/* Cuerpo clickeable → navega al recurso */}
      <div
        className={styles.body}
        role="link"
        tabIndex={0}
        onClick={() => onNavigate(notif)}
        onKeyDown={handleKey}
      >
        <div className={styles.topline}>
          {!notif.read && <span className={styles.unreadDot} />}
          <span className={styles.domainTag}>{domain.label}</span>
          {notifTarget(notif) && (
            <span className={styles.target}>· {notifTarget(notif)}</span>
          )}
          {countBadge && (
            <span className={styles.countBadge}>{countBadge}</span>
          )}
          <span className={styles.time}>
            {formatTimeAgo(notif.updatedAt || notif.timestamp)}
          </span>
        </div>
        <span className={styles.title}>{meta.title}</span>
        {meta.body && <span className={styles.text}>{meta.body}</span>}

        {/* Acciones inline */}
        {showActions ? (
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.btnReject}
              onClick={stop(() => onReject(notif))}
            >
              Rechazar
            </button>
            <button
              type="button"
              className={styles.btnAccept}
              onClick={stop(() => onAccept(notif))}
            >
              <NotifIcon name="Check" size={13} /> Aceptar
            </button>
          </div>
        ) : (
          meta.cta && (
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={stop(() => onNavigate(notif))}
              >
                {meta.cta} <NotifIcon name="Arrow" size={13} />
              </button>
            </div>
          )
        )}
      </div>

      {/* Affordances de hover */}
      <div className={styles.hoverActions}>
        {!notif.read && (
          <button
            type="button"
            className={styles.hoverBtn}
            onClick={stop(() => onMarkRead(notif))}
            aria-label="Marcar como leída"
            title="Marcar como leída"
          >
            <NotifIcon name="Check" size={14} />
          </button>
        )}
        <button
          type="button"
          className={styles.hoverBtn}
          onClick={stop(() => onDismiss(notif))}
          aria-label="Descartar"
          title="Descartar"
        >
          <NotifIcon name="X" size={14} />
        </button>
      </div>
    </li>
  );
}
