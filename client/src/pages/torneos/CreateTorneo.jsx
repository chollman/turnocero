import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import { fromLocalInputValue } from "../../utils/eventoDate";
import DateTimePicker from "../../components/shared/DateTimePicker";
import BackButton from "../../components/shared/BackButton";
import ImageDropzone from "./components/ImageDropzone";
import styles from "./Torneos.module.css";

export default function CreateTorneo() {
  const navigate = useNavigate();
  const brandName = useBrandName();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [game, setGame] = useState("");
  const [format, setFormat] = useState("league");
  const [inscriptionMode, setInscMode] = useState("open");
  const [maxParticipants, setMax] = useState("");
  const [fecha, setFecha] = useState("");
  const [tableSize, setTableSize] = useState(4);
  const [gamesPerGroup, setGamesPerGroup] = useState(3);
  const [qualifiersPerGroup, setQualif] = useState(2);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");

  const handleFile = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !game.trim() || !format) {
      setError("Completá título, juego y formato");
      return;
    }
    setSub(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("game", game.trim());
      fd.append("format", format);
      fd.append("inscriptionMode", inscriptionMode);
      if (maxParticipants) fd.append("maxParticipants", maxParticipants);
      if (fecha) fd.append("fecha", fromLocalInputValue(fecha));
      if (format === "groups") {
        fd.append("tableSize", String(tableSize));
        fd.append("gamesPerGroup", String(gamesPerGroup));
        fd.append("qualifiersPerGroup", String(qualifiersPerGroup));
      }
      if (file) fd.append("image", file);
      const { data } = await axios.post(API.torneos.LIST, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/torneos/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Error al crear el torneo");
    } finally {
      setSub(false);
    }
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`Nuevo torneo – ${brandName}`}</title>
      </Helmet>
      <div className={styles.inner}>
        <div className={styles.formHeader}>
          <BackButton to="/torneos" flush>
            Volver a torneos
          </BackButton>
          <h1 className={styles.title}>Crear torneo</h1>
          <p className={styles.sub}>
            Configurá los datos básicos. Vas a poder abrir inscripciones y armar
            el fixture desde la página del torneo.
          </p>
        </div>

        <form className={styles.formCard} onSubmit={handleSubmit}>
          <ImageDropzone preview={preview} onFile={handleFile} />

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Título *</span>
            <input
              className={styles.fieldInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Ej: Liga de Catán otoño 2026"
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
              placeholder="Ej: Catán"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Descripción</span>
            <textarea
              className={styles.fieldTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Reglas, premios, formato detallado…"
            />
          </label>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Formato *</span>
              <div className={styles.formatOptions}>
                <button
                  type="button"
                  className={`${styles.formatOption} ${format === "league" ? styles.formatOptionActive : ""}`}
                  onClick={() => setFormat("league")}
                >
                  <span className={styles.formatIcon}>🔁</span>
                  <span className={styles.formatName}>Liga</span>
                  <span className={styles.formatHint}>
                    1vs1 todos contra todos · 3/1/0
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.formatOption} ${format === "single_elim" ? styles.formatOptionActive : ""}`}
                  onClick={() => setFormat("single_elim")}
                >
                  <span className={styles.formatIcon}>🏆</span>
                  <span className={styles.formatName}>Eliminación simple</span>
                  <span className={styles.formatHint}>
                    Bracket 1vs1 con byes
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.formatOption} ${format === "groups" ? styles.formatOptionActive : ""}`}
                  onClick={() => setFormat("groups")}
                >
                  <span className={styles.formatIcon}>🧩</span>
                  <span className={styles.formatName}>Grupos</span>
                  <span className={styles.formatHint}>
                    Mesas multijugador · multi-fase · cut por puntaje
                  </span>
                </button>
              </div>
            </label>
          </div>

          {format === "groups" && (
            <div className={styles.groupsConfig}>
              <h3 className={styles.groupsConfigTitle}>
                Configuración del formato Grupos
              </h3>
              <div className={styles.groupsConfigGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    Jugadores por mesa (X)
                  </span>
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
                  <span className={styles.fieldLabel}>
                    Partidas por grupo (P)
                  </span>
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
                    Clasificados por grupo (C)
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
              <p className={styles.groupsConfigHint}>
                Al iniciar el torneo se generan ⌈N/X⌉ grupos. Después de las P
                partidas, los C mejores de cada grupo pasan a la siguiente fase.
              </p>
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Modo de inscripción *</span>
            <div className={styles.formatOptions}>
              <button
                type="button"
                className={`${styles.formatOption} ${inscriptionMode === "open" ? styles.formatOptionActive : ""}`}
                onClick={() => setInscMode("open")}
              >
                <span className={styles.formatIcon}>📝</span>
                <span className={styles.formatName}>Inscripción abierta</span>
                <span className={styles.formatHint}>
                  Los usuarios se anotan y vos aprobás
                </span>
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
                <span className={styles.formatHint}>
                  Vos elegís a quién agregar de la comunidad
                </span>
              </button>
            </div>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Cupo máximo (opcional)</span>
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

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.formActions}>
            <Link to="/torneos" className={styles.btnGhost}>
              Cancelar
            </Link>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={submitting}
            >
              {submitting ? "Creando…" : "Crear torneo"}
            </button>
          </div>
          <p className={styles.formHint}>
            Se crea como <strong>Borrador</strong>. Después podés abrir
            inscripciones desde la página del torneo.
          </p>
        </form>
      </div>
    </div>
  );
}
