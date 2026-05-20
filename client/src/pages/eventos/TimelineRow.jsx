import { Link } from "react-router-dom";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { dateParts, countdown, formatFee } from "../../utils/eventoDate";
import { PinIcon, UsersIcon, ArrowIcon } from "./EventoIcons";
import styles from "./TimelineRow.module.css";

const STATUS_BADGES = {
  open: { label: "Abierto", className: "open" },
  draft: { label: "Borrador", className: "draft" },
  closed: { label: "Cerrado", className: "closed" },
  cancelled: { label: "Cancelado", className: "cancelled" },
};

export default function TimelineRow({
  evento,
  index = 0,
  isHost = false,
  userRegistrationStatus = null,
  now = Date.now(),
}) {
  const d = dateParts(evento.eventDate);
  const cd = countdown(evento.eventDate, now);
  const isFree = !evento.fee;
  const hasMax = !!(evento.maxParticipants && evento.maxParticipants > 0);
  const confirmed = evento.registrationCount?.confirmed ?? 0;
  const pending = evento.registrationCount?.pending ?? 0;
  // Cuentan al cupo todas las inscripciones activas (pendientes + confirmadas),
  // porque cada inscripción ocupa un lugar tentativo hasta que el admin la confirma o rechaza.
  const participants = confirmed + pending;
  const totalInscriptions = evento.registrationCount?.total ?? participants;
  const isFull = hasMax && participants >= evento.maxParticipants;
  const fillPct = hasMax
    ? Math.min(100, (participants / evento.maxParticipants) * 100)
    : 0;
  const isPast =
    cd.tone === "past" ||
    evento.status === "cancelled" ||
    evento.status === "closed";
  const detailUrl = `/eventos/${evento._id}`;

  const dotClass =
    evento.status === "cancelled"
      ? styles.dotRed
      : userRegistrationStatus === "confirmed"
        ? styles.dotConfirmed
        : isPast
          ? styles.dotMuted
          : "";

  const statusInfo = STATUS_BADGES[evento.status];
  const author = evento.author;
  const authorDisplay = getUserDisplay(author);

  return (
    <Link
      to={detailUrl}
      className={styles.row}
      style={{ "--i": index }}
      aria-label={`Más info: ${evento.title}`}
    >
      <div className={styles.date}>
        <span className={styles.dateWeekday}>{d?.weekday || ""}</span>
        <span className={styles.dateDay}>{d?.day ?? "·"}</span>
        <span className={styles.dateTime}>{d?.time || ""}</span>
      </div>
      <div className={`${styles.dot} ${dotClass}`} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.badges}>
          {statusInfo && (
            <span
              className={`${styles.status} ${styles[`status_${statusInfo.className}`]}`}
            >
              {statusInfo.label}
            </span>
          )}
          {isHost && (
            <span className={`${styles.status} ${styles.statusHost}`}>
              Sos host
            </span>
          )}
          {userRegistrationStatus === "confirmed" && (
            <span className={`${styles.status} ${styles.statusInscripto}`}>
              Inscripto
            </span>
          )}
          {userRegistrationStatus === "pending" && (
            <span className={`${styles.status} ${styles.status_draft}`}>
              Pendiente
            </span>
          )}
          {!isPast && evento.status === "open" && isFull && (
            <span className={`${styles.status} ${styles.statusFull}`}>
              Sin cupo
            </span>
          )}
          {!isPast && evento.status === "open" && cd.text && (
            <span
              className={`${styles.countdown} ${styles[`countdown_${cd.tone}`] || ""}`}
            >
              {cd.text}
            </span>
          )}
        </div>

        <h3
          className={`${styles.title} ${evento.status === "cancelled" ? styles.titleCancelled : ""}`}
        >
          {evento.title}
        </h3>

        <div className={styles.meta}>
          {evento.location && (
            <span className={styles.metaItem}>
              <PinIcon size={12} /> {evento.location}
            </span>
          )}
          <span className={styles.metaItem}>
            <UsersIcon size={12} />
            {hasMax
              ? `${participants}/${evento.maxParticipants} inscriptos`
              : `${totalInscriptions} inscripciones`}
          </span>
        </div>

        {evento.description && (
          <p className={styles.description}>{evento.description}</p>
        )}

        {author && (
          <div className={styles.hostLine}>
            <Avatar user={author} size="xs" />
            <span>
              Organiza{" "}
              <span className={styles.hostName}>{authorDisplay.name}</span>
            </span>
          </div>
        )}
      </div>

      <div className={styles.right}>
        <div className={styles.fee}>
          <span className={styles.feeLabel}>Inscripción</span>
          <span
            className={`${styles.feeValue} ${isFree ? styles.feeValueFree : ""}`}
          >
            {formatFee(evento.fee)}
          </span>
        </div>
        {hasMax && (
          <div className={styles.cupos}>
            <div className={styles.cuposBar}>
              <div
                className={`${styles.cuposFill} ${isFull ? styles.cuposFillFull : ""}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <span className={styles.cuposText}>
              {participants}/{evento.maxParticipants} cupos
            </span>
          </div>
        )}
        <span className={styles.cta}>Más info!</span>
      </div>
    </Link>
  );
}
