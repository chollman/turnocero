import { useMemo } from "react";
import { buildMonthMatrix, WEEKDAY_INITIALS } from "../../utils/calendar";
import { TIPO_META } from "./tipos";
import styles from "./Calendario.module.css";

const MAX_CHIPS = 3;

// Grilla mensual lunes-primero. Cada celda muestra hasta 3 chips de items
// (coloreados por tipo) + "+N". Click en un día → onSelectDay(key).
export default function MonthGrid({
  year,
  month,
  itemsByDay,
  selectedKey,
  onSelectDay,
}) {
  const matrix = useMemo(() => buildMonthMatrix(year, month), [year, month]);

  return (
    <div className={styles.grid} role="grid" aria-label="Grilla del mes">
      <div className={styles.gridHead} role="row">
        {WEEKDAY_INITIALS.map((d, i) => (
          <span key={i} className={styles.gridHeadCell} role="columnheader">
            {d}
          </span>
        ))}
      </div>
      <div className={styles.gridBody}>
        {matrix.map((week, wi) => (
          <div key={wi} className={styles.gridWeek} role="row">
            {week.map((cell) => {
              const dayItems = itemsByDay.get(cell.key) || [];
              const isSelected = cell.key === selectedKey;
              const cls = [
                styles.cell,
                cell.inMonth ? "" : styles.cellOutMonth,
                cell.isToday ? styles.cellToday : "",
                isSelected ? styles.cellSelected : "",
                dayItems.length ? styles.cellHasItems : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  type="button"
                  key={cell.key}
                  className={cls}
                  role="gridcell"
                  aria-label={`${cell.date.getDate()} — ${dayItems.length} actividad${dayItems.length === 1 ? "" : "es"}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectDay(cell.key)}
                >
                  <span className={styles.cellNum}>{cell.date.getDate()}</span>
                  <span className={styles.cellChips}>
                    {dayItems.slice(0, MAX_CHIPS).map((it) => (
                      <span
                        key={it.id}
                        className={`${styles.chip} ${styles[TIPO_META[it.tipo].cls]}`}
                        title={it.title}
                      >
                        {it.title}
                      </span>
                    ))}
                    {dayItems.length > MAX_CHIPS && (
                      <span className={styles.chipMore}>
                        +{dayItems.length - MAX_CHIPS}
                      </span>
                    )}
                  </span>
                  {dayItems.length > 0 && (
                    <span className={styles.cellDots} aria-hidden="true">
                      {dayItems.slice(0, MAX_CHIPS).map((it) => (
                        <span
                          key={it.id}
                          className={`${styles.dot} ${styles[TIPO_META[it.tipo].cls]}`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
