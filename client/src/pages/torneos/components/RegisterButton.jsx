import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../../../context/NotificationContext";
import { API } from "../../../api/endpoints";
import styles from "../TorneoDetail.module.css";

export default function RegisterButton({ torneo, user, onChange }) {
  const { t } = useTranslation("torneos");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justRegistered, setJust] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useNotifications();

  // After registering: show animated success row for 3s then collapse to pill.
  useEffect(() => {
    if (!justRegistered) return;
    const t = setTimeout(() => setJust(false), 3000);
    return () => clearTimeout(t);
  }, [justRegistered]);

  if (torneo.status !== "registration") return null;
  if (torneo.inscriptionMode === "admin_only") {
    // In admin_only mode, regular users see no button. (Participants already
    // added see their "Estás inscripto" pill via TorneoDetail's title block.)
    return null;
  }

  if (!user) {
    return (
      <button className={styles.btnPrimary} onClick={() => navigate("/login")}>
        {t("register.loginToRegister")}
      </button>
    );
  }

  const myId = String(user._id);
  const isParticipant = (torneo.participants || []).some(
    (p) => String(p._id || p) === myId,
  );
  const isPending = (torneo.pendingRegistrations || []).some(
    (r) => String(r.user?._id || r.user) === myId,
  );
  const cupoLleno =
    torneo.maxParticipants &&
    (torneo.participants?.length || 0) >= torneo.maxParticipants;

  const register = async () => {
    setBusy(true);
    setError("");
    try {
      await axios.post(API.torneos.REGISTER(torneo._id));
      addToast({
        type: "tournament_pending",
        torneoId: torneo._id,
        torneoTitle: torneo.title,
      });
      setJust(true);
      onChange();
    } catch (err) {
      setError(err.response?.data?.message || t("register.errorRegister"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      await axios.delete(API.torneos.REGISTER(torneo._id));
      onChange();
    } catch (err) {
      setError(err.response?.data?.message || t("register.errorCancel"));
    } finally {
      setBusy(false);
    }
  };

  if (isParticipant) {
    return (
      <span className={styles.statusPill}>{t("register.registered")}</span>
    );
  }

  if (isPending) {
    if (justRegistered) {
      return (
        <div
          className={`${styles.registerSuccess} ${styles.registerSuccessVisible}`}
        >
          <span className={styles.registerSuccessIcon}>✅</span>
          <div className={styles.registerSuccessText}>
            <strong>{t("register.sentTitle")}</strong>
            <span>{t("register.sentSub")}</span>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.inlineRow}>
        <span className={styles.statusPillWarn}>{t("register.pending")}</span>
        <button className={styles.btnGhost} onClick={cancel} disabled={busy}>
          {t("register.cancel")}
        </button>
        {error && <p className={styles.errorMsg}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={styles.inlineCol}>
      <button
        className={styles.btnPrimary}
        onClick={register}
        disabled={busy || cupoLleno}
      >
        {busy
          ? t("register.sending")
          : cupoLleno
            ? t("register.full")
            : t("register.register")}
      </button>
      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}
