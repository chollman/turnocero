import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import UserRef from "../../../components/shared/UserRef";
import { getUserDisplay } from "../../../utils/userDisplay";
import ModalPortal from "../../../components/shared/ModalPortal";
import { reorderSeeds } from "../../../queries/torneos";
import styles from "../TorneoDetail.module.css";

export default function SeedReorderModal({ torneo, onClose, onSaved }) {
  const { t } = useTranslation("torneos");
  const [order, setOrder] = useState(torneo.participants || []);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOrder(torneo.participants || []);
  }, [torneo._id, torneo.participants]);

  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
  };

  const handleSave = async () => {
    setSub(true);
    setError("");
    try {
      const ids = order.map((u) => u._id || u);
      const { data } = await reorderSeeds(torneo._id, ids);
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.message || t("seeds.errorSave"));
    } finally {
      setSub(false);
    }
  };

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>{t("seeds.title")}</h3>
            <button
              className={styles.modalClose}
              onClick={onClose}
              aria-label={t("seeds.close")}
            >
              ✕
            </button>
          </div>
          <p className={styles.modalSub}>{t("seeds.sub")}</p>

          <ul className={styles.seedList}>
            {order.map((u, i) => {
              const info = getUserDisplay(u);
              return (
                <li key={u._id || u} className={styles.seedItem}>
                  <span className={styles.seedNumber}>#{i + 1}</span>
                  <span className={styles.seedName}>
                    {info.isDeleted ? (
                      <span className={styles.deletedTxt}>
                        {t("seeds.deletedUser")}
                      </span>
                    ) : (
                      <UserRef user={u} noLink />
                    )}
                  </span>
                  <span className={styles.seedActions}>
                    <button
                      className={styles.seedBtn}
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={t("seeds.up")}
                    >
                      ↑
                    </button>
                    <button
                      className={styles.seedBtn}
                      onClick={() => move(i, +1)}
                      disabled={i === order.length - 1}
                      aria-label={t("seeds.down")}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.modalActions}>
            <button
              className={styles.btnGhost}
              onClick={onClose}
              disabled={submitting}
            >
              {t("seeds.cancel")}
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={submitting}
            >
              {submitting ? t("seeds.saving") : t("seeds.save")}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
