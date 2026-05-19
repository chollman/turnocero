import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { getUserDisplay } from "../../utils/userDisplay";
import { getActiveNavId } from "../../utils/routing";
import Logo from "../shared/Logo";
import styles from "./Sidebar.module.css";

const ICONS = {
  feed: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  dash: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  noticias: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="2" y1="13" x2="12" y2="13" />
      <line x1="2" y1="17" x2="12" y2="17" />
      <line x1="2" y1="9" x2="5" y2="9" />
    </svg>
  ),
  eventos: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  torneos: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M6 2v7a6 6 0 0 0 12 0V2z" />
      <line x1="6" y1="22" x2="18" y2="22" />
      <line x1="12" y1="15" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  ),
  compartidas: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  users: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  db: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  adminChat: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  bgwatch: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  bgwatchCta: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" strokeDasharray="3 2" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  panel: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
};

const SECTIONS = [
  {
    label: "Comunidad",
    items: [
      {
        id: "compartidas",
        label: "Compartite",
        to: "/compartidas",
        section: "compartidas",
      },
      {
        id: "noticias",
        label: "Noticias",
        to: "/noticias",
        section: "noticias",
      },
      {
        id: "users",
        label: "Comunidad",
        to: "/usuarios",
        section: "comunidad",
      },
    ],
  },
  {
    label: "Encuentros",
    items: [
      { id: "dash", label: "Mesas", to: "/mesas", section: "mesas" },
      { id: "eventos", label: "Eventos", to: "/eventos", section: "eventos" },
      { id: "torneos", label: "Torneos", to: "/torneos", section: "torneos" },
    ],
  },
  {
    label: "Tuyo",
    items: [
      { id: "feed", label: "Mi feed", to: "/mi", section: "miFeed" },
      // bgwatch / bgwatchCta resolved at render time depending on user.bggUsername
      { id: "bgwatchSlot", section: "bgwatch" },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { id: "panel", label: "Panel admin", to: "/panel-admin" },
      { id: "db", label: "Base de datos", to: "/base-de-datos" },
      { id: "adminChat", label: "Chat admin", to: "/mensajes-admin" },
    ],
  },
];

export default function Sidebar() {
  const { user, isActuallyAdmin, logout } = useAuth();
  const { unreadCount, adminChatUnread } = useNotifications();
  const { isSectionEnabled } = useSiteConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const active = getActiveNavId(location.pathname);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const display = getUserDisplay(user);

  const resolveItem = (item) => {
    if (item.id === "bgwatchSlot") {
      if (!isSectionEnabled("bgwatch")) return null;
      if (user?.bggUsername) {
        return {
          id: "bgwatch",
          label: "BG Watch",
          to: `/bg-watch/${user.bggUsername}`,
        };
      }
      return {
        id: "bgwatchCta",
        label: "Activá BG Watch",
        to: "/bg-watch",
        variant: "promo",
        badge: { value: "Nuevo", variant: "promo" },
      };
    }
    if (item.section && !isSectionEnabled(item.section)) return null;
    return item;
  };

  const itemBadge = (item) => {
    if (item.badge) return item.badge;
    if (item.id === "adminChat" && adminChatUnread > 0) {
      return {
        value: adminChatUnread > 9 ? "9+" : adminChatUnread,
        variant: "urgent",
      };
    }
    return null;
  };

  // Build visible sections + assign global stagger index (--i) across all items.
  const visibleSections = SECTIONS.map((sec) => {
    if (sec.adminOnly && !isActuallyAdmin) return null;
    const items = sec.items.map(resolveItem).filter(Boolean);
    if (items.length === 0) return null;
    return { ...sec, items };
  }).filter(Boolean);

  let staggerIndex = 0;

  const handleLogoutConfirm = () => {
    logout();
    navigate("/login");
  };

  const renderNavItem = (item) => {
    const isActive = item.id === active;
    const badge = itemBadge(item);
    const cls = [
      styles.navItem,
      isActive ? styles.navItemActive : "",
      item.variant === "promo" ? styles.navItemPromo : "",
    ]
      .filter(Boolean)
      .join(" ");
    const i = staggerIndex++;
    return (
      <Link
        key={item.id}
        to={item.to}
        className={cls}
        style={{ "--i": i }}
        aria-current={isActive ? "page" : undefined}
      >
        <span className={styles.navIcon}>{ICONS[item.id]}</span>
        <span className={styles.navLab}>{item.label}</span>
        {badge && (
          <span
            key={badge.value}
            className={`${styles.navBadge} ${
              badge.variant === "live"
                ? styles.navBadgeLive
                : badge.variant === "urgent"
                  ? styles.navBadgeUrgent
                  : badge.variant === "promo"
                    ? styles.navBadgePromo
                    : ""
            }`}
          >
            {badge.value}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoRow}>
        <Link to="/" className={styles.logo} aria-label="TurnoCero">
          <span className={styles.logoMark} aria-hidden="true">
            <Logo className={styles.logoMarkImg} alt="" />
          </span>
          <span className={styles.logoText}>
            <span className={styles.logoName}>TurnoCero</span>
            <span className={styles.logoSub}>◆ board game meetups</span>
          </span>
        </Link>
        <button
          className={`${styles.bellBtn} ${active === "notif" ? styles.bellBtnActive : ""}`}
          onClick={() => navigate("/notificaciones")}
          aria-label="Notificaciones"
          title="Notificaciones"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span key={unreadCount} className={styles.bellBadge}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      <nav className={styles.nav}>
        {visibleSections.map((sec) => (
          <div
            key={sec.label}
            className={`${styles.navSection} ${sec.adminOnly ? styles.navSectionAdmin : ""}`}
          >
            <span className={styles.navSectionLabel}>◆ {sec.label}</span>
            {sec.items.map(renderNavItem)}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        {confirmingLogout ? (
          <div className={styles.logoutConfirm}>
            <span className={styles.logoutConfirmLabel}>¿Cerrar sesión?</span>
            <div className={styles.logoutConfirmActions}>
              <button
                className={styles.logoutConfirmYes}
                onClick={handleLogoutConfirm}
              >
                Sí
              </button>
              <button
                className={styles.logoutConfirmNo}
                onClick={() => setConfirmingLogout(false)}
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <Link to="/perfil" className={styles.userTicket}>
            <span className={styles.userAvatar} aria-hidden="true">
              {(display.name || "?").charAt(0).toUpperCase()}
            </span>
            <span className={styles.userInfo}>
              <span className={styles.userName}>
                {display.name || user?.username}
              </span>
              <span className={styles.userMeta}>
                <span className={styles.statusDot} aria-hidden="true" />@
                {user?.username}
              </span>
            </span>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmingLogout(true);
              }}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </Link>
        )}
      </div>
    </aside>
  );
}
