import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useNotifications } from '../../context/NotificationContext';
import { useChat } from '../../context/ChatContext';
import { formatTimeAgo } from '../../utils/time';
import styles from './Notifications.module.css';

const CATEGORIES = {
  mesas:       new Set(['chat', 'comment', 'image', 'join_request', 'join_accepted', 'spot_opened', 'table_cancelled', 'join_rejected']),
  torneos:     new Set(['tournament_accepted', 'tournament_rejected', 'tournament_advanced', 'tournament_eliminated', 'tournament_started', 'tournament_finished']),
  amigos:      new Set(['friend_request', 'friend_accepted', 'dm']),
  compartidas: new Set(['compartida_comment', 'compartida_like']),
  admin:       new Set(['admin_chat']),
};

const CATEGORY_LABELS = {
  all:         'Todas',
  mesas:       'Mesas',
  torneos:     'Torneos',
  amigos:      'Amigos',
  compartidas: 'Compartidas',
  admin:       'Admin',
};

const getCategory = (type) => {
  for (const [cat, set] of Object.entries(CATEGORIES)) {
    if (set.has(type)) return cat;
  }
  return 'mesas';
};

function getNotifMeta(n) {
  switch (n.type) {
    case 'join_accepted':
      return {
        icon: '✅',
        countLabel: '¡Aceptado!',
        preview: `Ya sos parte de la mesa de ${n.tableName}`,
        chipClass: 'accepted',
      };
    case 'join_request':
      return {
        icon: '🔔',
        countLabel: `${n.count} ${n.count === 1 ? 'solicitud' : 'solicitudes'}`,
        preview: `${n.lastRequesterUsername} quiere unirse`,
        chipClass: 'request',
      };
    case 'friend_request':
      return {
        icon: '🤝',
        countLabel: 'Solicitud de amistad',
        preview: `${n.fromUsername} te envió una solicitud de amistad`,
        chipClass: 'request',
      };
    case 'friend_accepted':
      return {
        icon: '✅',
        countLabel: '¡Amigos!',
        preview: `${n.fromUsername} aceptó tu solicitud de amistad`,
        chipClass: 'accepted',
      };
    case 'comment':
      return {
        icon: '🗨️',
        countLabel: `${n.count} ${n.count === 1 ? 'comentario nuevo' : 'comentarios nuevos'}`,
        preview: `${n.lastCommenterUsername}: ${n.lastCommentPreview ?? ''}${(n.lastCommentPreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
      };
    case 'image':
      return {
        icon: '📸',
        countLabel: `${n.count} ${n.count === 1 ? 'foto nueva' : 'fotos nuevas'}`,
        preview: `${n.lastUploaderUsername} subió una foto`,
        chipClass: 'chat',
      };
    case 'spot_opened':
      return {
        icon: '🎯',
        countLabel: '¡Lugar disponible!',
        preview: `Se liberó un lugar en ${n.tableName}`,
        chipClass: 'request',
      };
    case 'tournament_accepted':
      return {
        icon: '🏆',
        countLabel: '¡Inscripción aprobada!',
        preview: `Ya estás dentro del torneo`,
        chipClass: 'accepted',
      };
    case 'tournament_rejected':
      return {
        icon: '🚫',
        countLabel: 'Inscripción rechazada',
        preview: `Tu inscripción al torneo fue rechazada`,
        chipClass: 'request',
      };
    case 'tournament_advanced': {
      const label = n.isPhase ? 'fase' : 'ronda';
      const nextNum = n.round != null ? n.round + 1 : null;
      return {
        icon: '🎉',
        countLabel: `¡Pasaste de ${label}!`,
        preview: `Avanzaste a la ${nextNum != null ? `${label} ${nextNum}` : `siguiente ${label}`}`,
        chipClass: 'accepted',
      };
    }
    case 'tournament_eliminated':
      return {
        icon: '🥲',
        countLabel: 'Quedaste fuera',
        preview: `Suerte la próxima 🎲`,
        chipClass: 'request',
      };
    case 'tournament_started':
      return {
        icon: '🚀',
        countLabel: '¡Empezó el torneo!',
        preview: `${n.torneoTitle} ya está en juego`,
        chipClass: 'accepted',
      };
    case 'tournament_finished':
      return {
        icon: '🏁',
        countLabel: 'Torneo finalizado',
        preview: `Terminó ${n.torneoTitle}`,
        chipClass: 'request',
      };
    case 'compartida_comment':
      return {
        icon: '🗨️',
        countLabel: `${n.count} ${n.count === 1 ? 'comentario nuevo' : 'comentarios nuevos'}`,
        preview: `${n.lastCommenterUsername}: ${n.lastCommentPreview ?? ''}${(n.lastCommentPreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
      };
    case 'compartida_like':
      return {
        icon: '❤️',
        countLabel: `${n.count} ${n.count === 1 ? 'like nuevo' : 'likes nuevos'}`,
        preview: `${n.lastSenderUsername} le dio like a tu compartida`,
        chipClass: 'accepted',
      };
    case 'table_cancelled':
      return {
        icon: '❌',
        countLabel: 'Mesa cancelada',
        preview: `Se canceló ${n.tableName}`,
        chipClass: 'request',
      };
    case 'join_rejected':
      return {
        icon: '🚷',
        countLabel: 'Solicitud rechazada',
        preview: `Tu solicitud para ${n.tableName} fue rechazada`,
        chipClass: 'request',
      };
    case 'dm':
      return {
        icon: '💬',
        countLabel: `${n.count} ${n.count === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`,
        preview: `${n.fromUsername}: ${n.lastMessagePreview ?? ''}${(n.lastMessagePreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
      };
    case 'admin_chat':
      return {
        icon: '🛡️',
        countLabel: `${n.count} ${n.count === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`,
        preview: `${n.lastSenderUsername}: ${n.lastMessagePreview ?? ''}${(n.lastMessagePreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
      };
    default:
      return {
        icon: '🎲',
        countLabel: `${n.count} ${n.count === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`,
        preview: `${n.lastSenderUsername}: ${n.lastMessagePreview ?? ''}${(n.lastMessagePreview?.length ?? 0) >= 60 ? '…' : ''}`,
        chipClass: 'chat',
      };
  }
}

const getNotifTime = (n) => new Date(n.updatedAt || n.timestamp || 0).getTime();

export default function Notifications() {
  const { notifications, markRead, markReadFriend, markReadTorneo, markReadCompartida, markReadDm, markReadAdminChat, markAllRead, loadOlder, clearAll } = useNotifications();
  const { clearConversationUnread } = useChat();
  const [tab, setTab] = useState('all');
  const [category, setCategory] = useState('all');
  const [, setNow] = useState(Date.now());
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhaustedOlder, setExhaustedOlder] = useState(false);

  const handleLoadOlder = async () => {
    setLoadingOlder(true);
    const { count } = await loadOlder();
    setLoadingOlder(false);
    if (count === 0) setExhaustedOlder(true);
  };

  // Refresh relative timestamps every minute
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...notifications].sort((a, b) => getNotifTime(b) - getNotifTime(a));
  const hasUnread = notifications.some((n) => !n.read);

  const filtered = sorted.filter((n) => {
    if (tab === 'unread' && n.read) return false;
    if (category !== 'all' && getCategory(n.type) !== category) return false;
    return true;
  });

  const unreadCountByCategory = (cat) => notifications.filter(
    (n) => !n.read && (cat === 'all' || getCategory(n.type) === cat)
  ).length;

  const markNotifRead = (n) => {
    if (n.type === 'admin_chat') return markReadAdminChat();
    if (n.type === 'dm') {
      axios.patch(`/api/dm/${n.fromUserId}/read`).catch(() => {});
      markReadDm(n.fromUserId);
      clearConversationUnread(n.fromUserId);
      return;
    }
    if (n.compartidaId) return markReadCompartida(n.compartidaId);
    if (n.type?.startsWith('tournament_')) return markReadTorneo(n.torneoId);
    if (n.fromUserId) return markReadFriend(n.fromUserId);
    return markRead(n.tableId);
  };

  const handleClearAll = () => {
    if (!window.confirm('¿Eliminar todas las notificaciones? Esta acción no se puede deshacer.')) return;
    clearAll();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heroBlock}>
          <div className={styles.eyebrow}>◆ ACTIVIDAD</div>
          <h1 className={styles.heroTitle}>Notificaciones</h1>
          <p className={styles.heroSub}>Tus últimas notificaciones.</p>
        </div>
        {notifications.length > 0 && (
          <div className={styles.headerActions}>
            <button
              className={styles.markAllBtn}
              onClick={() => markAllRead()}
              disabled={!hasUnread}
            >
              Marcar como leídas
            </button>
            <button className={styles.clearBtn} onClick={handleClearAll}>
              Limpiar
            </button>
          </div>
        )}
      </div>

      {sorted.length > 0 && (
        <>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`}
              onClick={() => setTab('all')}
            >
              Todas
            </button>
            <button
              className={`${styles.tab} ${tab === 'unread' ? styles.tabActive : ''}`}
              onClick={() => setTab('unread')}
            >
              Sin leer
              {hasUnread && <span className={styles.tabCount}>{unreadCountByCategory('all')}</span>}
            </button>
          </div>

          <div className={styles.categoryChips}>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const unread = unreadCountByCategory(key);
              return (
                <button
                  key={key}
                  className={`${styles.catChip} ${category === key ? styles.catChipActive : ''}`}
                  onClick={() => setCategory(key)}
                >
                  {label}
                  {unread > 0 && <span className={styles.catChipBadge}>{unread}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔔</span>
          <p className={styles.emptyText}>Sin notificaciones</p>
          <p className={styles.emptySub}>Cuando alguien te escriba, comente o invite, vas a verlo acá.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔍</span>
          <p className={styles.emptyText}>Sin resultados</p>
          <p className={styles.emptySub}>Probá cambiar el filtro.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {filtered.map((n) => {
            const { icon, countLabel, preview, chipClass } = getNotifMeta(n);
            const isTorneo = n.type?.startsWith('tournament_');
            const to =
              n.type === 'admin_chat' ? '/mensajes-admin' :
              n.type === 'dm' ? `/mensajes/${n.fromUserId}` :
              n.compartidaId ? `/compartidas/${n.compartidaId}` :
              isTorneo ? `/torneos/${n.torneoId}` :
              n.fromUserId ? `/usuarios/${n.fromUserId}` :
              `/mesas/${n.tableId}`;
            const handleClick = () => markNotifRead(n);
            const handleMarkRead = (e) => {
              e.preventDefault();
              e.stopPropagation();
              markNotifRead(n);
            };
            return (
              <li key={`${n.type ?? 'chat'}:${n.tableId ?? n.fromUserId ?? n.torneoId ?? n.compartidaId ?? 'global'}`}>
                <Link
                  to={to}
                  className={`${styles.card} ${n.read ? styles.cardRead : ''}`}
                  onClick={handleClick}
                >
                  <div className={styles.cardIconWrap}>
                    <span className={styles.cardIcon}>{icon}</span>
                    {!n.read && <span className={styles.unreadDot} />}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardGame}>
                        {n.type === 'admin_chat'
                          ? 'Chat de admins'
                          : (n.tableName || n.fromUsername || n.torneoTitle || n.compartidaTitle || 'Compartida')}
                      </span>
                      {!n.read && (
                        <span className={`${styles.chip} ${styles[chipClass]}`}>
                          {countLabel}
                        </span>
                      )}
                    </div>
                    <span className={styles.cardPreview}>{preview}</span>
                    <span className={styles.cardTime}>{formatTimeAgo(n.updatedAt || n.timestamp)}</span>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      className={styles.markReadBtn}
                      onClick={handleMarkRead}
                      aria-label="Marcar como leída"
                      title="Marcar como leída"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  )}
                </Link>
              </li>
            );
          })}
          {!exhaustedOlder && notifications.length >= 20 && (
            <li className={styles.loadMoreRow}>
              <button
                className={styles.loadMoreBtn}
                onClick={handleLoadOlder}
                disabled={loadingOlder}
              >
                {loadingOlder ? 'Cargando…' : 'Cargar más antiguas'}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
