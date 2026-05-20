import { Link } from 'react-router-dom';
import { dateParts, countdown, formatFee } from '../../utils/eventoDate';
import { PinIcon, UsersIcon, ImageIcon, ArrowIcon } from './EventoIcons';
import styles from './PosterCard.module.css';

const STATUS_BADGES = {
  open:      { label: 'Abierto',   className: 'open' },
  closed:    { label: 'Cerrado',   className: 'closed' },
  cancelled: { label: 'Cancelado', className: 'cancelled' },
};

export default function PosterCard({ evento, index = 0, isHost = false, userRegistrationStatus = null, now = Date.now() }) {
  const d = dateParts(evento.eventDate);
  const isFree = !evento.fee;
  const cd = countdown(evento.eventDate, now);
  const participants = evento.registrationCount?.confirmed ?? 0;
  const totalInscriptions = evento.registrationCount?.total ?? participants;
  const detailUrl = `/eventos/${evento._id}`;

  const statusInfo = STATUS_BADGES[evento.status];

  let ctaLabel = 'Inscribirme';
  if (isHost) ctaLabel = 'Administrar';
  else if (userRegistrationStatus === 'confirmed') ctaLabel = 'Inscripto';
  else if (userRegistrationStatus === 'pending') ctaLabel = 'Pendiente';
  else if (userRegistrationStatus === 'rejected') ctaLabel = 'Rechazada';
  else if (evento.status === 'cancelled') ctaLabel = 'Cancelado';
  else if (evento.status === 'closed') ctaLabel = 'Cerrado';
  else if (evento.status === 'draft') ctaLabel = 'Borrador';

  return (
    <Link className={styles.poster} style={{ '--i': index }} to={detailUrl}>
      {evento.image?.url ? (
        <img className={styles.image} src={evento.image.url} alt={evento.title} loading="lazy" />
      ) : (
        <div className={styles.fallback}>
          <div className={styles.fallbackInner}>
            <ImageIcon size={32} />
            <span>imagen del evento</span>
          </div>
        </div>
      )}
      <div className={styles.overlay} />

      {d && (
        <div className={styles.date}>
          <span className={styles.dateDay}>{d.day}</span>
          <span className={styles.dateMonth}>{d.month} · {d.time}</span>
        </div>
      )}

      {statusInfo && (
        <div className={styles.statusWrap}>
          <span className={`${styles.status} ${styles[`status_${statusInfo.className}`]}`}>
            {statusInfo.label}
          </span>
        </div>
      )}

      {evento.status === 'draft' && (
        <div className={styles.draftWatermark}><span>Borrador</span></div>
      )}

      <div className={styles.body}>
        <h3 className={styles.title}>{evento.title}</h3>
        <div className={styles.meta}>
          {evento.location && <span><PinIcon size={11} /> {evento.location}</span>}
          <span>
            <UsersIcon size={11} />{' '}
            {evento.maxParticipants
              ? `${participants}/${evento.maxParticipants}`
              : `${totalInscriptions}`}
          </span>
          {!isHost && cd.tone !== 'past' && evento.status === 'open' && cd.text && (
            <span className={styles.countdown}>{cd.text}</span>
          )}
        </div>
        <div className={styles.bottom}>
          <span className={`${styles.fee} ${isFree ? styles.feeFree : ''}`}>{formatFee(evento.fee)}</span>
          <span className={styles.cta}>{ctaLabel} <ArrowIcon size={11} /></span>
        </div>
      </div>
    </Link>
  );
}
