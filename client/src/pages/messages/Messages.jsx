import Meeple from "../../components/shared/Meeple";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useUsersListQuery } from "../../queries/users";
import Avatar from "../../components/shared/Avatar";
import styles from "./Messages.module.css";

const DESKTOP_BREAKPOINT = 960;

function formatRelativeTime(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function Messages() {
  const { user } = useAuth();
  const { conversations, openChat } = useChat();
  const navigate = useNavigate();
  const [showNewChat, setShowNewChat] = useState(false);
  const [search, setSearch] = useState("");

  // Load friends list for "new conversation" picker
  const { data: allUsers = [] } = useUsersListQuery(
    {},
    { enabled: !!user },
  );
  const friendIds = new Set(user?.friends?.map((f) => f.toString()) || []);
  const friends = (allUsers.users || allUsers).filter((u) =>
    friendIds.has(u._id.toString()),
  );

  const isDesktop = () => window.innerWidth >= DESKTOP_BREAKPOINT;

  const handleOpen = (contactUser) => {
    if (isDesktop()) {
      openChat(contactUser);
    } else {
      navigate(`/mensajes/${contactUser._id}`);
    }
  };

  // Merge server-loaded conversations with ChatContext state
  const convList = Object.values(conversations)
    .filter((c) => c.user)
    .sort((a, b) => {
      const aTime = a.messages?.at(-1)?.createdAt || 0;
      const bTime = b.messages?.at(-1)?.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heroBlock}>
          <div className={styles.eyebrow}><Meeple />MENSAJES</div>
          <h1 className={styles.heroTitle}>Mensajes</h1>
          <p className={styles.heroSub}>Chateá con tus amigos.</p>
        </div>
        <button
          className={styles.newBtn}
          onClick={() => setShowNewChat((v) => !v)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo chat
        </button>
      </div>

      {showNewChat && (
        <div className={styles.newChatPanel}>
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              placeholder="Buscar amigo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <button
              className={styles.closeSearch}
              onClick={() => setShowNewChat(false)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className={styles.friendsList}>
            {filteredFriends.length === 0 && (
              <p className={styles.empty}>
                {friends.length === 0
                  ? "No tenés amigos aún"
                  : "Sin resultados"}
              </p>
            )}
            {filteredFriends.map((f) => (
              <button
                key={f._id}
                className={styles.friendItem}
                onClick={() => {
                  handleOpen(f);
                  setShowNewChat(false);
                  setSearch("");
                }}
              >
                <Avatar user={f} size="md" />
                <span className={styles.friendName}>{f.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.convList}>
        {convList.length === 0 && (
          <div className={styles.emptyState}>
            <p>No hay conversaciones todavía.</p>
            <p className={styles.emptyHint}>
              Iniciá un chat con uno de tus amigos.
            </p>
          </div>
        )}
        {convList.map((conv) => {
          const lastMsg = conv.messages?.at(-1);
          return (
            <button
              key={conv.user._id}
              className={`${styles.convItem} ${conv.unread > 0 ? styles.convUnread : ""}`}
              onClick={() => handleOpen(conv.user)}
            >
              <div className={styles.convAvatar}>
                <Avatar user={conv.user} size="md" />
                {conv.unread > 0 && (
                  <span className={styles.convBadge}>
                    {conv.unread > 9 ? "9+" : conv.unread}
                  </span>
                )}
              </div>
              <div className={styles.convInfo}>
                <div className={styles.convTop}>
                  <span className={styles.convName}>{conv.user.username}</span>
                  {lastMsg && (
                    <span className={styles.convTime}>
                      {formatRelativeTime(lastMsg.createdAt)}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <p className={styles.convPreview}>
                    {lastMsg.content.slice(0, 60)}
                    {lastMsg.content.length > 60 ? "…" : ""}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
