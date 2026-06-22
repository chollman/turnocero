import { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import UserRef from "../../../components/shared/UserRef";
import { getUserDisplay } from "../../../utils/userDisplay";
import { API } from "../../../api/endpoints";
import styles from "../TorneoDetail.module.css";

export default function ParticipantsList({ torneo, isAdmin, onChange }) {
  const { t } = useTranslation("torneos");
  const participants = torneo.participants || [];
  const canRemove =
    isAdmin && (torneo.status === "draft" || torneo.status === "registration");

  if (participants.length === 0) {
    return <p className={styles.emptyMsg}>{t("participants.empty")}</p>;
  }

  return (
    <ul className={styles.partList}>
      {participants.map((u, idx) => (
        <ParticipantItem
          key={u._id || u}
          user={u}
          seed={idx + 1}
          torneoId={torneo._id}
          canRemove={canRemove}
          onChange={onChange}
        />
      ))}
    </ul>
  );
}

function ParticipantItem({ user, seed, torneoId, canRemove, onChange }) {
  const { t } = useTranslation("torneos");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirm] = useState(false);
  const info = getUserDisplay(user);

  const remove = async () => {
    setBusy(true);
    try {
      const { data } = await axios.delete(
        API.torneos.PARTICIPANT(torneoId, user._id),
      );
      onChange(data);
    } catch {
      /* silently keep the row; user can retry */
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <li className={styles.partItem}>
      <span className={styles.partSeed}>#{seed}</span>
      <span className={styles.partUser}>
        {info.isDeleted ? (
          <span className={styles.deletedTxt}>
            {t("participants.deletedUser")}
          </span>
        ) : (
          <UserRef user={user} />
        )}
      </span>
      {canRemove && !info.isDeleted && (
        <span className={styles.partActions}>
          {confirming ? (
            <>
              <button
                className={styles.confirmYes}
                onClick={remove}
                disabled={busy}
              >
                {t("participants.yes")}
              </button>
              <button
                className={styles.confirmNo}
                onClick={() => setConfirm(false)}
              >
                {t("participants.no")}
              </button>
            </>
          ) : (
            <button
              className={styles.partRemove}
              onClick={() => setConfirm(true)}
            >
              {t("participants.remove")}
            </button>
          )}
        </span>
      )}
    </li>
  );
}
