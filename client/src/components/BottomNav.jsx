import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './BottomNav.module.css'

const FeedIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h18M3 6h18M3 18h12"/>
  </svg>
)

const MesasIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
)

const ComunidadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3"/>
    <circle cx="17" cy="9" r="2.5"/>
    <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/>
    <path d="M17 14c2.2.5 4 2.3 4 5"/>
  </svg>
)

const PerfilIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const JuntadasIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="14" rx="2"/>
    <circle cx="8" cy="10" r="2"/>
    <path d="M21 17 3 17M7 21h10"/>
    <path d="m14 7 3 3-3 3"/>
  </svg>
)

const DBIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v4c0 1.7 4 3 9 3s9-1.3 9-3V5"/>
    <path d="M3 9v4c0 1.7 4 3 9 3s9-1.3 9-3V9"/>
    <path d="M3 13v4c0 1.7 4 3 9 3s9-1.3 9-3v-4"/>
  </svg>
)

const NAV = [
  { id: 'feed',      label: 'Feed',      Icon: FeedIcon,      to: '/me' },
  { id: 'dash',      label: 'Mesas',     Icon: MesasIcon,     to: '/' },
  { id: 'juntadas',  label: 'Juntadas',  Icon: JuntadasIcon,  to: '/juntadas' },
  { id: 'users',     label: 'Comunidad', Icon: ComunidadIcon, to: '/users' },
  { id: 'profile',   label: 'Perfil',    Icon: PerfilIcon,    to: '/perfil' },
  { id: 'db',        label: 'DB',        Icon: DBIcon,        to: '/database', adminOnly: true },
]

function getActiveId(pathname) {
  if (pathname === '/me') return 'feed'
  if (pathname === '/' || pathname.startsWith('/tables')) return 'dash'
  if (pathname.startsWith('/juntadas')) return 'juntadas'
  if (pathname.startsWith('/users')) return 'users'
  if (pathname.startsWith('/perfil')) return 'profile'
  if (pathname.startsWith('/database')) return 'db'
  return null
}

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const active = getActiveId(location.pathname)
  const items = NAV.filter(item => !item.adminOnly || user?.isAdmin)

  return (
    <nav className={styles.nav}>
      {items.map(({ id, label, Icon, to }) => {
        const isActive = id === active
        return (
          <Link
            key={id}
            to={to}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
          >
            <span className={styles.icon}><Icon /></span>
            <span className={styles.label}>{label}</span>
            {isActive && <span className={styles.activeDot} />}
          </Link>
        )
      })}
    </nav>
  )
}
