import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API } from "../../../api/endpoints";
import styles from "../TorneoDetail.module.css";

const NEXT_LABEL = {
  draft: { next: "registration", label: "Abrir inscripciones" },
  registration: { next: "in_progress", label: "Iniciar torneo" },
  in_progress: { next: "finished", label: "Finalizar torneo" },
  finished: null,
};

const BACK_LABEL = {
  registration: { next: "draft", label: "Volver a borrador" },
};

export default function AdminPanel({
  torneo,
  onChange,
  onReorderSeeds,
  onAddParticipants,
  onDelete,
}) {
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
      const { data } = await axios.patch(API.torneos.STATUS(torneo._id), {
        status,
      });
      onChange(data);
    } catch (err) {
      setError(err.response?.data?.message || "Error al cambiar el estado");
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
      await axios.delete(API.torneos.DETAIL(torneo._id));
      onDelete();
    } catch (err) {
      setError(err.response?.data?.message || "Error al eliminar");
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await axios.post(API.torneos.RESET(torneo._id));
      onChange(data);
    } catch (err) {
      setError(err.response?.data?.message || "Error al reiniciar el torneo");
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
        <span className={styles.adminBadge}>Panel admin</span>
        <div className={styles.adminLinks}>
          <Link
            to={`/torneos/${torneo._id}/editar`}
            className={styles.adminLink}
          >
            Editar
          </Link>
          {confirmingDelete ? (
            <span className={styles.confirmRow}>
              <span className={styles.confirmLabel}>¿Eliminar?</span>
              <button
                className={styles.confirmYes}
                onClick={handleDelete}
                disabled={busy}
              >
                Sí
              </button>
              <button
                className={styles.confirmNo}
                onClick={() => setConfirmingDelete(false)}
              >
                No
              </button>
            </span>
          ) : (
            <button
              className={styles.adminLinkDanger}
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              Eliminar
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
              + Agregar participantes
            </button>
          )}

        {(torneo.status === "draft" || torneo.status === "registration") && (
          <button
            className={styles.btnGhost}
            onClick={onReorderSeeds}
            disabled={busy || (torneo.participants?.length || 0) < 2}
          >
            Reordenar seeds
          </button>
        )}

        {back && (
          <button
            className={styles.btnGhost}
            onClick={() => changeStatus(back.next)}
            disabled={busy}
          >
            {back.label}
          </button>
        )}

        {confirmingStart ? (
          <span className={styles.confirmInline}>
            <span className={styles.confirmLabel}>
              ¿Generar fixture y arrancar?
            </span>
            <button
              className={styles.btnPrimary}
              onClick={() => changeStatus("in_progress")}
              disabled={busy}
            >
              Sí, iniciar
            </button>
            <button
              className={styles.btnGhost}
              onClick={() => setConfirmingStart(false)}
              disabled={busy}
            >
              Cancelar
            </button>
          </span>
        ) : confirmingFinish ? (
          <span className={styles.confirmInline}>
            <span className={styles.confirmLabel}>¿Finalizar el torneo?</span>
            <button
              className={styles.btnPrimary}
              onClick={() => changeStatus("finished")}
              disabled={busy}
            >
              Sí, finalizar
            </button>
            <button
              className={styles.btnGhost}
              onClick={() => setConfirmingFinish(false)}
              disabled={busy}
            >
              Cancelar
            </button>
          </span>
        ) : next ? (
          <button
            className={styles.btnPrimary}
            onClick={handleNext}
            disabled={busy}
          >
            {next.label}
          </button>
        ) : null}

        {canReset &&
          (confirmingReset ? (
            <span className={styles.confirmInline}>
              <span className={styles.confirmLabel}>
                ⚠ Se borrarán todas las partidas/resultados cargados y se
                regenerará el fixture desde cero. ¿Reiniciar?
              </span>
              <button
                className={styles.confirmYes}
                onClick={handleReset}
                disabled={busy}
              >
                Sí, reiniciar
              </button>
              <button
                className={styles.btnGhost}
                onClick={() => setConfirmingReset(false)}
                disabled={busy}
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              className={styles.btnGhost}
              onClick={() => setConfirmingReset(true)}
              disabled={busy}
              title="Borra todos los matches/grupos y regenera el fixture con los mismos participantes"
            >
              ↻ Reiniciar torneo
            </button>
          ))}
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}
