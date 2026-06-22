import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import UserRef from "../../../components/shared/UserRef";
import { getUserDisplay } from "../../../utils/userDisplay";
import ModalPortal from "../../../components/shared/ModalPortal";
import styles from "../TorneoDetail.module.css";

export default function GameScoreModal({ game, players, onClose, onConfirm }) {
  const { t } = useTranslation("torneos");
  const [scores, setScores] = useState({});
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Pre-fill with existing results when re-editing.
    const initial = {};
    if (game?.results?.length) {
      for (const r of game.results)
        initial[String(r.player?._id || r.player)] = String(r.score);
    }
    setScores(initial);
    setError("");
  }, [game?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live-calculated positions for preview.
  const positions = useMemo(() => {
    const entries = (players || []).map((p) => {
      const id = String(p._id || p);
      const raw = scores[id];
      const score = raw === "" || raw == null ? null : Number(raw);
      return { id, score: Number.isFinite(score) ? score : null };
    });
    const valid = entries.filter((e) => e.score !== null);
    valid.sort((a, b) => b.score - a.score);
    const posMap = {};
    let pos = 0;
    let last = null;
    valid.forEach((e, idx) => {
      if (e.score !== last) {
        pos = idx + 1;
        last = e.score;
      }
      posMap[e.id] = pos;
    });
    return posMap;
  }, [scores, players]);

  const handleConfirm = async () => {
    setError("");
    const results = (players || []).map((p) => {
      const id = String(p._id || p);
      const raw = scores[id];
      const score = Number(raw);
      if (raw === "" || raw == null || !Number.isFinite(score)) {
        return { id, score: null };
      }
      return { playerId: id, score };
    });
    if (results.some((r) => r.score === null)) {
      setError(t("gameScore.missingScores"));
      return;
    }
    setSub(true);
    try {
      await onConfirm({ results });
    } catch (err) {
      setError(err.response?.data?.message || t("gameScore.errorSave"));
    } finally {
      setSub(false);
    }
  };

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>
              {t("gameScore.title", { number: game.gameNumber })}
            </h3>
            <button
              className={styles.modalClose}
              onClick={onClose}
              aria-label={t("gameScore.close")}
            >
              ✕
            </button>
          </div>
          <p className={styles.modalSub}>{t("gameScore.sub")}</p>

          <ul className={styles.scoreList}>
            {(players || []).map((p) => {
              const id = String(p._id || p);
              const info = getUserDisplay(p);
              const value = scores[id] ?? "";
              const pos = positions[id];
              return (
                <li key={id} className={styles.scoreItem}>
                  <span className={styles.scorePos}>
                    {pos ? `${pos}º` : "—"}
                  </span>
                  <span className={styles.scoreUser}>
                    {info.isDeleted ? (
                      <span className={styles.deletedTxt}>
                        {t("gameScore.deletedUser")}
                      </span>
                    ) : (
                      <UserRef user={p} noLink />
                    )}
                  </span>
                  <input
                    className={`${styles.fieldInput} ${styles.scoreInput}`}
                    type="number"
                    step="any"
                    value={value}
                    onChange={(e) =>
                      setScores((s) => ({ ...s, [id]: e.target.value }))
                    }
                    placeholder={t("gameScore.scorePlaceholder")}
                  />
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
              {t("gameScore.cancel")}
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? t("gameScore.saving") : t("gameScore.save")}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
