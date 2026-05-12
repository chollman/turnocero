import { Link, useLocation } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import styles from './BottomNav.module.css'

const NAV = [
  { id: 'feed',    label: 'Feed',    icon: '◈', to: '/me' },
  { id: 'dash',    label: 'Mesas',   icon: '▦', to: '/' },
  { id: 'create',  label: 'Crear',   icon: '+', to: '/create' },
  { id: 'notif',   label: 'Avisos',  icon: '◆', to: '/notifications' },
  { id: 'profile', label: 'Perfil',  icon: '○', to: '/perfil' },
]

function getActiveId(pathname) {
  if (pathname === '/me') return 'feed'
  if (pathname === '/' || pathname.startsWith('/tables')) return 'dash'
  if (pathname === '/create') return 'create'
  if (pathname === '/notifications') return 'notif'
  if (pathname.startsWith('/perfil') || pathname.startsWith('/users')) return 'profile'
  return null
}

export default function BottomNav() {
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const active = getActiveId(location.pathname)

  return (
    <nav className={styles.nav}>
      {NAV.map((item) => {
        const isActive = item.id === active
        const badge = item.id === 'notif' && unreadCount > 0
          ? (unreadCount > 9 ? '9+' : unreadCount)
          : null
        return (
          <Link
            key={item.id}
            to={item.to}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label.toUpperCase()}</span>
            {badge && <span className={styles.badge}>{badge}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
