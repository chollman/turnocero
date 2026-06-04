import { useMemo } from "react";
import { dateParts } from "../../utils/eventoDate";
import CalendarItemRow from "./CalendarItemRow";
import styles from "./Calendario.module.css";

// Agrupa items (con `.date`) por mes, preservando el orden ascendente que
// ya trae el server. Devuelve [{ key, name, year, items }].
function groupItemsByMonth(items) {
  const groups = new Map();
  for (const it of items) {
    const p = dateParts(it.date);
    if (!p) continue;
    if (!groups.has(p.monthKey)) {
      groups.set(p.monthKey, {
        key: p.monthKey,
        name: p.monthLong,
        year: p.year,
        items: [],
      });
    }
    groups.get(p.monthKey).items.push(it);
  }
  return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
}

// Vista agenda: lista cronológica agrupada por mes. `now` lo provee el caller
// (Calendario); si no llega, countdown() aplica su propio fallback — evitamos el
// default impuro `Date.now()` en los params (react-hooks/purity).
export default function AgendaList({ items, now }) {
  const groups = useMemo(() => groupItemsByMonth(items), [items]);

  return (
    <div className={styles.agenda}>
      {groups.map((g) => (
        <section key={g.key} className={styles.agendaMonth}>
          <div className={styles.agendaMonthHead}>
            <span className={styles.agendaMonthLabel}>Mes</span>
            <span className={styles.agendaMonthName}>{g.name}</span>
            <span className={styles.agendaMonthYear}>{g.year}</span>
            <span className={styles.agendaMonthRule} />
            <span className={styles.agendaMonthCount}>
              {g.items.length}{" "}
              {g.items.length === 1 ? "actividad" : "actividades"}
            </span>
          </div>
          <div className={styles.agendaRows}>
            {g.items.map((it) => (
              <CalendarItemRow
                key={`${it.tipo}-${it.id}`}
                item={it}
                now={now}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
