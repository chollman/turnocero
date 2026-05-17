import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import styles from './BgWatchHomeWidget.module.css'

const DISMISS_KEY = 'turnocero_bgwatch_promo_dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
}

function formatPlayDate(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  const playDate = new Date(year, month - 1, day)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((today - playDate) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays > 1 && diffDays <= 7) return `Hace ${diffDays} d`
  return playDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function PlayRow({ play, bggUsername }) {
  const me = play.players?.find(
    (p) => p.username && p.username.toLowerCase() === bggUsername.toLowerCase()
  )
  const won = me?.win === true

  return (
    <Link
      to={`/bg-watch/${encodeURIComponent(bggUsername)}/juego/${play.gameId}`}
      className={styles.playRow}
      title={play.gameName}
    >
      <div className={styles.playThumbWrap}>
        {play.gameThumbnail ? (
          <img
            src={play.gameThumbnail}
            alt=""
            loading="lazy"
            className={styles.playThumb}
          />
        ) : (
          <div className={styles.playThumbPlaceholder} aria-hidden="true">🎲</div>
        )}
        {won && <span className={styles.winChip} title="Ganaste">W</span>}
      </div>
      <div className={styles.playInfo}>
        <span className={styles.playGame}>{play.gameName || 'Juego desconocido'}</span>
        <span className={styles.playDate}>{formatPlayDate(play.date)}</span>
      </div>
    </Link>
  )
}

function ConnectedView({ bggUsername }) {
  const [plays, setPlays] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    axios
      .get(`/api/bgg/partidas/${encodeURIComponent(bggUsername)}`, { params: { page: 1 } })
      .then((r) => {
        if (cancelled) return
        setPlays((r.data?.plays || []).slice(0, 3))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [bggUsername])

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>◆ TU BG WATCH</span>
        <Link to={`/bg-watch/${encodeURIComponent(bggUsername)}`} className={styles.link}>
          Ver todo →
        </Link>
      </div>
      <h3 className={styles.title}>Últimas partidas</h3>

      <div className={styles.playList}>
        {loading && [0, 1, 2].map((i) => (
          <div key={i} className={`${styles.playRow} ${styles.playRowSkeleton}`}>
            <div className={styles.playThumbWrap}>
              <div className={styles.playThumbSkeleton} />
            </div>
            <div className={styles.playInfo}>
              <span className={styles.skeletonLine} />
              <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
            </div>
          </div>
        ))}

        {!loading && plays && plays.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>Sin partidas registradas todavía.</p>
            <Link to={`/bg-watch/${encodeURIComponent(bggUsername)}`} className={styles.emptyAction}>
              Ir a mi BG Watch
            </Link>
          </div>
        )}

        {!loading && plays && plays.length > 0 && plays.map((play) => (
          <PlayRow key={play.id} play={play} bggUsername={bggUsername} />
        ))}

        {!loading && error && (
          <p className={styles.emptyText}>No se pudieron cargar tus partidas.</p>
        )}
      </div>
    </div>
  )
}

function PromoView({ onDismiss }) {
  return (
    <div className={`${styles.widget} ${styles.widgetPromo}`}>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDismiss()
          }}
          aria-label="No volver a mostrar"
          title="No volver a mostrar"
        >
          ✕
        </button>
      )}
      <Link to="/bg-watch" className={styles.promoLink}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>◆ BG WATCH</span>
        </div>
        <h3 className={styles.title}>¿Llevás tus partidas en BGG?</h3>
        <p className={styles.promoSub}>
          Conectá tu cuenta y registrá todo desde Turnocero.
        </p>
        <span className={styles.promoCta}>Activá BG Watch →</span>
      </Link>
    </div>
  )
}

/**
 * BG Watch activity widget. Two variants:
 * - Connected (user has an active BG Watch connection): shows last 3 plays + link.
 * - Not connected: shows a promo card linking to /bg-watch.
 *
 * When `dismissible` is true, the promo variant gets a "✕" button that persists
 * the dismissal in localStorage. Subsequent renders skip the widget entirely
 * (until the user reconnects or clears storage). The connected variant is never
 * dismissible — once you have BG Watch, the activity feed is the point.
 */
export default function BgWatchHomeWidget({ user, dismissible = false }) {
  const [dismissed, setDismissed] = useState(() => dismissible && readDismissed())

  if (!user) return null
  const hasBgWatch = user.bggUsername && user.bggConnected && !user.bggInvalid
  if (hasBgWatch) {
    return <ConnectedView bggUsername={user.bggUsername} />
  }
  if (dismissible && dismissed) return null

  const onDismiss = dismissible
    ? () => {
        writeDismissed()
        setDismissed(true)
      }
    : undefined

  return <PromoView onDismiss={onDismiss} />
}
