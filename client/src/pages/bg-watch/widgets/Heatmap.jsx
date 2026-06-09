import { useMemo } from "react";
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

// Calendario de actividad estilo "contribuciones": una grilla de `weeks`
// columnas × 7 días que termina hoy. `heatmap` = [{ date 'YYYY-MM-DD', count }]
// (la agregación del servidor, ventana ~13 semanas). Días sin partidas quedan
// en nivel 0. Cada celda lleva `data-level` para test/estilo.
export default function Heatmap({ heatmap, weeks = 13 }) {
  const cells = useMemo(() => {
    const byDate = new Map((heatmap || []).map((d) => [d.date, d.count]));
    const total = weeks * 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // start = (total - 1) días atrás, así la última celda es hoy.
    const start = new Date(today);
    start.setDate(start.getDate() - (total - 1));
    const out = [];
    for (let i = 0; i < total; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toIso(d);
      const count = byDate.get(iso) || 0;
      out.push({ iso, count, level: levelFor(count) });
    }
    return out;
  }, [heatmap, weeks]);

  return (
    <div className={styles.sideWidget}>
      <div className={styles.sideWidgetLabel}>
        ◆ Calendario · últimas {weeks} semanas
      </div>
      <div
        className={styles.heatmap}
        style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}
        role="img"
        aria-label={`Actividad de las últimas ${weeks} semanas`}
      >
        {cells.map((c) => (
          <div
            key={c.iso}
            className={`${styles.heatmapCell} ${c.level ? styles[`l${c.level}`] : ""}`}
            data-level={c.level}
            title={`${c.iso}: ${c.count} ${c.count === 1 ? "partida" : "partidas"}`}
          />
        ))}
      </div>
      <div className={styles.heatmapLegend}>
        <span>Menos</span>
        <div className={styles.heatmapScale}>
          <div className={styles.heatmapCell} data-level={0} />
          <div className={`${styles.heatmapCell} ${styles.l1}`} data-level={1} />
          <div className={`${styles.heatmapCell} ${styles.l2}`} data-level={2} />
          <div className={`${styles.heatmapCell} ${styles.l3}`} data-level={3} />
          <div className={`${styles.heatmapCell} ${styles.l4}`} data-level={4} />
        </div>
        <span>Más</span>
      </div>
    </div>
  );
}
