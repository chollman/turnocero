import Meeple from "../shared/Meeple";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import { useChat } from "../../context/ChatContext";
import { useSectionEnabled } from "../../hooks/useSectionEnabled";
import { useCommunity } from "../../context/CommunityContext";
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
  const { t } = useTranslation();
  const { unreadCount } = useNotifications();
  const { dmUnreadTotal } = useChat();
  const isSectionEnabled = useSectionEnabled();
  const { brand, isTenant } = useCommunity();
  const navigate = useNavigate();
  const dmsEnabled = isSectionEnabled("dms");

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <Link to="/" className={styles.brandMark} aria-label={brand.name}>
          <Logo
            className={styles.brandMarkImg}
            alt=""
            srcLight={brand.logoLight}
            srcDark={brand.logoDark}
          />
        </Link>
        <span className={styles.brandText}>
          <Link to="/" className={styles.brandName}>
            {brand.name}
          </Link>
          <span className={styles.brandSub}>
            <Meeple />
            {isTenant ? (
              <>
                {t("layout:attribution")}{" "}
                <Link to="/colabora" className={styles.attribution}>
                  TurnoCero
                </Link>
              </>
            ) : (
              "board game meetups"
            )}
          </span>
        </span>
      </div>

      <div className={styles.navActions}>
        {dmsEnabled && (
          <button
            className={styles.iconBtn}
            onClick={() => navigate("/mensajes")}
            aria-label={t("layout:nav.messages")}
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
          aria-label={t("layout:nav.notifications")}
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
            aria-label={menuOpen ? t("layout:menu.close") : t("layout:menu.open")}
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
