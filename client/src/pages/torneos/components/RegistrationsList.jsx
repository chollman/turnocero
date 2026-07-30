import { useState } from "react";
import { useTranslation } from "react-i18next";
import UserRef from "../../../components/shared/UserRef";
import { getUserDisplay } from "../../../utils/userDisplay";
import { getLocale } from "../../../utils/locale";
import {
  acceptRegistration,
  rejectRegistration,
} from "../../../queries/torneos";
import styles from "../TorneoDetail.module.css";

export default function RegistrationsList({ torneo, onChange }) {
  const { t } = useTranslation("torneos");
  const pending = torneo.pendingRegistrations || [];

  if (pending.length === 0) {
    return <p className={styles.emptyMsg}>{t("registrations.empty")}</p>;
  }

  return (
    <ul className={styles.regList}>
      {pending.map((reg) => (
        <RegistrationItem
          key={reg.user?._id || reg.user}
          registration={reg}
          torneoId={torneo._id}
          onChange={onChange}
        />
      ))}
    </ul>
  );
}

function RegistrationItem({ registration, torneoId, onChange }) {
  const { t } = useTranslation("torneos");
  const [busy, setBusy] = useState(false);
  const userId = registration.user?._id || registration.user;
  const info = getUserDisplay(registration.user);

  const accept = async () => {
    setBusy(true);
    try {
      const { data } = await acceptRegistration(torneoId, userId);
      onChange(data);
    } catch {
      /* user can retry */
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      const { data } = await rejectRegistration(torneoId, userId);
      onChange(data);
    } catch {
      /* user can retry */
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={styles.regItem}>
      <span className={styles.regUser}>
        {info.isDeleted ? (
          <span className={styles.deletedTxt}>
            {t("registrations.deletedUser")}
          </span>
        ) : (
          <UserRef user={registration.user} />
        )}
      </span>
      <span className={styles.regDate}>
        {new Date(registration.requestedAt).toLocaleDateString(getLocale(), {
          day: "numeric",
          month: "short",
        })}
      </span>
      <span className={styles.regActions}>
        <button className={styles.regAccept} onClick={accept} disabled={busy}>
          {t("registrations.accept")}
        </button>
        <button className={styles.regReject} onClick={reject} disabled={busy}>
          {t("registrations.reject")}
        </button>
      </span>
    </li>
  );
}
