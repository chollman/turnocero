import { useTranslation } from "react-i18next";
import { getLocale } from "../../utils/locale";
import styles from "./UsageTrendChart.module.css";

// 'YYYY-MM-DD' → '17 jun' (mediodía fijo para evitar rollover de timezone).
function shortDay(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "short",
  });
}

function Series({ title, data, pick, unit, barClass, max, showValues }) {
  const { t } = useTranslation();
  return (
    <div className={styles.series}>
      <span className={styles.seriesLabel}>{title}</span>
      <div
        className={styles.bars}
        style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}
      >
        {data.map((d) => {
          const v = d[pick] || 0;
          const pct = max > 0 ? (v / max) * 100 : 0;
          return (
            <div
              key={d.day}
              className={styles.barCell}
              title={t("admin:usageChart.tooltip", {
                day: shortDay(d.day),
                value: v,
                unit,
              })}
            >
              {showValues && <span className={styles.barValue}>{v || ""}</span>}
              <div className={styles.barTrack}>
                <div
                  className={`${styles.bar} ${barClass}`}
                  style={{ height: v > 0 ? `${Math.max(pct, 4)}%` : 0 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Gráfico de tendencia: dos tiras de barras (requests y partidas por día),
// cada serie escalada a su propio máximo para que la forma sea legible aunque
// los órdenes de magnitud difieran. Sin librerías — barras CSS theme-aware.
export default function UsageTrendChart({ data }) {
  const { t } = useTranslation();
  if (!data || data.length === 0) return null;
  const maxReads = Math.max(1, ...data.map((d) => d.reads || 0));
  const maxMut = Math.max(1, ...data.map((d) => d.mutations || 0));
  const showValues = data.length <= 14;

  return (
    <div className={styles.chart}>
      <Series
        title={t("admin:usageChart.requestsTitle")}
        data={data}
        pick="reads"
        unit={t("admin:usageChart.requestsUnit")}
        barClass={styles.barReads}
        max={maxReads}
        showValues={showValues}
      />
      <Series
        title={t("admin:usageChart.playsTitle")}
        data={data}
        pick="mutations"
        unit={t("admin:usageChart.playsUnit")}
        barClass={styles.barMut}
        max={maxMut}
        showValues={showValues}
      />
      <div
        className={styles.axis}
        style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}
      >
        {data.map((d) => (
          <span key={d.day}>{shortDay(d.day)}</span>
        ))}
      </div>
    </div>
  );
}
