import { useState, useEffect } from "react";
import UserRef from "../../../components/shared/UserRef";
import ModalPortal from "../../../components/shared/ModalPortal";
import styles from "../TorneoDetail.module.css";

export default function RecordResultModal({
  match,
  format,
  onClose,
  onConfirm,
}) {
  const [choice, setChoice] = useState(null); // 'A' | 'B' | 'draw'
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setChoice(null);
    setError("");
  }, [match?._id]);

  if (!match) return null;

  const handleConfirm = async () => {
    if (!choice) {
      setError("Elegí un resultado");
      return;
    }
    setSub(true);
    setError("");
    try {
      if (choice === "draw") {
        await onConfirm({ draw: true });
      } else {
        const winnerId = choice === "A" ? match.playerA._id : match.playerB._id;
        await onConfirm({ winnerId });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error al guardar");
    } finally {
      setSub(false);
    }
  };

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>Cargar resultado</h3>
            <button
              className={styles.modalClose}
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <p className={styles.modalSub}>¿Quién ganó el partido?</p>

          <div className={styles.choiceGroup}>
            <button
              className={`${styles.choiceBtn} ${choice === "A" ? styles.choiceBtnActive : ""}`}
              onClick={() => setChoice("A")}
            >
              <span className={styles.choiceLabel}>Ganó</span>
              <span className={styles.choicePlayer}>
                <UserRef user={match.playerA} noLink />
              </span>
            </button>

            <button
              className={`${styles.choiceBtn} ${choice === "B" ? styles.choiceBtnActive : ""}`}
              onClick={() => setChoice("B")}
            >
              <span className={styles.choiceLabel}>Ganó</span>
              <span className={styles.choicePlayer}>
                <UserRef user={match.playerB} noLink />
              </span>
            </button>

            {format === "league" && (
              <button
                className={`${styles.choiceBtn} ${styles.choiceBtnDraw} ${choice === "draw" ? styles.choiceBtnActive : ""}`}
                onClick={() => setChoice("draw")}
              >
                <span className={styles.choiceLabel}>Empate</span>
                <span className={styles.choicePlayer}>1 punto a cada uno</span>
              </button>
            )}
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.modalActions}>
            <button
              className={styles.btnGhost}
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleConfirm}
              disabled={submitting || !choice}
            >
              {submitting ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
