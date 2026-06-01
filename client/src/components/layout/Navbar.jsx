import Meeple from "../shared/Meeple";
import { Link, useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import { useChat } from "../../context/ChatContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import Logo from "../shared/Logo";
import styles from "./Navbar.module.css";

const ChatIcon = () => (
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
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BellIcon = () => (
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
);

export default function Navbar({ menuOpen = false, onToggleMenu }) {
  const { unreadCount } = useNotifications();
  const { dmUnreadTotal } = useChat();
  const { isSectionEnabled } = useSiteConfig();
  const navigate = useNavigate();
  const dmsEnabled = isSectionEnabled("dms");

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <Logo className={styles.brandMarkImg} alt="" />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>TurnoCero</span>
          <span className={styles.brandSub}><Meeple />board game meetups</span>
        </span>
      </Link>

      <div className={styles.navActions}>
        {dmsEnabled && (
          <button
            className={styles.iconBtn}
            onClick={() => navigate("/mensajes")}
            aria-label="Mensajes"
          >
            <ChatIcon />
            {dmUnreadTotal > 0 && (
              <span
                key={dmUnreadTotal}
                className={`${styles.iconBadge} ${styles.iconBadgeLive}`}
              >
                {dmUnreadTotal > 9 ? "9+" : dmUnreadTotal}
              </span>
            )}
          </button>
        )}

        <button
          className={styles.iconBtn}
          onClick={() => navigate("/notificaciones")}
          aria-label="Notificaciones"
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span key={unreadCount} className={styles.iconBadge}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {onToggleMenu && (
          <button
            type="button"
            className={`${styles.menuBtn} ${menuOpen ? styles.menuBtnOpen : ""}`}
            onClick={onToggleMenu}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
          >
            <span className={styles.menuLine} />
            <span className={styles.menuLine} />
            <span className={styles.menuLine} />
          </button>
        )}
      </div>
    </nav>
  );
}
