import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../../api/endpoints";
import { useNotifications } from "../../../context/NotificationContext";
import { getErrorMessage } from "../../../utils/getErrorMessage";
import ResultsView from "./ResultsView";
import styles from "../MathTradeDetail.module.css";

// Próximas acciones de estado por estado actual (espejo del VALID_TRANSITIONS
// del server, con labels amigables). El target 'results' dispara la corrida +
// publicación.
const NEXT_ACTIONS = {
  draft: [{ to: "open", label: "Abrir inscripción" }],
  open: [
    { to: "locked", label: "Cerrar inscripción" },
    { to: "draft", label: "Volver a borrador" },
  ],
  locked: [
    { to: "results", label: "Publicar resultados", primary: true },
    { to: "open", label: "Reabrir inscripción" },
  ],
  results: [
    { to: "finished", label: "Finalizar" },
    { to: "locked", label: "Despublicar" },
  ],
  finished: [],
  cancelled: [],
};

export default function AdminPanel({ trade, onUpdated }) {
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const [mode, setMode] = useState(trade.matching?.mode || "max");
  const [maxChain, setMaxChain] = useState(trade.matching?.maxChainLength || 4);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const actions = NEXT_ACTIONS[trade.status] || [];
  const canCancel = !["finished", "cancelled"].includes(trade.status);

  const changeStatus = async (to) => {
    setBusy(true);
    try {
      // Al publicar, corremos primero el matching con la config elegida para
      // que se use ese modo (status→results no re-corre si ya hay lastRunAt).
      if (to === "results") {
        await axios.post(API.mathtrade.RUN_MATCHING(trade._id), {
          mode,
          maxChainLength: maxChain,
        });
      }
      const { data } = await axios.patch(API.mathtrade.STATUS(trade._id), {
        status: to,
      });
      onUpdated?.(data);
      setPreview(null);
    } catch (err) {
      addToast({
        type: "error",
        title: "No se pudo cambiar el estado",
        message: getErrorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(
        API.mathtrade.RUN_MATCHING_PREVIEW(trade._id),
        { mode, maxChainLength: maxChain },
      );
      setPreview(data);
    } catch (err) {
      addToast({
        type: "error",
        title: "No se pudo calcular el preview",
        message: getErrorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!window.confirm("¿Eliminar este math trade? No se puede deshacer."))
      return;
    setBusy(true);
    try {
      await axios.delete(API.mathtrade.DETAIL(trade._id));
      navigate("/math-trade");
    } catch (err) {
      addToast({
        type: "error",
        title: "No se pudo eliminar",
        message: getErrorMessage(err),
      });
      setBusy(false);
    }
  };

  return (
    <div className={styles.adminPanel}>
      <div className={styles.adminTitle}>Panel del organizador</div>

      <div className={styles.adminRow}>
        {actions.map((a) => (
          <button
            key={a.to}
            className={styles.adminBtn}
            onClick={() => changeStatus(a.to)}
            disabled={busy}
          >
            {a.label}
          </button>
        ))}
        {canCancel && (
          <button
            className={`${styles.adminBtn} ${styles.dangerBtn}`}
            onClick={() => changeStatus("cancelled")}
            disabled={busy}
          >
            Cancelar evento
          </button>
        )}
        <button
          className={styles.adminBtn}
          onClick={() => navigate(`/math-trade/${trade._id}/editar`)}
          disabled={busy}
        >
          Editar
        </button>
        {trade.status === "draft" && (
          <button
            className={`${styles.adminBtn} ${styles.dangerBtn}`}
            onClick={del}
            disabled={busy}
          >
            Eliminar
          </button>
        )}
      </div>

      {trade.status === "locked" && (
        <>
          <div className={styles.adminRow}>
            <label>
              Modo:{" "}
              <select
                className={styles.adminSelect}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="auto">Automática (recomendada)</option>
                <option value="max">Cadena máxima</option>
                <option value="bounded">Cadena acotada</option>
              </select>
            </label>
            {mode === "bounded" && (
              <label>
                Máx. cadena:{" "}
                <input
                  type="number"
                  min={2}
                  max={12}
                  className={styles.adminSelect}
                  style={{ width: 70 }}
                  value={maxChain}
                  onChange={(e) => setMaxChain(Number(e.target.value))}
                />
              </label>
            )}
            <button
              className={styles.adminBtn}
              onClick={runPreview}
              disabled={busy}
            >
              Probar matching (preview)
            </button>
          </div>

          {preview && (
            <div style={{ marginTop: 12 }}>
              <ResultsView results={preview} currentUserId={null} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
