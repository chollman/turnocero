import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  changeTorneoStatus,
  deleteTorneo,
  resetTorneo,
} from "../../../queries/torneos";
import styles from "../TorneoDetail.module.css";

const NEXT_LABEL = {
  draft: { next: "registration", labelKey: "adminPanel.openRegistrations" },
  registration: { next: "in_progress", labelKey: "adminPanel.startTournament" },
  in_progress: { next: "finished", labelKey: "adminPanel.finishTournament" },
  finished: null,
};

const BACK_LABEL = {
  registration: { next: "draft", labelKey: "adminPanel.backToDraft" },
};

export default function AdminPanel({
  torneo,
  onChange,
  onReorderSeeds,
  onAddParticipants,
  onDelete,
}) {
  const { t } = useTranslation("torneos");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingStart, setConfirmingStart] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const next = NEXT_LABEL[torneo.status];
  const back = BACK_LABEL[torneo.status];

  const changeStatus = async (status) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await changeTorneoStatus(torneo._id, status);
      onChange(data);
    } catch (err) {
      setError(err.response?.data?.message || t("adminPanel.errorStatus"));
    } finally {
      setBusy(false);
      setConfirmingStart(false);
      setConfirmingFinish(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteTorneo(torneo._id);
      onDelete();
    } catch (err) {
      setError(err.response?.data?.message || t("adminPanel.errorDelete"));
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await resetTorneo(torneo._id);
      onChange(data);
    } catch (err) {
      setError(err.response?.data?.message || t("adminPanel.errorReset"));
    } finally {
      setBusy(false);
      setConfirmingReset(false);
    }
  };

  const canReset =
    torneo.status === "in_progress" || torneo.status === "finished";

  const handleNext = () => {
    if (!next) return;
    if (next.next === "in_progress") {
      setConfirmingStart(true);
      return;
    }
    if (next.next === "finished") {
      setConfirmingFinish(true);
      return;
    }
    changeStatus(next.next);
  };

  return (
    <div className={styles.adminPanel}>
      <div className={styles.adminHeader}>
        <span className={styles.adminBadge}>{t("adminPanel.badge")}</span>
        <div className={styles.adminLinks}>
          <Link
            to={`/torneos/${torneo._id}/editar`}
            className={styles.adminLink}
          >
            {t("adminPanel.edit")}
          </Link>
          {confirmingDelete ? (
            <span className={styles.confirmRow}>
              <span className={styles.confirmLabel}>
                {t("adminPanel.confirmDelete")}
              </span>
              <button
                className={styles.confirmYes}
                onClick={handleDelete}
                disabled={busy}
              >
                {t("adminPanel.yes")}
              </button>
              <button
                className={styles.confirmNo}
                onClick={() => setConfirmingDelete(false)}
              >
                {t("adminPanel.no")}
              </button>
            </span>
          ) : (
            <button
              className={styles.adminLinkDanger}
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              {t("adminPanel.delete")}
            </button>
          )}
        </div>
      </div>

      <div className={styles.adminActions}>
        {torneo.inscriptionMode === "admin_only" &&
          ["draft", "registration"].includes(torneo.status) && (
            <button
              className={styles.btnGhost}
              onClick={onAddParticipants}
              disabled={busy}
            >
              {t("adminPanel.addParticipants")}
            </button>
          )}

        {(torneo.status === "draft" || torneo.status === "registration") && (
          <button
            className={styles.btnGhost}
            onClick={onReorderSeeds}
            disabled={busy || (torneo.participants?.length || 0) < 2}
          >
            {t("adminPanel.reorderSeeds")}
          </button>
        )}

        {back && (
          <button
            className={styles.btnGhost}
            onClick={() => changeStatus(back.next)}
            disabled={busy}
          >
            {t(back.labelKey)}
          </button>
        )}

        {confirmingStart ? (
          <span className={styles.confirmInline}>
            <span className={styles.confirmLabel}>
              {t("adminPanel.confirmStart")}
            </span>
            <button
              className={styles.btnPrimary}
              onClick={() => changeStatus("in_progress")}
              disabled={busy}
            >
              {t("adminPanel.yesStart")}
            </button>
            <button
              className={styles.btnGhost}
              onClick={() => setConfirmingStart(false)}
              disabled={busy}
            >
              {t("adminPanel.cancel")}
            </button>
          </span>
        ) : confirmingFinish ? (
          <span className={styles.confirmInline}>
            <span className={styles.confirmLabel}>
              {t("adminPanel.confirmFinish")}
            </span>
            <button
              className={styles.btnPrimary}
              onClick={() => changeStatus("finished")}
              disabled={busy}
            >
              {t("adminPanel.yesFinish")}
            </button>
            <button
              className={styles.btnGhost}
              onClick={() => setConfirmingFinish(false)}
              disabled={busy}
            >
              {t("adminPanel.cancel")}
            </button>
          </span>
        ) : next ? (
          <button
            className={styles.btnPrimary}
            onClick={handleNext}
            disabled={busy}
          >
            {t(next.labelKey)}
          </button>
        ) : null}

        {canReset &&
          (confirmingReset ? (
            <span className={styles.confirmInline}>
              <span className={styles.confirmLabel}>
                {t("adminPanel.confirmReset")}
              </span>
              <button
                className={styles.confirmYes}
                onClick={handleReset}
                disabled={busy}
              >
                {t("adminPanel.yesReset")}
              </button>
              <button
                className={styles.btnGhost}
                onClick={() => setConfirmingReset(false)}
                disabled={busy}
              >
                {t("adminPanel.cancel")}
              </button>
            </span>
          ) : (
            <button
              className={styles.btnGhost}
              onClick={() => setConfirmingReset(true)}
              disabled={busy}
              title={t("adminPanel.resetTitle")}
            >
              {t("adminPanel.reset")}
            </button>
          ))}
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}
