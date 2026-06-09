import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { API } from "../../api/endpoints";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import { getErrorMessage } from "../../utils/getErrorMessage";
import DateTimePicker from "../../components/shared/DateTimePicker";
import InfoTooltip from "../../components/shared/InfoTooltip";
import BackButton from "../../components/shared/BackButton";
import ImageDropzone from "../torneos/components/ImageDropzone";
import styles from "./MathTradeForm.module.css";

// Form compartido por crear y editar. `initial` viene poblado en modo edición.
export default function MathTradeForm({ mode = "create", initial = null }) {
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const brandName = useBrandName();

  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [deadline, setDeadline] = useState(
    initial?.submissionDeadline
      ? new Date(initial.submissionDeadline).toISOString().slice(0, 16)
      : "",
  );
  const [matchMode, setMatchMode] = useState(initial?.matching?.mode || "auto");
  const [maxChain, setMaxChain] = useState(
    initial?.matching?.maxChainLength || 4,
  );
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initial?.image?.url || null);
  const [submitting, setSubmitting] = useState(false);

  const handleFile = (f) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : initial?.image?.url || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast({ type: "error", title: "Falta el título" });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      if (deadline) fd.append("submissionDeadline", deadline);
      fd.append("mode", matchMode);
      fd.append("maxChainLength", String(maxChain));
      if (file) fd.append("image", file);

      const res =
        mode === "create"
          ? await axios.post(API.mathtrade.LIST, fd)
          : await axios.put(API.mathtrade.DETAIL(initial._id), fd);
      navigate(`/math-trade/${res.data._id}`);
    } catch (err) {
      addToast({
        type: "error",
        title:
          mode === "create"
            ? "No pudimos crear el intercambio"
            : "No pudimos guardar los cambios",
        message: getErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>
          {`${
            mode === "create" ? "Nuevo intercambio" : "Editar intercambio"
          } – ${brandName}`}
        </title>
      </Helmet>
      <div className={styles.inner}>
        <BackButton to="/math-trade">Volver a Math Trade</BackButton>
        <h1 className={styles.title}>
          {mode === "create" ? "Nuevo intercambio" : "Editar intercambio"}
        </h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="mt-title">
              Título
            </label>
            <input
              id="mt-title"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Ej: Math Trade de fin de año"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="mt-desc">
              Descripción
            </label>
            <textarea
              id="mt-desc"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Reglas, fechas de entrega, punto de encuentro…"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Fecha límite de inscripción</span>
            <DateTimePicker value={deadline} onChange={setDeadline} />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>
              Algoritmo de matching
              <InfoTooltip>
                Automática: maximiza los intercambios pero usa la cadena más
                corta posible que no te haga perder intercambios (más robusto).
                Cadena máxima: el máximo de intercambios, cadenas de cualquier
                largo. Cadena acotada: vos fijás el largo máximo de cadena.
              </InfoTooltip>
            </span>
            <div className={styles.modeRow}>
              <button
                type="button"
                className={`${styles.modeBtn} ${matchMode === "auto" ? styles.modeBtnActive : ""}`}
                onClick={() => setMatchMode("auto")}
              >
                <span className={styles.modeBtnTitle}>Automática ✦</span>
                <span className={styles.modeBtnDesc}>
                  La cadena más corta que no pierde intercambios. Recomendada.
                </span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${matchMode === "max" ? styles.modeBtnActive : ""}`}
                onClick={() => setMatchMode("max")}
              >
                <span className={styles.modeBtnTitle}>Cadena máxima</span>
                <span className={styles.modeBtnDesc}>
                  Maximiza los intercambios, cadenas de cualquier largo.
                </span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${matchMode === "bounded" ? styles.modeBtnActive : ""}`}
                onClick={() => setMatchMode("bounded")}
              >
                <span className={styles.modeBtnTitle}>Cadena acotada</span>
                <span className={styles.modeBtnDesc}>
                  Vos fijás el largo máximo de cadena.
                </span>
              </button>
            </div>
          </div>

          {matchMode === "bounded" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="mt-chain">
                Máximo de personas por cadena
              </label>
              <div className={styles.numberRow}>
                <input
                  id="mt-chain"
                  type="number"
                  min={2}
                  max={12}
                  className={`${styles.input} ${styles.numberInput}`}
                  value={maxChain}
                  onChange={(e) => setMaxChain(Number(e.target.value))}
                />
                <span className={styles.modeBtnDesc}>entre 2 y 12</span>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>Imagen (opcional)</span>
            <ImageDropzone preview={preview} onFile={handleFile} />
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submit}
              disabled={submitting}
            >
              {submitting
                ? "Guardando…"
                : mode === "create"
                  ? "Crear intercambio"
                  : "Guardar cambios"}
            </button>
            <Link to="/math-trade" className={styles.cancel}>
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
