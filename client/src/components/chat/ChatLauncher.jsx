import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSectionEnabled } from "../../hooks/useSectionEnabled";
import { userKeys, useUsersListQuery } from "../../queries/users";
import Avatar from "../shared/Avatar";
import styles from "./ChatLauncher.module.css";

const DESKTOP = 960;

export default function ChatLauncher() {
  const { t } = useTranslation("chat");
  const { user } = useAuth();
  const { conversations, openChat, dmUnreadTotal } = useChat();
  const { addFriendListener } = useNotifications();
  const isSectionEnabled = useSectionEnabled();
  const dmsEnabled = isSectionEnabled("dms");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  const friendsParams = { friendsOnly: "true" };
  const { data: friends = [] } = useUsersListQuery(friendsParams, {
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    return addFriendListener(() => {
      queryClient.invalidateQueries({
        queryKey: userKeys.list(friendsParams),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, addFriendListener, queryClient]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (!user) return null;
  if (!dmsEnabled) return null;

  const handleSelect = (friend) => {
    setOpen(false);
    setSearch("");
    if (window.innerWidth >= DESKTOP) {
      openChat(friend);
    } else {
      navigate(`/mensajes/${friend._id}`);
    }
  };

  // Sort: unread first, then alphabetical
  const filtered = friends
    .filter((f) => f.username.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aUnread = conversations[a._id]?.unread || 0;
      const bUnread = conversations[b._id]?.unread || 0;
      if (bUnread !== aUnread) return bUnread - aUnread;
      return a.username.localeCompare(b.username, "es", {
        sensitivity: "base",
      });
    });

  return (
    <>
      {open && (
        <div className={styles.panel} ref={panelRef}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{t("launcher.title")}</span>
            <button
              className={styles.panelAllLink}
              onClick={() => {
                setOpen(false);
                navigate("/mensajes");
              }}
            >
              {t("launcher.seeAll")}
            </button>
          </div>
          <div className={styles.searchRow}>
            <svg
              className={styles.searchIcon}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className={styles.searchInput}
              placeholder={t("launcher.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.list}>
            {filtered.length === 0 && (
              <p className={styles.empty}>
                {friends.length === 0
                  ? t("launcher.noFriends")
                  : t("launcher.noResults")}
              </p>
            )}
            {filtered.map((f) => {
              const conv = conversations[f._id];
              const unread = conv?.unread || 0;
              const lastMsg = conv?.messages?.at(-1) || conv?.lastMessage;
              return (
                <button
                  key={f._id}
                  className={styles.friendRow}
                  onClick={() => handleSelect(f)}
                >
                  <div className={styles.avatarWrap}>
                    <Avatar user={f} size="md" />
                    {unread > 0 && (
                      <span className={styles.unreadDot}>
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  <div className={styles.info}>
                    <span
                      className={`${styles.name} ${unread > 0 ? styles.nameBold : ""}`}
                    >
                      {f.username}
                    </span>
                    {lastMsg && (
                      <span className={styles.preview}>
                        {lastMsg.content.slice(0, 32)}
                        {lastMsg.content.length > 32 ? "…" : ""}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        ref={btnRef}
        className={`${styles.fab} ${open ? styles.fabOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("launcher.openChat")}
        title={t("launcher.title")}
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!open && dmUnreadTotal > 0 && (
          <span className={styles.badge}>
            {dmUnreadTotal > 9 ? "9+" : dmUnreadTotal}
          </span>
        )}
      </button>
    </>
  );
}
