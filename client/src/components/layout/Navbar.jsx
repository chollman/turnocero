import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useChat } from '../../context/ChatContext';
import { useSiteConfig } from '../../context/SiteConfigContext';
import Logo from '../shared/Logo';
import styles from './Navbar.module.css';

const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export default function Navbar() {
  const { logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { dmUnreadTotal } = useChat();
  const { isSectionEnabled } = useSiteConfig();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const dmsEnabled = isSectionEnabled('dms');

  const handleLogoutConfirm = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <Logo className={styles.brandMarkImg} alt="" />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>TurnoCero</span>
          <span className={styles.brandSub}>◆ board game meetups</span>
        </span>
      </Link>

      <div className={styles.navActions}>
        {dmsEnabled && (
          <button
            className={styles.iconBtn}
            onClick={() => navigate('/mensajes')}
            aria-label="Mensajes"
          >
            <ChatIcon />
            {dmUnreadTotal > 0 && (
              <span key={dmUnreadTotal} className={`${styles.iconBadge} ${styles.iconBadgeLive}`}>
                {dmUnreadTotal > 9 ? '9+' : dmUnreadTotal}
              </span>
            )}
          </button>
        )}

        <button
          className={styles.iconBtn}
          onClick={() => navigate('/notificaciones')}
          aria-label="Notificaciones"
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span key={unreadCount} className={styles.iconBadge}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {confirming ? (
          <div className={styles.logoutConfirm}>
            <span className={styles.logoutConfirmLabel}>¿Salir?</span>
            <button className={styles.logoutConfirmYes} onClick={handleLogoutConfirm}>Sí</button>
            <button className={styles.logoutConfirmNo} onClick={() => setConfirming(false)}>No</button>
          </div>
        ) : (
          <button
            className={styles.iconBtn}
            onClick={() => setConfirming(true)}
            aria-label="Cerrar sesión"
          >
            <LogoutIcon />
          </button>
        )}
      </div>
    </nav>
  );
}
