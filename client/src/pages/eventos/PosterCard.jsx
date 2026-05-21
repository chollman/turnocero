import { Link } from "react-router-dom";
import { dateParts, countdown, formatFee } from "../../utils/eventoDate";
import { formatDistanceKm } from "../../utils/distance";
import { getLocationDisplay } from "../../utils/location";
import { PinIcon, UsersIcon, ImageIcon, ArrowIcon } from "./EventoIcons";
import styles from "./PosterCard.module.css";

const STATUS_BADGES = {
  open: { label: "Abierto", className: "open" },
  closed: { label: "Cerrado", className: "closed" },
  cancelled: { label: "Cancelado", className: "cancelled" },
};

// `now` viene del caller (Eventos.jsx) para mantener la pureza del render —
// si no se pasa, countdown() aplica su propio fallback.
export default function PosterCard({
  evento,
  index = 0,
  isHost = false,
  userRegistrationStatus = null,
  now,
}) {
  const d = dateParts(evento.eventDate);
  const isFree = !evento.fee;
  const cd = countdown(evento.eventDate, now);
  // Sólo cuentan inscripciones activas (pending + confirmed). Rechazados no
  // ocupan slot — especialmente los permanentemente rechazados.
  const confirmed = evento.registrationCount?.confirmed ?? 0;
  const pending = evento.registrationCount?.pending ?? 0;
  const participants = confirmed + pending;
  const totalInscriptions = participants;
  const detailUrl = `/eventos/${evento._id}`;

  const statusInfo = STATUS_BADGES[evento.status];
  // location puede llegar como string legacy o subdoc { texto, lat, lng, displayName }.
  const locationTexto = typeof evento.location === "string"
    ? evento.location
    : evento.location?.texto || "";
  // En la card compacta mostramos solo la localidad — o el displayName si está seteado.
  const locationDisplay = getLocationDisplay(evento.location, "city");
  // formatDistanceKm devuelve null para distancias que redondean a 0m (incluye
  // 0 exacto), evitando "0 m" / "Aquí mismo" redundantes.
  const distanceLabel = formatDistanceKm(evento.distanceKm);

  let ctaLabel = "Inscribirme";
  if (isHost) ctaLabel = "Administrar";
  else if (userRegistrationStatus === "confirmed") ctaLabel = "Inscripto";
  else if (userRegistrationStatus === "pending") ctaLabel = "Pendiente";
  else if (userRegistrationStatus === "rejected") ctaLabel = "Rechazada";
  else if (evento.status === "cancelled") ctaLabel = "Cancelado";
  else if (evento.status === "closed") ctaLabel = "Cerrado";
  else if (evento.status === "draft") ctaLabel = "Borrador";

  return (
    <Link className={styles.poster} style={{ "--i": index }} to={detailUrl}>
      {evento.image?.url ? (
        <img
          className={styles.image}
          src={evento.image.url}
          alt={evento.title}
          loading="lazy"
        />
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
          <span className={styles.dateMonth}>
            {d.month} · {d.time}
          </span>
        </div>
      )}

      {statusInfo && (
        <div className={styles.statusWrap}>
          <span
            className={`${styles.status} ${styles[`status_${statusInfo.className}`]}`}
          >
            {statusInfo.label}
          </span>
        </div>
      )}

      {evento.status === "draft" && (
        <div className={styles.draftWatermark}>
          <span>Borrador</span>
        </div>
      )}

      <div className={styles.body}>
        <h3 className={styles.title}>{evento.title}</h3>
        <div className={styles.meta}>
          {locationDisplay && (
            <span title={locationTexto}>
              <PinIcon size={11} /> {locationDisplay}
              {distanceLabel && (
                <span style={{ marginLeft: 4, color: "var(--green)", fontWeight: 600 }}>
                  · {distanceLabel}
                </span>
              )}
            </span>
          )}
          <span>
            <UsersIcon size={11} />{" "}
            {evento.maxParticipants
              ? `${participants}/${evento.maxParticipants}`
              : `${totalInscriptions}`}
          </span>
          {!isHost &&
            cd.tone !== "past" &&
            evento.status === "open" &&
            cd.text && <span className={styles.countdown}>{cd.text}</span>}
        </div>
        <div className={styles.bottom}>
          <span className={`${styles.fee} ${isFree ? styles.feeFree : ""}`}>
            {formatFee(evento.fee)}
          </span>
          <span className={styles.cta}>
            {ctaLabel} <ArrowIcon size={11} />
          </span>
        </div>
      </div>
    </Link>
  );
}
