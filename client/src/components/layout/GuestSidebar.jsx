import { Link, useLocation } from 'react-router-dom';
import styles from './GuestSidebar.module.css';

const ICONS = {
  noticias: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="2" y1="13" x2="12" y2="13"/>
      <line x1="2" y1="17" x2="12" y2="17"/>
      <line x1="2" y1="9" x2="5" y2="9"/>
    </svg>
  ),
  compartidas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
};

const NAV = [
  { id: 'noticias',    label: 'Noticias',    to: '/noticias' },
  { id: 'compartidas', label: 'Compartidas', to: '/compartidas' },
];

function getActiveId(pathname) {
  if (pathname.startsWith('/noticias')) return 'noticias';
if (pathname === '/' || pathname.startsWith('/compartidas')) return 'compartidas';
  if (pathname.startsWith('/utilidades')) return 'utilidades';
  return null;
}

export default function GuestSidebar() {
  const { pathname } = useLocation();
  const active = getActiveId(pathname);

  return (
    <aside className={styles.sidebar}>
      <Link to="/" className={styles.logo}>
        <div className={styles.logoIcon}>T</div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>TurnoCero</span>
          <span className={styles.logoSub}>BOARD GAME MEETUPS</span>
        </div>
      </Link>

      <nav className={styles.nav}>
        {NAV.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className={`${styles.navItem} ${active === item.id ? styles.navItemActive : ''}`}
          >
            <span className={styles.navIcon}>{ICONS[item.id]}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.footer}>
        <Link to="/login" className={styles.btnLogin}>Iniciá sesión</Link>
        <Link to="/register" className={styles.btnRegister}>Registrate</Link>
      </div>
    </aside>
  );
}
