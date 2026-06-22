import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      addToast({ type: "error", title: t("mathtrade:form.missingTitle") });
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
            ? t("mathtrade:form.createError")
            : t("mathtrade:form.saveError"),
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
            mode === "create"
              ? t("mathtrade:form.docTitleCreate")
              : t("mathtrade:form.docTitleEdit")
          } – ${brandName}`}
        </title>
      </Helmet>
      <div className={styles.inner}>
        <BackButton to="/math-trade">{t("mathtrade:form.back")}</BackButton>
        <h1 className={styles.title}>
          {mode === "create"
            ? t("mathtrade:form.titleCreate")
            : t("mathtrade:form.titleEdit")}
        </h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="mt-title">
              {t("mathtrade:form.titleLabel")}
            </label>
            <input
              id="mt-title"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t("mathtrade:form.titlePlaceholder")}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="mt-desc">
              {t("mathtrade:form.descriptionLabel")}
            </label>
            <textarea
              id="mt-desc"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder={t("mathtrade:form.descriptionPlaceholder")}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>
              {t("mathtrade:form.deadlineLabel")}
            </span>
            <DateTimePicker value={deadline} onChange={setDeadline} />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>
              {t("mathtrade:form.matchingLabel")}
              <InfoTooltip>{t("mathtrade:form.matchingTooltip")}</InfoTooltip>
            </span>
            <div className={styles.modeRow}>
              <button
                type="button"
                className={`${styles.modeBtn} ${matchMode === "auto" ? styles.modeBtnActive : ""}`}
                onClick={() => setMatchMode("auto")}
              >
                <span className={styles.modeBtnTitle}>
                  {t("mathtrade:form.modeAutoTitle")}
                </span>
                <span className={styles.modeBtnDesc}>
                  {t("mathtrade:form.modeAutoDesc")}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${matchMode === "max" ? styles.modeBtnActive : ""}`}
                onClick={() => setMatchMode("max")}
              >
                <span className={styles.modeBtnTitle}>
                  {t("mathtrade:form.modeMaxTitle")}
                </span>
                <span className={styles.modeBtnDesc}>
                  {t("mathtrade:form.modeMaxDesc")}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${matchMode === "bounded" ? styles.modeBtnActive : ""}`}
                onClick={() => setMatchMode("bounded")}
              >
                <span className={styles.modeBtnTitle}>
                  {t("mathtrade:form.modeBoundedTitle")}
                </span>
                <span className={styles.modeBtnDesc}>
                  {t("mathtrade:form.modeBoundedDesc")}
                </span>
              </button>
            </div>
          </div>

          {matchMode === "bounded" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="mt-chain">
                {t("mathtrade:form.maxPeopleLabel")}
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
                <span className={styles.modeBtnDesc}>
                  {t("mathtrade:form.maxPeopleHint")}
                </span>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>
              {t("mathtrade:form.imageLabel")}
            </span>
            <ImageDropzone preview={preview} onFile={handleFile} />
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submit}
              disabled={submitting}
            >
              {submitting
                ? t("mathtrade:form.submitting")
                : mode === "create"
                  ? t("mathtrade:form.submitCreate")
                  : t("mathtrade:form.submitEdit")}
            </button>
            <Link to="/math-trade" className={styles.cancel}>
              {t("common:actions.cancel")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
