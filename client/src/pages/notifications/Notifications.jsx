import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useNotifications } from "../../context/NotificationContext";
import { useChat } from "../../context/ChatContext";
import { API } from "../../api/endpoints";
import { acceptFriendRequest, rejectFriendRequest } from "../../queries/users";
import { acceptJoinRequest, rejectJoinRequest } from "../../queries/tables";
import {
  getDomain,
  isActionable,
  notifBucket,
  notifLink,
  NOTIF_BUCKET_KEYS,
  getBucketLabel,
} from "../../utils/notifDomains";
import EmptyState from "../../components/shared/EmptyState";
import { ArtNotif, ArtSearch } from "../../components/shared/EmptyArt";
import NotifRow from "./NotifRow";
import ResolvedRow from "./ResolvedRow";
import SharedPlayNotifCard from "./SharedPlayNotifCard";
import SidePanel from "./SidePanel";
import NotifIcon from "./NotifIcons";
import styles from "./Notifications.module.css";

const DOMAIN_FILTERS = [
  { value: "mesa", label: "Mesas" },
  { value: "evento", label: "Eventos" },
  { value: "torneo", label: "Torneos" },
  { value: "amigo", label: "Amigos" },
  { value: "compartida", label: "Compartidas" },
  { value: "bgwatch", label: "BG Watch" },
  { value: "admin", label: "Admin" },
];

const notifTime = (n) => new Date(n.updatedAt || n.timestamp || 0).getTime();
const notifId = (n) =>
  n.notifId ||
  n._id ||
  `${n.type}:${n.tableId ?? n.fromUserId ?? n.torneoId ?? n.compartidaId ?? n.eventoId ?? "g"}`;

const matchesFilter = (n, filter) => {
  if (filter === "all") return true;
  if (filter === "unread") return !n.read;
  if (filter === "actionable") return isActionable(n);
  return getDomain(n.type) === filter;
};

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    markRead,
    markReadFriend,
    markReadTorneo,
    markReadCompartida,
    markReadEvento,
    markReadCommunity,
    markReadDm,
    markReadAdminChat,
    markAllRead,
    loadOlder,
    clearAll,
    dismiss,
    notifyFriendAdded,
    addToast,
  } = useNotifications();
  const { clearConversationUnread } = useChat();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [filter, setFilter] = useState("all");
  const [resolved, setResolved] = useState({}); // id -> 'accept' | 'reject'
  const [, setNow] = useState(() => Date.now());
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhaustedOlder, setExhaustedOlder] = useState(false);
  const timers = useRef({});

  // Refresca timestamps relativos cada minuto.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach((id) => clearTimeout(id));
  }, []);

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => notifTime(b) - notifTime(a)),
    [notifications],
  );
  const hasUnread = unreadCount > 0;

  const filtered = useMemo(
    () => sorted.filter((n) => matchesFilter(n, filter)),
    [sorted, filter],
  );

  const counts = useMemo(() => {
    const c = { all: 0, unread: 0, actionable: 0 };
    for (const n of notifications) {
      c.all += 1;
      if (!n.read) c.unread += 1;
      if (isActionable(n)) c.actionable += 1;
      const d = getDomain(n.type);
      c[d] = (c[d] || 0) + 1;
    }
    return c;
  }, [notifications]);

  const buckets = useMemo(() => {
    const groups = { today: [], week: [], earlier: [] };
    for (const n of filtered) {
      groups[notifBucket(n.updatedAt || n.timestamp)].push(n);
    }
    return groups;
  }, [filtered]);

  // markRead por recurso (un row ≈ un recurso → marca su doc leído).
  const markNotifRead = (n) => {
    if (n.type === "admin_chat") return markReadAdminChat();
    if (n.type === "dm") {
      axios.patch(API.dm.READ(n.fromUserId)).catch(() => {});
      markReadDm(n.fromUserId);
      clearConversationUnread(n.fromUserId);
      return;
    }
    if (n.compartidaId) return markReadCompartida(n.compartidaId);
    if (n.eventoId) return markReadEvento(n.eventoId);
    if (n.communityId) return markReadCommunity(n.communityId);
    if (n.type?.startsWith("tournament_")) return markReadTorneo(n.torneoId);
    if (n.fromUserId) return markReadFriend(n.fromUserId);
    return markRead(n.tableId);
  };

  const handleNavigate = (n) => {
    markNotifRead(n);
    navigate(notifLink(n));
  };

  // Confirmación visual + markRead diferido tras aceptar/rechazar.
  const resolveLater = (n, action) => {
    const id = notifId(n);
    setResolved((prev) => ({ ...prev, [id]: action }));
    timers.current[id] = setTimeout(() => {
      markNotifRead(n);
      setResolved((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 1800);
  };

  const handleAccept = async (n) => {
    try {
      if (n.type === "friend_request") {
        await acceptFriendRequest(n.fromUserId);
        notifyFriendAdded();
      } else if (n.type === "join_request") {
        const userId = n.actors?.[0]?.userId;
        await acceptJoinRequest(n.tableId, userId);
      }
      resolveLater(n, "accept");
    } catch {
      addToast({
        type: "error",
        message: "No pudimos completar la acción. Intentá de nuevo.",
      });
    }
  };

  const handleReject = async (n) => {
    try {
      if (n.type === "friend_request") {
        await rejectFriendRequest(n.fromUserId);
      } else if (n.type === "join_request") {
        const userId = n.actors?.[0]?.userId;
        await rejectJoinRequest(n.tableId, userId);
      }
      resolveLater(n, "reject");
    } catch {
      addToast({
        type: "error",
        message: "No pudimos completar la acción. Intentá de nuevo.",
      });
    }
  };

  const handleLoadOlder = async () => {
    setLoadingOlder(true);
    const { count } = await loadOlder();
    setLoadingOlder(false);
    if (count === 0) setExhaustedOlder(true);
  };

  const handleClearAll = () => {
    if (
      !window.confirm(
        "¿Eliminar todas las notificaciones? Esta acción no se puede deshacer.",
      )
    )
      return;
    clearAll();
  };

  const filters = [
    { value: "all", label: "Todas", count: counts.all },
    { value: "unread", label: "Sin leer", count: counts.unread },
    {
      value: "actionable",
      label: "Requieren acción",
      count: counts.actionable,
      alert: true,
    },
    ...DOMAIN_FILTERS.filter((d) => counts[d.value] > 0).map((d) => ({
      ...d,
      count: counts[d.value],
    })),
  ];

  // Chips data-driven para el vacío "por filtro": otros filtros con datos
  // reales (excluyendo "Todas" — eso lo cubre el botón "Ver todas" — y el
  // filtro activo).
  const emptyFilterChips = filters
    .filter((f) => f.value !== "all" && f.value !== filter && f.count > 0)
    .map((f) => ({
      label: f.label,
      count: f.count,
      onClick: () => setFilter(f.value),
    }));

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <main className={styles.main}>
          <header className={styles.hero}>
            <div className={styles.heroLeft}>
              <div className={styles.eyebrow}>
                Bandeja · {unreadCount} sin leer
              </div>
              <h1 className={styles.title}>
                Tu <em>actividad</em>.
              </h1>
              <p className={styles.heroSub}>
                Todo lo que pasó en tus mesas, eventos, torneos y compartidas.
              </p>
            </div>
            {notifications.length > 0 && (
              <div className={styles.heroActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => markAllRead()}
                  disabled={!hasUnread}
                >
                  <NotifIcon name="DoubleCheck" size={15} /> Marcar todas
                </button>
                <button className={styles.actionBtn} onClick={handleClearAll}>
                  <NotifIcon name="X" size={14} /> Limpiar
                </button>
              </div>
            )}
          </header>

          {notifications.length > 0 && (
            <div className={styles.filters}>
              {filters.map((f) => (
                <button
                  key={f.value}
                  className={`${styles.chip} ${filter === f.value ? styles.chipActive : ""} ${f.alert && f.count > 0 ? styles.chipAlert : ""}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                  {f.count > 0 && (
                    <span className={styles.chipCount}>· {f.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {notifications.length === 0 ? (
            <EmptyState
              art={<ArtNotif />}
              eyebrow="Bandeja al día"
              title={
                <>
                  Estás <em>al día.</em>
                </>
              }
              text="No tenés notificaciones nuevas. Cuando alguien se sume a tu mesa, te etiquete o haya novedades, aparece acá."
              secondary={{
                label: "Explorar mesas",
                icon: "compass",
                to: "/mesas",
              }}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              variant="filtered"
              compact
              art={<ArtSearch />}
              eyebrow="Sin coincidencias"
              title={
                <>
                  Nada en <em>este filtro.</em>
                </>
              }
              text="No hay notificaciones de este tipo."
              chips={emptyFilterChips}
              secondary={{
                label: "Ver todas",
                icon: "clear",
                onClick: () => setFilter("all"),
              }}
            />
          ) : (
            <>
              {NOTIF_BUCKET_KEYS.map(
                (bucketKey) =>
                  buckets[bucketKey].length > 0 && (
                    <section key={bucketKey} className={styles.bucket}>
                      <div className={styles.bucketHeader}>
                        <span className={styles.bucketLabel}>
                          {getBucketLabel(bucketKey, t)}
                        </span>
                        <span className={styles.bucketRule} />
                        <span className={styles.bucketCount}>
                          {buckets[bucketKey].length}
                        </span>
                      </div>
                      <ul className={styles.list}>
                        {buckets[bucketKey].map((n) => {
                          const id = notifId(n);
                          if (resolved[id]) {
                            return (
                              <ResolvedRow
                                key={id}
                                notif={n}
                                action={resolved[id]}
                              />
                            );
                          }
                          if (n.type === "bgg_play_shared") {
                            return <SharedPlayNotifCard key={id} notif={n} />;
                          }
                          return (
                            <NotifRow
                              key={id}
                              notif={n}
                              onNavigate={handleNavigate}
                              onMarkRead={markNotifRead}
                              onDismiss={(notif) => dismiss(notifId(notif))}
                              onAccept={handleAccept}
                              onReject={handleReject}
                            />
                          );
                        })}
                      </ul>
                    </section>
                  ),
              )}

              {!exhaustedOlder && notifications.length >= 20 && (
                <div className={styles.loadMoreRow}>
                  <button
                    className={styles.loadMoreBtn}
                    onClick={handleLoadOlder}
                    disabled={loadingOlder}
                  >
                    {loadingOlder ? "Cargando…" : "Cargar más antiguas"}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <SidePanel notifications={notifications} />
      </div>
    </div>
  );
}
