import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import styles from './Sidebar.module.css'

const ICONS = {
  feed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  dash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
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
  create: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  notif: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  db: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
}

const NAV = [
  { id: 'feed',        label: 'Mi feed',        to: '/me' },
  { id: 'dash',        label: 'Mesas',          to: '/' },
  { id: 'noticias',    label: 'Noticias',        to: '/noticias' },
  { id: 'compartidas', label: 'Compartite',      to: '/compartidas' },
  { id: 'create',      label: 'Crear mesa',      to: '/create' },
  { id: 'notif',       label: 'Notificaciones',  to: '/notifications' },
  { id: 'users',       label: 'Comunidad',       to: '/users' },
  { id: 'profile',     label: 'Perfil',          to: '/perfil' },
  { id: 'db',          label: 'Base de datos',   to: '/database', adminOnly: true },
]

function getActiveId(pathname) {
  if (pathname === '/me') return 'feed'
  if (pathname === '/' || pathname.startsWith('/tables')) return 'dash'
  if (pathname.startsWith('/noticias')) return 'noticias'
  if (pathname.startsWith('/compartidas')) return 'compartidas'
  if (pathname === '/create') return 'create'
  if (pathname === '/notifications') return 'notif'
  if (pathname.startsWith('/users')) return 'users'
  if (pathname.startsWith('/perfil')) return 'profile'
  if (pathname.startsWith('/database')) return 'db'
  return null
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const active = getActiveId(location.pathname)
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  const handleLogoutConfirm = () => {
    logout()
    navigate('/login')
  }

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
        {NAV.filter(item => !item.adminOnly || user?.isAdmin).map((item) => {
          const isActive = item.id === active
          const badge = item.id === 'notif' && unreadCount > 0
            ? (unreadCount > 9 ? '9+' : unreadCount)
            : null
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}>{ICONS[item.id]}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {badge && <span className={styles.navBadge}>{badge}</span>}
            </Link>
          )
        })}
      </nav>

      <div className={styles.footer}>
        {confirmingLogout ? (
          <div className={styles.logoutConfirm}>
            <span className={styles.logoutConfirmLabel}>¿Cerrar sesión?</span>
            <div className={styles.logoutConfirmActions}>
              <button className={styles.logoutConfirmYes} onClick={handleLogoutConfirm}>Sí</button>
              <button className={styles.logoutConfirmNo} onClick={() => setConfirmingLogout(false)}>No</button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.userChip}>
              <span className={styles.userAvatar}>{user?.username?.[0]?.toUpperCase()}</span>
              <span className={styles.userName}>{user?.username}</span>
            </div>
            <button className={styles.logoutBtn} onClick={() => setConfirmingLogout(true)} title="Cerrar sesión">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
