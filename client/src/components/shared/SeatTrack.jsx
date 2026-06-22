import { useTranslation } from "react-i18next";
import styles from "./SeatTrack.module.css";

// Barra de progreso de lugares ocupados. La cantidad de divisores verticales
// (uno por silla) hace que se lea como "asientos numerados" en vez de un
// progress bar continuo. Cuando `full=true`, el fill cambia a rojo.
//
// Props:
//   filled   number — cuántos asientos están ocupados (incluye host).
//   total    number — total de asientos.
//   variant  'sm' | 'md'  — alto del track. Default sm (6px).
//   full     boolean — fuerza estilo "completo" (se calcula de filled>=total
//            si no se pasa explícito).
export default function SeatTrack({
  filled,
  total,
  variant = "sm",
  full,
  className = "",
}) {
  const { t } = useTranslation();
  const safeTotal = Math.max(1, Number(total) || 0);
  const safeFilled = Math.min(safeTotal, Math.max(0, Number(filled) || 0));
  const pct = (safeFilled / safeTotal) * 100;
  const isFull = full ?? safeFilled >= safeTotal;
  return (
    <div
      className={`${styles.track} ${styles[`track_${variant}`] || ""} ${className}`.trim()}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeFilled}
      aria-label={t("shared:seatTrack.label", {
        filled: safeFilled,
        total: safeTotal,
      })}
    >
      <span
        className={`${styles.fill} ${isFull ? styles.fill_full : ""}`}
        style={{ width: `${pct}%` }}
      />
      {Array.from({ length: safeTotal - 1 }).map((_, i) => (
        <span
          key={i}
          className={styles.divider}
          style={{ left: `${((i + 1) / safeTotal) * 100}%` }}
        />
      ))}
    </div>
  );
}
