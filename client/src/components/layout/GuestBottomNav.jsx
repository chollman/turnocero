import { Link, useLocation } from 'react-router-dom';
import { useSiteConfig } from '../../context/SiteConfigContext';
import styles from './BottomNav.module.css';

const NoticiasIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M2 15h8M2 19h8M2 11h4"/>
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
  { id: 'noticias',    label: 'Noticias',    Icon: NoticiasIcon,    to: '/noticias',    section: 'noticias' },
  { id: 'compartidas', label: 'Compartidas', Icon: CompartidasIcon, to: '/compartidas', section: 'compartidas' },
  { id: 'utilidades',  label: 'Utilidades',  Icon: UtilidadesIcon,  to: '/utilidades',  section: 'utilidades' },
]

function getActiveId(pathname) {
  if (pathname === '/' || pathname.startsWith('/compartidas')) return 'compartidas'
  if (pathname.startsWith('/mesas')) return 'mesas'
  if (pathname.startsWith('/noticias')) return 'noticias'
  if (pathname.startsWith('/utilidades')) return 'utilidades'
  return null
}

export default function GuestBottomNav() {
  const { pathname } = useLocation()
  const { isSectionEnabled } = useSiteConfig()
  const active = getActiveId(pathname)
  const visibleNav = NAV.filter(item => isSectionEnabled(item.section))

  return (
    <nav className={styles.nav}>
      {visibleNav.map(({ id, label, Icon, to }) => (
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
