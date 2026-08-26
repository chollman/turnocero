import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from "../BgWatchProfile.module.css";

// Buckets a daily play-count into one of 5 visual levels (0 = sin actividad).
// Umbrales fijos (no relativos al máximo) para que el color sea estable y
// comparable entre perfiles.
function levelFor(count) {
  if (!count) return 0;
  if (count >= 6) return 4;
  if (count >= 4) return 3;
  if (count >= 2) return 2;
  return 1;
}

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Calendario de actividad estilo "contribuciones": una grilla de `weeks`
// columnas × 7 filas (domingo arriba, sábado abajo — siempre en ese orden,
// sin importar en qué día de la semana caiga "hoy"). `heatmap` = [{ date
// 'YYYY-MM-DD', count }] (la agregación del servidor, ventana ~13 semanas).
// La ventana se extiende hasta el sábado de la semana en curso para que las
// columnas queden alineadas a semanas completas; los días posteriores a hoy
// se muestran vacíos (sin datos, no "sin actividad"). Cada celda lleva
// `data-level` para test/estilo.
export default function Heatmap({ heatmap, weeks = 13 }) {
  const { t } = useTranslation("bgwatch");

  const cells = useMemo(() => {
    const byDate = new Map((heatmap || []).map((d) => [d.date, d.count]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toIso(today);
    const todayDow = today.getDay(); // 0 = domingo … 6 = sábado
    const alignedEnd = new Date(today);
    alignedEnd.setDate(alignedEnd.getDate() + (6 - todayDow));
    const total = weeks * 7;
    const start = new Date(alignedEnd);
    start.setDate(start.getDate() - (total - 1));

    const out = [];
    for (let col = 0; col < weeks; col += 1) {
      for (let row = 0; row < 7; row += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + col * 7 + row);
        const iso = toIso(d);
        const isFuture = d > today;
        const count = isFuture ? 0 : byDate.get(iso) || 0;
        out.push({
          iso,
          count,
          level: isFuture ? 0 : levelFor(count),
          row,
          col,
          isFuture,
          isToday: iso === todayIso,
        });
      }
    }
    return out;
  }, [heatmap, weeks]);

  return (
    <div className={styles.sideWidget}>
      <div className={styles.sideWidgetLabel}>
        ◆ {t("heatmap.label", { weeks })}
      </div>
      <div className={styles.heatmapRow}>
        <div className={styles.weekdayLabels} aria-hidden="true">
          {WEEKDAY_KEYS.map((key) => (
            <span
              key={key}
              className={styles.weekdayLabel}
              title={t(`heatmap.weekdaysFull.${key}`)}
            >
              {t(`heatmap.weekdays.${key}`)}
            </span>
          ))}
        </div>
        <div
          className={styles.heatmap}
          style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}
          role="img"
          aria-label={t("heatmap.ariaLabel", { weeks })}
        >
          {cells.map((c) => (
            <div
              key={c.iso}
              className={[
                styles.heatmapCell,
                c.level ? styles[`l${c.level}`] : "",
                c.isFuture ? styles.futureCell : "",
                c.isToday ? styles.today : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ gridColumn: c.col + 1, gridRow: c.row + 1 }}
              data-level={c.level}
              data-today={c.isToday || undefined}
              title={
                c.isFuture
                  ? undefined
                  : [
                      t("heatmap.cellTitle", { date: c.iso, count: c.count }),
                      c.isToday ? t("heatmap.today") : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")
              }
            />
          ))}
        </div>
      </div>
      <div className={styles.heatmapLegend}>
        <span>{t("heatmap.less")}</span>
        <div className={styles.heatmapScale}>
          <div className={styles.heatmapCell} data-level={0} />
          <div className={`${styles.heatmapCell} ${styles.l1}`} data-level={1} />
          <div className={`${styles.heatmapCell} ${styles.l2}`} data-level={2} />
          <div className={`${styles.heatmapCell} ${styles.l3}`} data-level={3} />
          <div className={`${styles.heatmapCell} ${styles.l4}`} data-level={4} />
        </div>
        <span>{t("heatmap.more")}</span>
      </div>
    </div>
  );
}
