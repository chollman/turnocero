import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { dateParts, countdown, formatFee } from "../../utils/eventoDate";
import { formatDistanceKm } from "../../utils/distance";
import { getLocationDisplay } from "../../utils/location";
import { PinIcon, UsersIcon } from "./EventoIcons";
import { getEventoStatusBadge } from "../../utils/eventoStatus";
import ItemCommunityTag from "../../components/shared/ItemCommunityTag";
import styles from "./TimelineRow.module.css";

// `now` lo provee siempre el caller (Eventos.jsx) para no romper la regla
// react-hooks/purity con un default impuro (`Date.now()`). Si no se pasa,
// countdown() aplica su propio fallback al evaluar la diff temporal.
export default function TimelineRow({
  evento,
  index = 0,
  isHost = false,
  userRegistrationStatus = null,
  now,
}) {
  const { t } = useTranslation("eventos");
  const d = dateParts(evento.eventDate);
  const cd = countdown(evento.eventDate, now);
  const isFree = !evento.fee;
  const hasMax = !!(evento.maxParticipants && evento.maxParticipants > 0);
  const confirmed = evento.registrationCount?.confirmed ?? 0;
  const pending = evento.registrationCount?.pending ?? 0;
  const locationTexto =
    typeof evento.location === "string"
      ? evento.location
      : evento.location?.texto || "";
  // En la lista mostramos solo la localidad — el texto completo se ve en el
  // detalle. getLocationDisplay respeta displayName si está seteado.
  const locationDisplay = getLocationDisplay(evento.location, "city");
  // formatDistanceKm devuelve null para distancias que redondean a 0m (incluye
  // 0 exacto), evitando "0 m" / "Aquí mismo" redundantes.
  const distanceLabel = formatDistanceKm(evento.distanceKm);
  // Sólo cuentan inscripciones activas (pendientes + confirmadas).
  // Los rechazados — mas que nada los rechazados permanentemente — NO reservan
  // slot ni se muestran como inscriptos en ninguna superficie pública.
  const participants = confirmed + pending;
  const totalInscriptions = participants;
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

  const statusInfo = getEventoStatusBadge(evento.status);
  const author = evento.author;
  const authorDisplay = getUserDisplay(author);

  return (
    <Link
      to={detailUrl}
      className={styles.row}
      style={{ "--i": index }}
      aria-label={t("timeline.rowAria", { title: evento.title })}
    >
      <div className={styles.date}>
        <span className={styles.dateWeekday}>{d?.weekday || ""}</span>
        <span className={styles.dateDay}>{d?.day ?? "·"}</span>
        <span className={styles.dateTime}>{d?.time || ""}</span>
      </div>
      <div className={`${styles.dot} ${dotClass}`} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.badges}>
          <ItemCommunityTag communityId={evento.community} />
          {statusInfo && (
            <span
              className={`${styles.status} ${styles[`status_${statusInfo.className}`]}`}
            >
              {statusInfo.label}
            </span>
          )}
          {isHost && (
            <span className={`${styles.status} ${styles.statusHost}`}>
              {t("timeline.host")}
            </span>
          )}
          {userRegistrationStatus === "confirmed" && (
            <span className={`${styles.status} ${styles.statusInscripto}`}>
              {t("timeline.inscripto")}
            </span>
          )}
          {userRegistrationStatus === "pending" && (
            <span className={`${styles.status} ${styles.status_draft}`}>
              {t("timeline.pendiente")}
            </span>
          )}
          {!isPast && evento.status === "open" && isFull && (
            <span className={`${styles.status} ${styles.statusFull}`}>
              {t("timeline.sinCupo")}
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
          {locationDisplay && (
            <span className={styles.metaItem} title={locationTexto}>
              <PinIcon size={12} /> {locationDisplay}
              {distanceLabel && (
                <span
                  style={{
                    marginLeft: 4,
                    color: "var(--green)",
                    fontWeight: 600,
                  }}
                >
                  · {distanceLabel}
                </span>
              )}
            </span>
          )}
          <span className={styles.metaItem}>
            <UsersIcon size={12} />
            {hasMax
              ? t("timeline.inscriptos", {
                  participants,
                  max: evento.maxParticipants,
                })
              : t("timeline.inscripciones", { count: totalInscriptions })}
          </span>
        </div>

        {evento.description && (
          <p className={styles.description}>{evento.description}</p>
        )}

        {author && (
          <div className={styles.hostLine}>
            <Avatar user={author} size="xs" />
            <span>
              <Trans
                t={t}
                i18nKey="timeline.organiza"
                values={{ name: authorDisplay.name }}
                components={{ name: <span className={styles.hostName} /> }}
              />
            </span>
          </div>
        )}
      </div>

      <div className={styles.right}>
        <div className={styles.fee}>
          <span className={styles.feeLabel}>{t("timeline.fee")}</span>
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
              {t("timeline.cupos", {
                participants,
                max: evento.maxParticipants,
              })}
            </span>
          </div>
        )}
        <span className={styles.cta}>{t("timeline.cta")}</span>
      </div>
    </Link>
  );
}
