import { useState, useEffect } from "react";
import axios from "axios";
import { Trans, useTranslation } from "react-i18next";
import ModalPortal from "../../../components/shared/ModalPortal";
import { API } from "../../../api/endpoints";
import styles from "../TorneoDetail.module.css";

export default function PhaseTransitionModal({
  torneoId,
  onClose,
  onGenerated,
}) {
  const { t } = useTranslation("torneos");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");
  const [overrideTableSize, setOverride] = useState(null);

  useEffect(() => {
    axios
      .get(API.torneos.NEXT_PHASE_PREVIEW(torneoId))
      .then(({ data }) => setPreview(data))
      .catch((err) =>
        setError(err.response?.data?.message || t("phase.errorPreview")),
      )
      .finally(() => setLoading(false));
  }, [torneoId, t]);

  const submit = async (tableSize) => {
    setSub(true);
    setError("");
    try {
      await axios.post(
        API.torneos.NEXT_PHASE(torneoId),
        tableSize ? { tableSize } : {},
      );
      onGenerated();
    } catch (err) {
      setError(err.response?.data?.message || t("phase.errorGenerate"));
    } finally {
      setSub(false);
    }
  };

  if (loading) return null;

  return (
    <ModalPortal>
      <div className={styles.modalBackdrop} onClick={onClose}>
        <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>{t("phase.title")}</h3>
            <button
              className={styles.modalClose}
              onClick={onClose}
              aria-label={t("phase.close")}
            >
              ✕
            </button>
          </div>

          {preview && (
            <div className={styles.phasePreview}>
              <div className={styles.phasePreviewRow}>
                <span className={styles.phasePreviewLabel}>
                  {t("phase.advancers")}
                </span>
                <span className={styles.phasePreviewValue}>
                  {preview.advancersCount}
                </span>
              </div>
              <div className={styles.phasePreviewRow}>
                <span className={styles.phasePreviewLabel}>
                  {t("phase.configuredTableSize")}
                </span>
                <span className={styles.phasePreviewValue}>
                  {preview.defaultTableSize}
                </span>
              </div>

              {preview.valid ? (
                preview.isFinal ? (
                  <p className={styles.phasePreviewNote}>
                    <Trans
                      t={t}
                      i18nKey="phase.finalNote"
                      components={[<strong key="0" />]}
                      values={{ count: preview.finalTableSize }}
                    />
                  </p>
                ) : (
                  <p className={styles.phasePreviewNote}>
                    <Trans
                      t={t}
                      i18nKey="phase.generateNote"
                      components={[<strong key="0" />]}
                      values={{
                        tables: preview.tables,
                        size: preview.finalTableSize,
                      }}
                    />
                  </p>
                )
              ) : (
                <>
                  <p className={styles.phasePreviewWarning}>
                    {t("phase.chooseLayout", {
                      warnings: preview.warnings?.join(" ") || "",
                    })}
                  </p>
                  <div className={styles.phaseSuggestions}>
                    {(preview.suggestions || []).map((s, idx) => (
                      <button
                        key={idx}
                        className={`${styles.phaseSuggestion} ${overrideTableSize === s.overrideTableSize ? styles.phaseSuggestionActive : ""}`}
                        onClick={() => setOverride(s.overrideTableSize)}
                        disabled={submitting}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.modalActions}>
            <button
              className={styles.btnGhost}
              onClick={onClose}
              disabled={submitting}
            >
              {t("phase.cancel")}
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => submit(preview?.valid ? null : overrideTableSize)}
              disabled={submitting || (!preview?.valid && !overrideTableSize)}
            >
              {submitting ? t("phase.generating") : t("phase.generate")}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
