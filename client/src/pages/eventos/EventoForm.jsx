import { useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import axios from "axios";
import { API } from "../../api/endpoints";
import PlaceAutocomplete from "../../components/shared/PlaceAutocomplete";
import InfoTooltip from "../../components/shared/InfoTooltip";
import DateTimePicker from "../../components/shared/DateTimePicker";
import ImageDropzone from "./ImageDropzone";
import { toLocalInputValue, fromLocalInputValue } from "../../utils/eventoDate";
import { getEventoStatusOptions } from "../../utils/eventoStatus";
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
  const { t } = useTranslation("eventos");
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
      setError(t("form.errorAddressMin"));
      setTimeout(() => setError(""), 3000);
      return;
    }
    setGeocoding(true);
    try {
      const { data } = await axios.get(API.geocode, { params: { q } });
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
          ? t("form.errorGeocodeNotFound")
          : err.response?.data?.message || t("form.errorGeocode");
      setError(msg);
      setTimeout(() => setError(""), 3000);
    } finally {
      setGeocoding(false);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError(t("form.errorTitleRequired"));
      return;
    }
    if (!form.eventDate) {
      setError(t("form.errorDateRequired"));
      return;
    }
    if (!form.location.texto.trim()) {
      setError(t("form.errorLocationRequired"));
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
        err?.response?.data?.message || err?.message || t("form.errorSave"),
      );
    }
  }

  const isEdit = mode === "edit";

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>
          {isEdit ? t("form.editTitle") : t("form.newTitle")}
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
            <span className={styles.fieldLabel}>{t("form.coverLabel")}</span>
            <ImageDropzone preview={preview} onFile={handleFile} />
          </div>
        </div>

        <div className={styles.splitFields}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="evento-title">
              {t("form.titleLabel")}
            </label>
            <input
              id="evento-title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder={t("form.titlePlaceholder")}
              className={styles.input}
              maxLength={200}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="evento-description">
              {t("form.descriptionLabel")}
            </label>
            <textarea
              id="evento-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder={t("form.descriptionPlaceholder")}
              className={styles.textarea}
              rows={3}
              maxLength={3000}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="evento-conditions">
              {t("form.conditionsLabel")}
            </label>
            <textarea
              id="evento-conditions"
              name="conditions"
              value={form.conditions}
              onChange={handleChange}
              placeholder={t("form.conditionsPlaceholder")}
              className={styles.textarea}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.fieldLabel} htmlFor="evento-fee">
                {t("form.feeLabel")}
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
                {t("form.maxLabel")}
              </label>
              <input
                id="evento-max"
                name="maxParticipants"
                value={form.maxParticipants}
                onChange={handleChange}
                type="number"
                min="1"
                className={styles.input}
                placeholder={t("form.maxPlaceholder")}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="evento-transfer">
              {t("form.transferLabel")}
            </label>
            <textarea
              id="evento-transfer"
              name="transferDetails"
              value={form.transferDetails}
              onChange={handleChange}
              placeholder={t("form.transferPlaceholder")}
              className={styles.textarea}
              rows={2}
              maxLength={500}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.fieldLabel} htmlFor="evento-date">
                {t("form.dateLabel")}
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
                {t("form.locationLabel")}
                <InfoTooltip label={t("form.locationHelpAria")}>
                  <Trans
                    t={t}
                    i18nKey="form.locationHelp"
                    components={{ strong: <strong /> }}
                  />
                </InfoTooltip>
              </label>
              <div className={styles.locationRow}>
                <PlaceAutocomplete
                  value={form.location.texto}
                  onChange={updateLocationTexto}
                  onSelect={handlePlaceSelect}
                  placeholder={t("form.locationPlaceholder")}
                />
                <button
                  type="button"
                  className={styles.btnSearch}
                  onClick={handleManualGeocode}
                  disabled={geocoding}
                  title={t("form.searchBtnTitle")}
                >
                  {geocoding ? "…" : t("form.searchBtn")}
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
              {t("form.displayNameLabel")}
              <span className={styles.fieldHint}>
                {t("form.displayNameOptional")}
              </span>
              <InfoTooltip label={t("form.displayNameHelpAria")}>
                <Trans
                  t={t}
                  i18nKey="form.displayNameHelp"
                  components={{ strong: <strong />, em: <em /> }}
                />
              </InfoTooltip>
            </label>
            <input
              id="evento-display-name"
              name="locationDisplayName"
              type="text"
              className={styles.input}
              value={form.location.displayName}
              onChange={(e) => updateLocationDisplayName(e.target.value)}
              placeholder={t("form.displayNamePlaceholder")}
              maxLength={100}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("form.statusLabel")}</span>
            <div
              className={styles.statusChips}
              role="radiogroup"
              aria-label={t("form.statusGroupAria")}
            >
              {getEventoStatusOptions().map((opt) => {
                const isActive = form.status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`${styles.statusChip} ${isActive ? styles[`statusChip_${opt.value}`] : ""}`}
                    onClick={() => update("status", opt.value)}
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
          {t("form.cancel")}
        </button>
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={submitting}
        >
          {submitting
            ? isEdit
              ? t("form.saving")
              : t("form.creating")
            : isEdit
              ? t("form.saveChanges")
              : t("form.createEvent")}
        </button>
      </div>
    </form>
  );
}
