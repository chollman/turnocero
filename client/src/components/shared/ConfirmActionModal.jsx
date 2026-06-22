import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./ConfirmActionModal.module.css";

export default function ConfirmActionModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = "warning",
  inputLabel,
  inputPlaceholder,
  inputMaxLength = 500,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  // Los defaults de label viven acá (no en el param) porque `t` no está
  // disponible en la firma. Un label pasado por el caller gana al genérico.
  const resolvedConfirmLabel = confirmLabel ?? t("common:actions.confirm");
  const resolvedCancelLabel = cancelLabel ?? t("common:actions.cancel");

  useEffect(() => {
    if (isOpen) setValue("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(value);
  };

  return (
    <div className={styles.overlay} onClick={loading ? undefined : onCancel}>
      <div
        className={`${styles.modal} ${variant === "danger" ? styles.danger : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.title}>{title}</h2>
        {message && <p className={styles.message}>{message}</p>}

        {inputLabel && (
          <label className={styles.field}>
            <span className={styles.label}>{inputLabel}</span>
            <textarea
              className={styles.input}
              placeholder={inputPlaceholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={inputMaxLength}
              rows={3}
              disabled={loading}
            />
          </label>
        )}

        <div className={styles.actions}>
          <button
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={loading}
          >
            {resolvedCancelLabel}
          </button>
          <button
            className={`${styles.btnConfirm} ${variant === "danger" ? styles.btnDanger : ""}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? t("shared:confirmAction.loading") : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
