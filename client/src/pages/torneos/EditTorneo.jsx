import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import { toLocalInputValue, fromLocalInputValue } from "../../utils/eventoDate";
import DateTimePicker from "../../components/shared/DateTimePicker";
import ImageDropzone from "./components/ImageDropzone";
import styles from "./Torneos.module.css";

export default function EditTorneo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const brandName = useBrandName();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [game, setGame] = useState("");
  const [maxParticipants, setMax] = useState("");
  const [fecha, setFecha] = useState("");
  const [inscriptionMode, setInscMode] = useState("open");
  const [torneoFormat, setTorneoFormat] = useState("league");
  const [torneoStatus, setTorneoStatus] = useState("draft");
  const [tableSize, setTableSize] = useState(4);
  const [gamesPerGroup, setGamesPerGroup] = useState(3);
  const [qualifiersPerGroup, setQualif] = useState(2);
  const [currentImage, setCurrentImage] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    axios
      .get(API.torneos.DETAIL(id), { signal: ac.signal })
      .then(({ data }) => {
        if (ac.signal.aborted) return;
        setTitle(data.title || "");
        setDesc(data.description || "");
        setGame(data.game || "");
        setMax(data.maxParticipants ?? "");
        setFecha(data.fecha ? toLocalInputValue(data.fecha) : "");
        setInscMode(data.inscriptionMode || "open");
        setTorneoFormat(data.format);
        setTorneoStatus(data.status);
        setTableSize(data.tableSize ?? 4);
        setGamesPerGroup(data.gamesPerGroup ?? 3);
        setQualif(data.qualifiersPerGroup ?? 2);
        setCurrentImage(data.image?.url || null);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setNotFound(true);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [id]);

  const handleFile = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSub(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("game", game.trim());
      fd.append("inscriptionMode", inscriptionMode);
      if (maxParticipants !== "") fd.append("maxParticipants", maxParticipants);
      // Siempre la mandamos: "" limpia la fecha (PUT parcial la borra).
      fd.append("fecha", fecha ? fromLocalInputValue(fecha) : "");
      if (torneoFormat === "groups" && torneoStatus === "draft") {
        fd.append("tableSize", String(tableSize));
        fd.append("gamesPerGroup", String(gamesPerGroup));
        fd.append("qualifiersPerGroup", String(qualifiersPerGroup));
      }
      if (file) fd.append("image", file);
      await axios.put(API.torneos.DETAIL(id), fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/torneos/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Error al guardar");
    } finally {
      setSub(false);
    }
  };

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.cardDate}>Cargando…</p>
        </div>
      </div>
    );
  if (notFound)
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.cardDate}>Torneo no encontrado</p>
        </div>
      </div>
    );

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`Editar torneo – ${brandName}`}</title>
      </Helmet>
      <div className={styles.inner}>
        <div className={styles.formHeader}>
          <Link to={`/torneos/${id}`} className={styles.backLink}>
            ← Volver al torneo
          </Link>
          <h1 className={styles.title}>Editar torneo</h1>
        </div>

        <form className={styles.formCard} onSubmit={handleSubmit}>
          <ImageDropzone
            preview={preview || currentImage}
            onFile={handleFile}
          />
          {file && (
            <span className={styles.editImageHint}>
              Nueva imagen seleccionada — se reemplazará al guardar
            </span>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Título *</span>
            <input
              className={styles.fieldInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Juego *</span>
            <input
              className={styles.fieldInput}
              value={game}
              onChange={(e) => setGame(e.target.value)}
              maxLength={200}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Descripción</span>
            <textarea
              className={styles.fieldTextarea}
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Cupo máximo</span>
            <input
              className={styles.fieldInput}
              type="number"
              min={2}
              value={maxParticipants}
              onChange={(e) => setMax(e.target.value)}
              placeholder="Dejá vacío para sin tope"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Fecha (opcional)</span>
            <DateTimePicker
              id="torneo-fecha"
              name="fecha"
              value={fecha}
              onChange={setFecha}
            />
            <span className={styles.formHint}>
              Si la cargás, el torneo aparece en el Calendario.
            </span>
          </label>

          {["draft", "registration"].includes(torneoStatus) && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Modo de inscripción</span>
              <div className={styles.formatOptions}>
                <button
                  type="button"
                  className={`${styles.formatOption} ${inscriptionMode === "open" ? styles.formatOptionActive : ""}`}
                  onClick={() => setInscMode("open")}
                >
                  <span className={styles.formatIcon}>📝</span>
                  <span className={styles.formatName}>Inscripción abierta</span>
                </button>
                <button
                  type="button"
                  className={`${styles.formatOption} ${inscriptionMode === "admin_only" ? styles.formatOptionActive : ""}`}
                  onClick={() => setInscMode("admin_only")}
                >
                  <span className={styles.formatIcon}>👤</span>
                  <span className={styles.formatName}>
                    Yo agrego participantes
                  </span>
                </button>
              </div>
            </label>
          )}

          {torneoFormat === "groups" && torneoStatus === "draft" && (
            <div className={styles.groupsConfig}>
              <h3 className={styles.groupsConfigTitle}>
                Configuración Grupos (editable solo en borrador)
              </h3>
              <div className={styles.groupsConfigGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Jugadores por mesa</span>
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min={2}
                    max={12}
                    value={tableSize}
                    onChange={(e) => setTableSize(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Partidas por grupo</span>
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min={1}
                    max={12}
                    value={gamesPerGroup}
                    onChange={(e) => setGamesPerGroup(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    Clasificados por grupo
                  </span>
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min={1}
                    value={qualifiersPerGroup}
                    onChange={(e) => setQualif(e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.formActions}>
            <Link to={`/torneos/${id}`} className={styles.btnGhost}>
              Cancelar
            </Link>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
          <p className={styles.formHint}>
            Nota: el formato del torneo no se puede editar después de creado. La
            configuración de Grupos solo es editable en borrador.
          </p>
        </form>
      </div>
    </div>
  );
}
