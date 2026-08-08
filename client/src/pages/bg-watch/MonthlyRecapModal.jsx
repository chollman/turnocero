import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/shared/Modal";
import DateTimePicker from "../../components/shared/DateTimePicker";
import EmptyState from "../../components/shared/EmptyState";
import { useBrandName } from "../../hooks/useBrandName";
import { getLocale } from "../../utils/locale";
import { usePartidasDelMesQuery } from "../../queries/bgWatch";
import {
  monthRange,
  previousMonthRange,
  formatRangeLabel,
  renderMonthlyRecapMosaic,
} from "./monthlyRecapMosaic";
import styles from "./MonthlyRecapModal.module.css";

const RANGE_MODES = ["thisMonth", "prevMonth", "custom"];

function rangeForMode(mode, customFrom, customTo) {
  if (mode === "thisMonth") return monthRange();
  if (mode === "prevMonth") return previousMonthRange();
  return { mindate: customFrom || null, maxdate: customTo || null };
}

export default function MonthlyRecapModal({ isOpen, onClose, bggUsername }) {
  const { t } = useTranslation("bgwatch");
  const brandName = useBrandName();
  const [mode, setMode] = useState("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [requested, setRequested] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isOpen) return;
    setMode("thisMonth");
    setCustomFrom("");
    setCustomTo("");
    setRequested(false);
    setRenderError(null);
  }, [isOpen]);

  const range = useMemo(
    () => rangeForMode(mode, customFrom, customTo),
    [mode, customFrom, customTo],
  );
  const rangeInvalid =
    !!range.mindate && !!range.maxdate && range.mindate > range.maxdate;
  const canGenerate = !!range.mindate && !!range.maxdate && !rangeInvalid;

  const {
    data,
    isPending,
    isFetching,
    isError,
    error,
  } = usePartidasDelMesQuery(bggUsername, range, {
    enabled: isOpen && requested && canGenerate,
  });
  const loading = requested && (isPending || isFetching);
  const loadError = isError
    ? error?.response?.data?.message || t("monthlyRecap.loadError")
    : null;

  const handleModeChange = (next) => {
    if (next === mode) return;
    setMode(next);
    setRequested(false);
  };
  const handleCustomChange = (field, value) => {
    if (field === "from") setCustomFrom(value);
    else setCustomTo(value);
    setRequested(false);
  };
  const handleGenerate = () => {
    if (!canGenerate) return;
    setRequested(true);
  };

  useEffect(() => {
    if (!data || !canvasRef.current || data.games.length === 0) return undefined;
    let cancelled = false;
    setRendering(true);
    setRenderError(null);
    renderMonthlyRecapMosaic(canvasRef.current, {
      games: data.games,
      stats: data.stats,
      rangeLabel: formatRangeLabel(data.range.mindate, data.range.maxdate, getLocale()),
      bggUsername,
      brandName,
      t,
    })
      .catch(() => {
        if (!cancelled) setRenderError(t("monthlyRecap.loadError"));
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, bggUsername, brandName]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `partidas-del-mes-${bggUsername}-${data.range.mindate}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const today = useMemo(() => new Date(), []);
  const showEmpty = requested && data && data.games.length === 0;
  const showCanvas = requested && data && data.games.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t("monthlyRecap.modalAria")}
      backdropClassName={styles.backdrop}
      className={styles.modal}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>{t("monthlyRecap.title")}</h2>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={t("monthlyRecap.close")}
        >
          ×
        </button>
      </div>

      <p className={styles.subtitle}>{t("monthlyRecap.subtitle")}</p>

      <div className={styles.rangeChips} role="group">
        {RANGE_MODES.map((id) => (
          <button
            key={id}
            type="button"
            className={`${styles.chip} ${mode === id ? styles.chipActive : ""}`}
            onClick={() => handleModeChange(id)}
          >
            {t(`monthlyRecap.range${id.charAt(0).toUpperCase()}${id.slice(1)}`)}
          </button>
        ))}
      </div>

      {mode === "custom" && (
        <div className={styles.customRange}>
          <label className={styles.dateField}>
            <span className={styles.dateLabel}>{t("monthlyRecap.fromLabel")}</span>
            <DateTimePicker
              value={customFrom}
              onChange={(v) => handleCustomChange("from", v)}
              dateOnly
              allowPast
              maxDate={today}
            />
          </label>
          <label className={styles.dateField}>
            <span className={styles.dateLabel}>{t("monthlyRecap.toLabel")}</span>
            <DateTimePicker
              value={customTo}
              onChange={(v) => handleCustomChange("to", v)}
              dateOnly
              allowPast
              maxDate={today}
            />
          </label>
        </div>
      )}
      {rangeInvalid && <p className={styles.errorMsg}>{t("monthlyRecap.rangeInvalid")}</p>}

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
        >
          {loading
            ? t("monthlyRecap.generating")
            : requested
              ? t("monthlyRecap.regenerate")
              : t("monthlyRecap.generate")}
        </button>
        {showCanvas && (
          <button
            type="button"
            className={styles.btnGhost}
            onClick={handleDownload}
            disabled={rendering}
          >
            {t("monthlyRecap.download")}
          </button>
        )}
      </div>

      {loadError && <p className={styles.errorMsg}>{loadError}</p>}
      {renderError && <p className={styles.errorMsg}>{renderError}</p>}

      {showEmpty && (
        <EmptyState
          variant="filtered"
          title={t("monthlyRecap.emptyTitle")}
          text={t("monthlyRecap.emptyText")}
          compact
        />
      )}

      <div
        className={styles.previewWrap}
        style={{ display: showCanvas ? "block" : "none" }}
      >
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          role="img"
          aria-label={t("monthlyRecap.previewAria")}
        />
      </div>
    </Modal>
  );
}
