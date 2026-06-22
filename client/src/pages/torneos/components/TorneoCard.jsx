import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import UserRef from "../../../components/shared/UserRef";
import ItemCommunityTag from "../../../components/shared/ItemCommunityTag";
import { getLocale } from "../../../utils/locale";
import i18n from "../../../i18n";
import styles from "../Torneos.module.css";

const STATUS_META = {
  draft: { labelKey: "status.draft", className: "chipDraft" },
  registration: {
    labelKey: "status.registration",
    className: "chipRegistration",
  },
  in_progress: { labelKey: "status.in_progress", className: "chipInProgress" },
  finished: { labelKey: "status.finished", className: "chipFinished" },
};

const FORMAT_META = {
  league: { labelKey: "format.leagueShort", icon: "🔁" },
  single_elim: { labelKey: "format.singleElimShort", icon: "🏆" },
  groups: { labelKey: "format.groupsShort", icon: "🧩" },
};

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return i18n.t("torneos:card.timeNow");
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(date).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "long",
  });
}

export default function TorneoCard({ torneo, index = 0 }) {
  const { t } = useTranslation("torneos");
  const baseStatus = STATUS_META[torneo.status] || STATUS_META.draft;
  const status =
    torneo.status === "registration" && torneo.inscriptionMode === "admin_only"
      ? { labelKey: "status.registrationClosed", className: "chipFinished" }
      : baseStatus;
  const format = FORMAT_META[torneo.format] || FORMAT_META.league;
  const participants =
    torneo.participantCount ?? (torneo.participants?.length || 0);

  return (
    <Link
      to={`/torneos/${torneo._id}`}
      className={styles.card}
      style={{ "--i": index }}
    >
      {torneo.image?.url ? (
        <div className={styles.cardImageWrap}>
          <img
            src={torneo.image.url}
            alt=""
            className={styles.cardImageBg}
            aria-hidden="true"
          />
          <img
            src={torneo.image.url}
            alt={torneo.title}
            className={styles.cardImage}
          />
        </div>
      ) : (
        <div className={styles.cardImagePlaceholder}>
          <span>{format.icon}</span>
        </div>
      )}

      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <ItemCommunityTag communityId={torneo.community} />
          <span className={`${styles.chip} ${styles[status.className]}`}>
            {t(status.labelKey)}
          </span>
          <span className={styles.cardDate}>{timeAgo(torneo.createdAt)}</span>
        </div>

        <h3 className={styles.cardTitle}>{torneo.title}</h3>
        <p className={styles.cardGame}>{torneo.game}</p>

        {torneo.description && (
          <p className={styles.cardDesc}>{torneo.description}</p>
        )}

        <div className={styles.cardFooter}>
          <span className={styles.cardChipMuted}>
            {format.icon} {t(format.labelKey)}
          </span>
          <span className={styles.cardChipMuted}>
            👥 {participants}
            {torneo.maxParticipants ? ` / ${torneo.maxParticipants}` : ""}
          </span>
          {torneo.createdBy && (
            <span className={styles.cardAuthor}>
              {t("card.by")} <UserRef user={torneo.createdBy} noLink />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
