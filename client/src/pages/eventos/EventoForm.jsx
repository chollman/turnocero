import { useState } from "react";
import ImageDropzone from "./ImageDropzone";
import { toLocalInputValue, fromLocalInputValue } from "../../utils/eventoDate";
import styles from "./EventoForm.module.css";

const EMPTY_FORM = {
  title: "",
  description: "",
  conditions: "",
  fee: "",
  transferDetails: "",
  eventDate: "",
  location: "",
  maxParticipants: "",
  status: "open",
};

function valuesFromEvento(evento) {
  if (!evento) return { ...EMPTY_FORM };
  return {
    title: evento.title || "",
    description: evento.description || "",
    conditions: evento.conditions || "",
    fee: evento.fee ?? "",
    transferDetails: evento.transferDetails || "",
    // Convertimos el ISO UTC del server a hora local para precargar el picker;
    // si no, el input mostraría la hora UTC con etiqueta engañosa "local".
    eventDate: toLocalInputValue(evento.eventDate),
    location: evento.location || "",
    maxParticipants: evento.maxParticipants ?? "",
    status: evento.status || "open",
  };
}

export default function EventoForm({
  mode = "create",
  initialEvento = null,
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const [form, setForm] = useState(() => valuesFromEvento(initialEvento));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(() => initialEvento?.image?.url || "");
  const [error, setError] = useState("");

  function update(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleChange(e) {
    update(e.target.name, e.target.value);
  }

  function handleFile(f) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (!form.eventDate) {
      setError("La fecha y hora del evento son obligatorias");
      return;
    }
    setError("");
    const fd = new FormData();
    // Send every field — even empty strings — so the server can clear a
    // previously-set field by submitting it blank. Partial PUTs (e.g. cancel)
    // call the endpoint directly with only the keys they want to change.
    Object.entries(form).forEach(([k, v]) => {
      if (k === "eventDate") {
        // El picker entrega hora local; al server le mandamos siempre ISO UTC
        // para que la fecha se interprete igual sin importar la TZ del host.
        fd.append(k, fromLocalInputValue(v));
      } else {
        fd.append(k, v == null ? "" : v);
      }
    });
    if (file) fd.append("image", file);
    try {
      await onSubmit(fd);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Error al guardar",
      );
    }
  }

  const isEdit = mode === "edit";

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>
          {isEdit ? "Editar evento" : "Nuevo evento"}
        </span>
        <span className={styles.rule} />
      </div>

      <ImageDropzone preview={preview} onFile={handleFile} />

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="evento-title">
          Título *
        </label>
        <input
          id="evento-title"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Ej. Torneo de Catán · Otoño 2026"
          className={styles.input}
          maxLength={200}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="evento-description">
          Descripción
        </label>
        <textarea
          id="evento-description"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Contá de qué se trata el evento."
          className={styles.textarea}
          rows={3}
          maxLength={3000}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="evento-conditions">
          Condiciones de inscripción
        </label>
        <textarea
          id="evento-conditions"
          name="conditions"
          value={form.conditions}
          onChange={handleChange}
          placeholder="Reglas, cancelaciones, requisitos."
          className={styles.textarea}
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field} style={{ flex: 1 }}>
          <label className={styles.fieldLabel} htmlFor="evento-fee">
            Monto ($ARS, 0 = gratis)
          </label>
          <input
            id="evento-fee"
            name="fee"
            value={form.fee}
            onChange={handleChange}
            type="number"
            min="0"
            className={styles.input}
            placeholder="0"
          />
        </div>
        <div className={styles.field} style={{ flex: 1 }}>
          <label className={styles.fieldLabel} htmlFor="evento-max">
            Cupo máximo
          </label>
          <input
            id="evento-max"
            name="maxParticipants"
            value={form.maxParticipants}
            onChange={handleChange}
            type="number"
            min="1"
            className={styles.input}
            placeholder="vacío = sin límite"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="evento-transfer">
          Datos de transferencia
        </label>
        <textarea
          id="evento-transfer"
          name="transferDetails"
          value={form.transferDetails}
          onChange={handleChange}
          placeholder="Alias / CBU / Titular / Instrucciones."
          className={styles.textarea}
          rows={2}
          maxLength={500}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field} style={{ flex: 1 }}>
          <label className={styles.fieldLabel} htmlFor="evento-date">
            Fecha y hora *
          </label>
          <input
            id="evento-date"
            name="eventDate"
            value={form.eventDate}
            onChange={handleChange}
            type="datetime-local"
            className={styles.input}
            aria-required="true"
          />
        </div>
        <div className={styles.field} style={{ flex: 1 }}>
          <label className={styles.fieldLabel} htmlFor="evento-location">
            Lugar
          </label>
          <input
            id="evento-location"
            name="location"
            value={form.location}
            onChange={handleChange}
            type="text"
            className={styles.input}
            placeholder="Bar / Club / Casa"
            maxLength={300}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="evento-status">
          Estado
        </label>
        <select
          id="evento-status"
          name="status"
          value={form.status}
          onChange={handleChange}
          className={styles.select}
        >
          <option value="draft">Borrador (no visible)</option>
          <option value="open">Abierto (inscripciones habilitadas)</option>
          <option value="closed">Cerrado (sin inscripciones)</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={submitting}
        >
          {submitting
            ? isEdit
              ? "Guardando…"
              : "Creando…"
            : isEdit
              ? "Guardar cambios"
              : "Crear evento"}
        </button>
      </div>
    </form>
  );
}
