import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import styles from "./ListFilters.module.css";

function FilterIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export default function ListFilters({
  chips = [],
  activeChip,
  onChipChange,
  // Valor "base" del chip — usado para el badge de filtros activos.
  // Si el chip actual coincide con defaultChip, no cuenta como activo.
  defaultChip,
  isAdmin = false,
  isAuthenticated = false,
  showDistance = false,
  radiusKm = 0,
  onRadiusChange,
  hasDireccion = false,
  maxRadiusKm = 100,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);

  const visibleChips = chips.filter(
    (c) => (!c.adminOnly || isAdmin) && (!c.requiresAuth || isAuthenticated),
  );

  const chipActive = defaultChip != null && activeChip !== defaultChip;
  const distActive = showDistance && hasDireccion && radiusKm > 0;
  const activeCount = (chipActive ? 1 : 0) + (distActive ? 1 : 0);

  // Cierre por click-outside + Escape. Restauramos foco al trigger al cerrar
  // con teclado para mantener la navegación predecible.
  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const setRadius = (next) => {
    const clamped = Math.max(0, Math.min(maxRadiusKm, next));
    onRadiusChange?.(clamped);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${
          activeCount > 0 ? styles.triggerActive : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FilterIcon />
        <span>{t("shared:listFilters.filters")}</span>
        {activeCount > 0 && (
          <span
            className={styles.badge}
            aria-label={t("shared:listFilters.activeCount", {
              count: activeCount,
            })}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={styles.popover}
          role="dialog"
          aria-label={t("shared:listFilters.popoverAria")}
        >
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {t("shared:listFilters.statusTitle")}
            </div>
            <div
              className={styles.chips}
              role="group"
              aria-label={t("shared:listFilters.filterListAria")}
            >
              {visibleChips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`${styles.chip} ${
                    activeChip === c.value ? styles.chipActive : ""
                  }`}
                  onClick={() => onChipChange?.(c.value)}
                  aria-pressed={activeChip === c.value}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {showDistance && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                {t("shared:listFilters.distanceTitle")}
              </div>
              <div className={styles.radiusLabel}>
                <span className={styles.radiusIcon} aria-hidden="true">
                  📍
                </span>
                <span>
                  {hasDireccion ? (
                    radiusKm > 0 ? (
                      <Trans
                        i18nKey="shared:listFilters.resultsWithin"
                        values={{ radius: radiusKm }}
                        components={[<span key="0" />, <strong key="1" />]}
                      />
                    ) : (
                      <Trans
                        i18nKey="shared:listFilters.filterByDistance"
                        components={[<span key="0" />, <strong key="1" />]}
                      />
                    )
                  ) : (
                    <Trans
                      i18nKey="shared:listFilters.addAddress"
                      components={[
                        <span key="0" />,
                        <Link
                          key="1"
                          to="/perfil"
                          className={styles.radiusInlineLink}
                        />,
                      ]}
                    />
                  )}
                </span>
              </div>
              <div className={styles.radiusControls}>
                <button
                  type="button"
                  className={styles.radiusStep}
                  onClick={() => setRadius(radiusKm - 1)}
                  disabled={!hasDireccion || radiusKm <= 0}
                  aria-label={t("shared:listFilters.decreaseRadius")}
                  title="−1 km"
                >
                  −
                </button>
                <input
                  type="range"
                  min="0"
                  max={maxRadiusKm}
                  step="1"
                  value={radiusKm}
                  onChange={(e) => onRadiusChange?.(Number(e.target.value))}
                  className={styles.radiusSlider}
                  disabled={!hasDireccion}
                  aria-label={t("shared:listFilters.radiusAria")}
                  title={
                    hasDireccion
                      ? t("shared:listFilters.radiusTitle", {
                          value: radiusKm || t("shared:listFilters.noLimit"),
                        })
                      : t("shared:listFilters.radiusTitleDisabled")
                  }
                />
                <button
                  type="button"
                  className={styles.radiusStep}
                  onClick={() => setRadius(radiusKm + 1)}
                  disabled={!hasDireccion || radiusKm >= maxRadiusKm}
                  aria-label={t("shared:listFilters.increaseRadius")}
                  title="+1 km"
                >
                  +
                </button>
                <span className={styles.radiusValue}>
                  {radiusKm > 0
                    ? `${radiusKm} km`
                    : t("shared:listFilters.noLimit")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
