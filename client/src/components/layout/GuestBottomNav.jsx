import { Link, useLocation } from 'react-router-dom';
import styles from './BottomNav.module.css';

const MesasIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
)

const NoticiasIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M2 15h8M2 19h8M2 11h4"/>
  </svg>
)

const EventosIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const CompartidasIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="14" rx="2"/>
    <circle cx="8" cy="10" r="2"/>
    <path d="M21 17 3 17M7 21h10"/>
    <path d="m14 7 3 3-3 3"/>
  </svg>
)

const UtilidadesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
)

const NAV = [
  { id: 'compartidas', label: 'Compartidas', Icon: CompartidasIcon, to: '/compartidas' },
  { id: 'mesas',       label: 'Mesas',       Icon: MesasIcon,       to: '/mesas' },
  { id: 'noticias',    label: 'Noticias',    Icon: NoticiasIcon,    to: '/noticias' },
  { id: 'eventos',     label: 'Eventos',     Icon: EventosIcon,     to: '/eventos' },
  { id: 'utilidades',  label: 'Utilidades',  Icon: UtilidadesIcon,  to: '/utilidades' },
]

function getActiveId(pathname) {
  if (pathname === '/' || pathname.startsWith('/compartidas')) return 'compartidas'
  if (pathname.startsWith('/mesas')) return 'mesas'
  if (pathname.startsWith('/noticias')) return 'noticias'
  if (pathname.startsWith('/eventos')) return 'eventos'
  if (pathname.startsWith('/utilidades')) return 'utilidades'
  return null
}

export default function GuestBottomNav() {
  const { pathname } = useLocation()
  const active = getActiveId(pathname)

  return (
    <nav className={styles.nav}>
      {NAV.map(({ id, label, Icon, to }) => (
        <Link
          key={id}
          to={to}
          className={`${styles.item} ${active === id ? styles.itemActive : ''}`}
        >
          <span className={styles.icon}><Icon /></span>
          <span className={styles.label}>{label}</span>
          {active === id && <span className={styles.activeDot} />}
        </Link>
      ))}
    </nav>
  )
}
