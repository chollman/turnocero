import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import styles from './Sidebar.module.css'

const NAV = [
  { id: 'feed',      label: 'Mi feed',         icon: '◈', to: '/me' },
  { id: 'dash',      label: 'Mesas',           icon: '▦', to: '/' },
  { id: 'juntadas',  label: 'Juntadas',        icon: '◉', to: '/juntadas' },
  { id: 'create',    label: 'Crear mesa',      icon: '+', to: '/create' },
  { id: 'notif',     label: 'Notificaciones',  icon: '◆', to: '/notifications' },
  { id: 'users',     label: 'Comunidad',       icon: '◎', to: '/users' },
  { id: 'profile',   label: 'Perfil',          icon: '○', to: '/perfil' },
  { id: 'db',        label: 'Base de datos',   icon: '⊟', to: '/database', adminOnly: true },
]

function getActiveId(pathname) {
  if (pathname === '/me') return 'feed'
  if (pathname === '/' || pathname.startsWith('/tables')) return 'dash'
  if (pathname.startsWith('/juntadas')) return 'juntadas'
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
              <span className={styles.navIcon}>{item.icon}</span>
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
