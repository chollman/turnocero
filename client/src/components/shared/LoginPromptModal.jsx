import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./LoginPromptModal.module.css";

export default function LoginPromptModal({ isOpen, onClose, message }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>🎲</div>
        <h2 className={styles.title}>{t("shared:loginPrompt.title")}</h2>
        <p className={styles.message}>
          {message || t("shared:loginPrompt.defaultMessage")}
        </p>
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={() => navigate("/login")}
          >
            {t("shared:loginPrompt.login")}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => navigate("/register")}
          >
            {t("shared:loginPrompt.register")}
          </button>
        </div>
        <button
          className={styles.close}
          onClick={onClose}
          aria-label={t("common:actions.close")}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
