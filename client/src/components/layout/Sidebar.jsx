import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
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
  create: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  notif: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
  profile: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
  mensajes: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
};

const NAV = [
  { id: "compartidas", label: "Compartite", to: "/compartidas" },
  { id: "noticias", label: "Noticias", to: "/noticias" },
  { id: "eventos", label: "Eventos", to: "/eventos" },
  { id: "dash", label: "Mesas", to: "/mesas", adminOnly: true },
  { id: "feed", label: "Mi feed", to: "/mi", adminOnly: true },
  { id: "users", label: "Comunidad", to: "/usuarios", adminOnly: true },
  { id: "db", label: "Base de datos", to: "/base-de-datos", adminOnly: true },
  {
    id: "adminChat",
    label: "Chat Admin",
    to: "/mensajes-admin",
    adminOnly: true,
  },
];

function getActiveId(pathname) {
  if (pathname === "/mi") return "feed";
  if (pathname.startsWith("/mesas")) return "dash";
  if (pathname.startsWith("/noticias")) return "noticias";
  if (pathname.startsWith("/eventos")) return "eventos";
  if (pathname === "/" || pathname.startsWith("/compartidas"))
    return "compartidas";
  if (pathname === "/mesas/crear") return "create";
  if (pathname === "/notificaciones") return "notif";
  if (pathname.startsWith("/mensajes-admin")) return "adminChat";
  if (pathname.startsWith("/mensajes")) return "mensajes";
  if (pathname.startsWith("/usuarios")) return "users";
  if (pathname.startsWith("/perfil")) return "profile";
  if (pathname.startsWith("/base-de-datos")) return "db";
  if (pathname.startsWith("/utilidades")) return "utilidades";
  return null;
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { unreadCount, adminChatUnread } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const active = getActiveId(location.pathname);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const handleLogoutConfirm = () => {
    logout();
    navigate("/login");
  };

  const renderNavItem = (item) => {
    const isActive = item.id === active;
    let badge = null;
    if (item.id === "adminChat" && adminChatUnread > 0) {
      badge = adminChatUnread > 9 ? "9+" : adminChatUnread;
    }
    return (
      <Link
        key={item.id}
        to={item.to}
        className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
      >
        <span className={styles.navIcon}>{ICONS[item.id]}</span>
        <span className={styles.navLabel}>{item.label}</span>
        {badge && (
          <span key={badge} className={styles.navBadge}>
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoRow}>
        <Link to="/" className={styles.logo}>
          <div className={styles.logoIcon}>T</div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>TurnoCero</span>
            <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
          </div>
        </Link>
        <button
          className={`${styles.bellBtn} ${active === "notif" ? styles.bellBtnActive : ""}`}
          onClick={() => navigate("/notificaciones")}
          aria-label="Notificaciones"
          title="Notificaciones"
        >
          <svg
            width="18"
            height="18"
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
        {NAV.filter((item) => !item.adminOnly).map(renderNavItem)}

        {user?.isAdmin && (
          <>
            <div className={styles.navDivider} />
            {NAV.filter((item) => item.adminOnly).map(renderNavItem)}
          </>
        )}
      </nav>

      <div className={styles.footer}>
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
          <>
            <Link to="/perfil" className={styles.userChip}>
              <span className={styles.userAvatar}>
                {user?.username?.[0]?.toUpperCase()}
              </span>
              <span className={styles.userName}>{user?.username}</span>
            </Link>
            <button
              className={styles.logoutBtn}
              onClick={() => setConfirmingLogout(true)}
              title="Cerrar sesión"
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
          </>
        )}
      </div>
    </aside>
  );
}
