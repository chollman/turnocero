import { Link } from 'react-router-dom'
import UserRef from '../../../components/shared/UserRef'
import styles from '../Torneos.module.css'

const STATUS_META = {
  draft:        { label: 'Borrador',         className: 'chipDraft' },
  registration: { label: 'Inscripción abierta', className: 'chipRegistration' },
  in_progress:  { label: 'En curso',         className: 'chipInProgress' },
  finished:     { label: 'Finalizado',       className: 'chipFinished' },
}

const FORMAT_META = {
  league:      { label: 'Liga',             icon: '🔁' },
  single_elim: { label: 'Eliminación',      icon: '🏆' },
  groups:      { label: 'Grupos',           icon: '🧩' },
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000
  if (diff < 60)     return 'ahora'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

export default function TorneoCard({ torneo }) {
  const baseStatus = STATUS_META[torneo.status] || STATUS_META.draft
  const status = (torneo.status === 'registration' && torneo.inscriptionMode === 'admin_only')
    ? { label: 'Inscripción cerrada', className: 'chipFinished' }
    : baseStatus
  const format = FORMAT_META[torneo.format] || FORMAT_META.league
  const participants = torneo.participantCount ?? (torneo.participants?.length || 0)

  return (
    <Link to={`/torneos/${torneo._id}`} className={styles.card}>
      {torneo.image?.url ? (
        <div className={styles.cardImageWrap}>
          <img src={torneo.image.url} alt="" className={styles.cardImageBg} aria-hidden="true" />
          <img src={torneo.image.url} alt={torneo.title} className={styles.cardImage} />
        </div>
      ) : (
        <div className={styles.cardImagePlaceholder}>
          <span>{format.icon}</span>
        </div>
      )}

      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span className={`${styles.chip} ${styles[status.className]}`}>{status.label}</span>
          <span className={styles.cardDate}>{timeAgo(torneo.createdAt)}</span>
        </div>

        <h3 className={styles.cardTitle}>{torneo.title}</h3>
        <p className={styles.cardGame}>{torneo.game}</p>

        {torneo.description && (
          <p className={styles.cardDesc}>{torneo.description}</p>
        )}

        <div className={styles.cardFooter}>
          <span className={styles.cardChipMuted}>
            {format.icon} {format.label}
          </span>
          <span className={styles.cardChipMuted}>
            👥 {participants}{torneo.maxParticipants ? ` / ${torneo.maxParticipants}` : ''}
          </span>
          {torneo.createdBy && (
            <span className={styles.cardAuthor}>
              por <UserRef user={torneo.createdBy} noLink />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
