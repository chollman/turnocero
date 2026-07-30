import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Trans, useTranslation } from "react-i18next";
import { useBrandName } from "../../hooks/useBrandName";
import { createTorneo } from "../../queries/torneos";
import { fromLocalInputValue } from "../../utils/eventoDate";
import DateTimePicker from "../../components/shared/DateTimePicker";
import BackButton from "../../components/shared/BackButton";
import ImageDropzone from "./components/ImageDropzone";
import styles from "./Torneos.module.css";

export default function CreateTorneo() {
  const { t } = useTranslation("torneos");
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
      setError(t("form.missingFields"));
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
      const { data } = await createTorneo(fd);
      navigate(`/torneos/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || t("form.createError"));
    } finally {
      setSub(false);
    }
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{t("form.createMetaTitle", { brand: brandName })}</title>
      </Helmet>
      <div className={styles.inner}>
        <div className={styles.formHeader}>
          <BackButton to="/torneos" flush>
            {t("form.back")}
          </BackButton>
          <h1 className={styles.title}>{t("form.createTitle")}</h1>
          <p className={styles.sub}>{t("form.createSub")}</p>
        </div>

        <form className={styles.formCard} onSubmit={handleSubmit}>
          <ImageDropzone preview={preview} onFile={handleFile} />

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("form.fieldTitle")}</span>
            <input
              className={styles.fieldInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t("form.titlePlaceholder")}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("form.fieldGame")}</span>
            <input
              className={styles.fieldInput}
              value={game}
              onChange={(e) => setGame(e.target.value)}
              maxLength={200}
              placeholder={t("form.gamePlaceholder")}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {t("form.fieldDescription")}
            </span>
            <textarea
              className={styles.fieldTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t("form.descriptionPlaceholder")}
            />
          </label>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t("form.fieldFormat")}</span>
              <div className={styles.formatOptions}>
                <button
                  type="button"
                  className={`${styles.formatOption} ${format === "league" ? styles.formatOptionActive : ""}`}
                  onClick={() => setFormat("league")}
                >
                  <span className={styles.formatIcon}>🔁</span>
                  <span className={styles.formatName}>
                    {t("form.formatLeagueName")}
                  </span>
                  <span className={styles.formatHint}>
                    {t("form.formatLeagueHint")}
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.formatOption} ${format === "single_elim" ? styles.formatOptionActive : ""}`}
                  onClick={() => setFormat("single_elim")}
                >
                  <span className={styles.formatIcon}>🏆</span>
                  <span className={styles.formatName}>
                    {t("form.formatSingleElimName")}
                  </span>
                  <span className={styles.formatHint}>
                    {t("form.formatSingleElimHint")}
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.formatOption} ${format === "groups" ? styles.formatOptionActive : ""}`}
                  onClick={() => setFormat("groups")}
                >
                  <span className={styles.formatIcon}>🧩</span>
                  <span className={styles.formatName}>
                    {t("form.formatGroupsName")}
                  </span>
                  <span className={styles.formatHint}>
                    {t("form.formatGroupsHint")}
                  </span>
                </button>
              </div>
            </label>
          </div>

          {format === "groups" && (
            <div className={styles.groupsConfig}>
              <h3 className={styles.groupsConfigTitle}>
                {t("form.groupsConfigTitle")}
              </h3>
              <div className={styles.groupsConfigGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    {t("form.playersPerTableX")}
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
                    {t("form.gamesPerGroupP")}
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
                    {t("form.qualifiersPerGroupC")}
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
                {t("form.groupsConfigHint")}
              </p>
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {t("form.fieldInscriptionMode")}
            </span>
            <div className={styles.formatOptions}>
              <button
                type="button"
                className={`${styles.formatOption} ${inscriptionMode === "open" ? styles.formatOptionActive : ""}`}
                onClick={() => setInscMode("open")}
              >
                <span className={styles.formatIcon}>📝</span>
                <span className={styles.formatName}>
                  {t("form.modeOpenName")}
                </span>
                <span className={styles.formatHint}>
                  {t("form.modeOpenHint")}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.formatOption} ${inscriptionMode === "admin_only" ? styles.formatOptionActive : ""}`}
                onClick={() => setInscMode("admin_only")}
              >
                <span className={styles.formatIcon}>👤</span>
                <span className={styles.formatName}>
                  {t("form.modeAdminName")}
                </span>
                <span className={styles.formatHint}>
                  {t("form.modeAdminHint")}
                </span>
              </button>
            </div>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("form.fieldMax")}</span>
            <input
              className={styles.fieldInput}
              type="number"
              min={2}
              value={maxParticipants}
              onChange={(e) => setMax(e.target.value)}
              placeholder={t("form.maxPlaceholder")}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("form.fieldDate")}</span>
            <DateTimePicker
              id="torneo-fecha"
              name="fecha"
              value={fecha}
              onChange={setFecha}
            />
            <span className={styles.formHint}>{t("form.dateHint")}</span>
          </label>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.formActions}>
            <Link to="/torneos" className={styles.btnGhost}>
              {t("form.cancel")}
            </Link>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={submitting}
            >
              {submitting ? t("form.creating") : t("form.createSubmit")}
            </button>
          </div>
          <p className={styles.formHint}>
            <Trans
              t={t}
              i18nKey="form.createHint"
              components={{ strong: <strong /> }}
            />
          </p>
        </form>
      </div>
    </div>
  );
}
