import { Link } from 'react-router-dom'
import styles from './EventoCard.module.css'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatFee(fee) {
  if (!fee || fee === 0) return 'Gratis'
  return `$${fee.toLocaleString('es-AR')}`
}

const STATUS_LABEL = {
  open:      'Abierto',
  closed:    'Cerrado',
  cancelled: 'Cancelado',
  draft:     'Borrador',
}

const REG_LABEL = {
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  rejected:  'Rechazado',
}

export default function EventoCard({ evento, userRegistration }) {
  const isFree = !evento.fee || evento.fee === 0

  return (
    <Link to={`/eventos/${evento._id}`} className={styles.card}>
      {evento.image?.url && (
        <div className={styles.imageWrap}>
          <img src={evento.image.url} alt={evento.title} className={styles.image} />
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.badges}>
          <span className={`${styles.statusBadge} ${styles[`status_${evento.status}`]}`}>
            {STATUS_LABEL[evento.status] || evento.status}
          </span>
          <span className={`${styles.feeBadge} ${isFree ? styles.feeFree : ''}`}>
            {formatFee(evento.fee)}
          </span>
          {userRegistration && (
            <span className={`${styles.regBadge} ${styles[`reg_${userRegistration.status}`]}`}>
              {REG_LABEL[userRegistration.status]}
            </span>
          )}
        </div>

        <h3 className={styles.title}>{evento.title}</h3>

        {evento.eventDate && (
          <p className={styles.meta}>
            <span className={styles.metaIcon}>📅</span>
            {formatDate(evento.eventDate)}
          </p>
        )}
        {evento.location && (
          <p className={styles.meta}>
            <span className={styles.metaIcon}>📍</span>
            {evento.location}
          </p>
        )}

        {evento.description && (
          <p className={styles.description}>{evento.description}</p>
        )}
      </div>
    </Link>
  )
}
