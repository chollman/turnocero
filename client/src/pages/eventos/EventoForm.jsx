import { useEffect, useState } from "react";
import axios from "axios";
import PlaceAutocomplete from "../../components/shared/PlaceAutocomplete";
import InfoTooltip from "../../components/shared/InfoTooltip";
import DateTimePicker from "../../components/shared/DateTimePicker";
import ImageDropzone from "./ImageDropzone";
import { toLocalInputValue, fromLocalInputValue } from "../../utils/eventoDate";
import { EVENTO_STATUS_OPTIONS as STATUS_OPTIONS } from "../../utils/eventoStatus";
import styles from "./EventoForm.module.css";

const EMPTY_LOCATION = { texto: "", lat: null, lng: null, displayName: "" };

const EMPTY_FORM = {
  title: "",
  description: "",
  conditions: "",
  fee: "",
  transferDetails: "",
  eventDate: "",
  location: { ...EMPTY_LOCATION },
  maxParticipants: "",
  status: "open",
};

// El server normaliza pero podríamos recibir respuestas legacy si algo cachea.
// Defensivo en cliente para evitar romper la edición.
function normalizeIncomingLocation(loc) {
  if (loc == null) return { ...EMPTY_LOCATION };
  if (typeof loc === "string")
    return { texto: loc, lat: null, lng: null, displayName: "" };
  return {
    texto: loc.texto || "",
    lat: loc.lat ?? null,
    lng: loc.lng ?? null,
    displayName: loc.displayName || "",
  };
}

function valuesFromEvento(evento) {
  if (!evento) return { ...EMPTY_FORM, location: { ...EMPTY_LOCATION } };
  return {
    title: evento.title || "",
    description: evento.description || "",
    conditions: evento.conditions || "",
    fee: evento.fee ?? "",
    transferDetails: evento.transferDetails || "",
    // Convertimos el ISO UTC del server a hora local para precargar el picker;
    // si no, el input mostraría la hora UTC con etiqueta engañosa "local".
    eventDate: toLocalInputValue(evento.eventDate),
    location: normalizeIncomingLocation(evento.location),
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
  const [filePreview, setFilePreview] = useState("");
  const [error, setError] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // Generamos la object URL del archivo en un effect para poder revocarla
  // cuando cambia el archivo o cuando el form se desmonta. Antes hacíamos
  // setPreview(URL.createObjectURL(f)) en cada change, dejando URLs colgadas.
  useEffect(() => {
    if (!file) {
      setFilePreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const preview = filePreview || initialEvento?.image?.url || "";

  function update(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleChange(e) {
    update(e.target.name, e.target.value);
  }

  function handleFile(f) {
    setFile(f);
  }

  // ── Ubicación ──
  const updateLocationTexto = (texto) =>
    setForm((prev) => ({ ...prev, location: { ...prev.location, texto } }));
  const updateLocationDisplayName = (displayName) =>
    setForm((prev) => ({
      ...prev,
      location: { ...prev.location, displayName },
    }));
  const handlePlaceSelect = ({ lat, lng, formattedAddress }) =>
    setForm((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        texto: formattedAddress || prev.location.texto,
        lat,
        lng,
      },
    }));
  const handleManualGeocode = async () => {
    const q = form.location.texto.trim();
    if (q.length < 3) {
      setError("Escribí una dirección de al menos 3 caracteres.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setGeocoding(true);
    try {
      const { data } = await axios.get("/api/geocode", { params: { q } });
      setForm((prev) => ({
        ...prev,
        location: {
          texto: data.formatted || prev.location.texto,
          lat: data.lat,
          lng: data.lng,
        },
      }));
    } catch (err) {
      const msg =
        err.response?.status === 404
          ? "No se encontró la dirección. Intentá ser más específico o picá una sugerencia."
          : err.response?.data?.message || "Error al buscar la dirección.";
      setError(msg);
      setTimeout(() => setError(""), 3000);
    } finally {
      setGeocoding(false);
    }
  };

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
    if (!form.location.texto.trim()) {
      setError("El lugar del evento es obligatorio");
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
      } else if (k === "location") {
        // location es subdoc { texto, lat, lng } — FormData no soporta objetos,
        // así que la serializamos como JSON. Server hace JSON.parse en
        // normalizeLocationInput.
        fd.append(k, JSON.stringify(v));
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

      {/* En create: split (dropzone izquierda + inputs derecha) para que la
          imagen guíe el flujo visual. En edit: stacked (dropzone arriba) —
          al editar lo importante es ver los campos pre-cargados, la imagen ya
          existe y suele ser secundaria. En mobile siempre se apila. */}
      <div className={`${styles.split} ${isEdit ? styles.splitStacked : ""}`}>
        <div className={styles.splitImage}>
          <div className={styles.field}>
            {/* Span (no <label htmlFor>) porque ImageDropzone tiene su propio
                file input oculto + handler de click — el wrapper completo es
                el área clickeable, no necesita asociación HTML formal. */}
            <span className={styles.fieldLabel}>Carátula del evento</span>
            <ImageDropzone preview={preview} onFile={handleFile} />
          </div>
        </div>

        <div className={styles.splitFields}>
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
                placeholder="Vacío = Sin límite"
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
              <DateTimePicker
                id="evento-date"
                name="eventDate"
                value={form.eventDate}
                onChange={(v) => update("eventDate", v)}
                required
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.fieldLabel} htmlFor="evento-location">
                Lugar *
                <InfoTooltip label="Ayuda sobre el campo Lugar">
                  Empezá a escribir y elegí una sugerencia. Si no aparece,
                  escribí la dirección y tocá <strong>Buscar</strong>.
                </InfoTooltip>
              </label>
              <div className={styles.locationRow}>
                <PlaceAutocomplete
                  value={form.location.texto}
                  onChange={updateLocationTexto}
                  onSelect={handlePlaceSelect}
                  placeholder="Dirección del evento"
                />
                <button
                  type="button"
                  className={styles.btnSearch}
                  onClick={handleManualGeocode}
                  disabled={geocoding}
                  title="Buscar la dirección que tipeaste (sin picar sugerencia)"
                >
                  {geocoding ? "…" : "Buscar"}
                </button>
              </div>
              {form.location.lat != null && form.location.lng != null && (
                <p className={styles.coordsHint}>
                  📍 {form.location.lat.toFixed(5)},{" "}
                  {form.location.lng.toFixed(5)}
                </p>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="evento-display-name">
              Nombre de ubicación personalizado{" "}
              <span className={styles.fieldHint}>(opcional)</span>
              <InfoTooltip label="Ayuda sobre el nombre de ubicación personalizado">
                Si lo completás, aparece <strong>en lugar</strong> de la
                dirección formateada en cards y listados. Ej:{" "}
                <em>&quot;Bar de Pepe&quot;</em>,{" "}
                <em>&quot;Casa de Lucía&quot;</em>,{" "}
                <em>&quot;Centro Cultural&quot;</em>. La dirección real sigue
                usándose para distancia y mapa.
              </InfoTooltip>
            </label>
            <input
              id="evento-display-name"
              name="locationDisplayName"
              type="text"
              className={styles.input}
              value={form.location.displayName}
              onChange={(e) => updateLocationDisplayName(e.target.value)}
              placeholder="Ej. Bar de Pepe"
              maxLength={100}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Estado</span>
            <div
              className={styles.statusChips}
              role="radiogroup"
              aria-label="Estado del evento"
            >
              {STATUS_OPTIONS.map((opt) => {
                const isActive = form.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`${styles.statusChip} ${isActive ? styles[`statusChip_${opt.value}`] : ''}`}
                    onClick={() => update('status', opt.value)}
                    title={opt.description}
                  >
                    <span
                      className={`${styles.statusChipDot} ${styles[`statusChipDot_${opt.value}`]}`}
                      aria-hidden="true"
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
