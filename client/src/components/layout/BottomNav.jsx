import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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

const CompartidasIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="14" rx="2"/>
    <circle cx="8" cy="10" r="2"/>
    <path d="M21 17 3 17M7 21h10"/>
    <path d="m14 7 3 3-3 3"/>
  </svg>
)

const NoticiasIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M2 15h8M2 19h8M2 11h4"/>
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

const MensajesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
)

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
)

const NAV = [
  { id: 'feed',        label: 'Feed',       Icon: FeedIcon,        to: '/mi' },
  { id: 'dash',        label: 'Mesas',      Icon: MesasIcon,       to: '/mesas' },
  { id: 'mensajes',    label: 'Mensajes',   Icon: MensajesIcon,    to: '/mensajes' },
  { id: 'noticias',    label: 'Noticias',   Icon: NoticiasIcon,    to: '/noticias' },
  { id: 'compartidas', label: 'Compartite', Icon: CompartidasIcon, to: '/compartidas' },
  { id: 'users',       label: 'Comunidad',  Icon: ComunidadIcon,   to: '/usuarios' },
  { id: 'profile',     label: 'Perfil',     Icon: PerfilIcon,      to: '/perfil' },
  { id: 'db',          label: 'DB',         Icon: DBIcon,          to: '/base-de-datos', adminOnly: true },
]

const VISIBLE = 3

function getActiveId(pathname) {
  if (pathname === '/mi') return 'feed'
  if (pathname.startsWith('/mesas')) return 'dash'
  if (pathname.startsWith('/mensajes')) return 'mensajes'
  if (pathname.startsWith('/noticias')) return 'noticias'
  if (pathname === '/' || pathname.startsWith('/compartidas')) return 'compartidas'
  if (pathname.startsWith('/usuarios')) return 'users'
  if (pathname.startsWith('/perfil')) return 'profile'
  if (pathname.startsWith('/base-de-datos')) return 'db'
  return null
}

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const active = getActiveId(location.pathname)
  const items = NAV.filter(item => !item.adminOnly || user?.isAdmin)
  const scrollable = items.length > VISIBLE

  const [startIndex, setStartIndex] = useState(0)
  const touchStartX = useRef(null)
  const slideDir = useRef(null)

  const visibleItems = scrollable ? items.slice(startIndex, startIndex + VISIBLE) : items
  const canGoLeft = scrollable && startIndex > 0
  const canGoRight = scrollable && startIndex + VISIBLE < items.length

  function goLeft() {
    if (!canGoLeft) return
    slideDir.current = 'right'
    setStartIndex(i => i - 1)
  }

  function goRight() {
    if (!canGoRight) return
    slideDir.current = 'left'
    setStartIndex(i => i + 1)
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    touchStartX.current = null
    if (delta > 50) goRight()
    else if (delta < -50) goLeft()
  }

  // Keep the active item visible when navigating via router
  useEffect(() => {
    if (!scrollable) return
    const activeIdx = items.findIndex(item => item.id === active)
    if (activeIdx < 0) return
    setStartIndex(prev => {
      if (activeIdx < prev) {
        slideDir.current = 'right'
        return activeIdx
      }
      if (activeIdx >= prev + VISIBLE) {
        slideDir.current = 'left'
        return activeIdx - VISIBLE + 1
      }
      return prev
    })
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const animClass = slideDir.current === 'left' ? styles.slideLeft
                  : slideDir.current === 'right' ? styles.slideRight
                  : ''

  const renderItem = ({ id, label, Icon, to }) => {
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
  }

  return (
    <nav
      className={`${styles.nav} ${scrollable ? styles.navScrollable : ''}`}
      onTouchStart={scrollable ? handleTouchStart : undefined}
      onTouchEnd={scrollable ? handleTouchEnd : undefined}
    >
      {scrollable ? (
        <>
          <button
            className={styles.arrow}
            onClick={goLeft}
            style={{ visibility: canGoLeft ? 'visible' : 'hidden' }}
            aria-label="Anterior"
          >
            <ChevronLeft />
          </button>
          <div key={startIndex} className={`${styles.itemsContainer} ${animClass}`}>
            {visibleItems.map(renderItem)}
          </div>
          <button
            className={styles.arrow}
            onClick={goRight}
            style={{ visibility: canGoRight ? 'visible' : 'hidden' }}
            aria-label="Siguiente"
          >
            <ChevronRight />
          </button>
        </>
      ) : (
        items.map(renderItem)
      )}
    </nav>
  )
}
