import Meeple from "../../components/shared/Meeple";
import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import { useBrandName } from "../../hooks/useBrandName";
import { API } from "../../api/endpoints";
import useLocalStorageState from "../../utils/useLocalStorageState";
import useTickingNow from "../../utils/useTickingNow";
import {
  monthLabel,
  addMonths,
  monthRange,
  groupByDay,
  dayKey,
} from "../../utils/calendar";
import { dateParts } from "../../utils/eventoDate";
import MonthGrid from "./MonthGrid";
import AgendaList from "./AgendaList";
import CalendarItemRow from "./CalendarItemRow";
import { TIPO_META, TIPO_ORDER } from "./tipos";
import styles from "./Calendario.module.css";

const ChevronLeft = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRight = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export default function Calendario() {
  const { user } = useAuth();
  const { isSectionEnabled } = useSiteConfig();
  const { addToast } = useNotifications();
  const brandName = useBrandName();
  const now = useTickingNow();

  // Solo ofrecemos tipos cuyas secciones estén habilitadas (admins las ven
  // todas porque isSectionEnabled devuelve true para ellos).
  const availableTipos = useMemo(
    () => TIPO_ORDER.filter((t) => isSectionEnabled(TIPO_META[t].section)),
    [isSectionEnabled],
  );

  const [view, setView] = useLocalStorageState(
    "turnocero_calendario_view",
    "mes",
  );
  const [scope, setScope] = useLocalStorageState(
    "turnocero_calendario_scope",
    "todas",
  );
  // Filtro de tipos (array). Vacío = todos los disponibles.
  const [tipoFilter, setTipoFilter] = useState([]);

  const nowDate = new Date(now);
  const [cursor, setCursor] = useState({
    year: nowDate.getFullYear(),
    month: nowDate.getMonth(),
  });
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Scope efectivo: invitados siempre "todas" (no tienen calendario propio).
  const effectiveScope = user ? scope : "todas";

  // Tipos efectivos a pedir: la intersección del filtro del usuario con los
  // disponibles; si queda vacío, pedimos todos los disponibles.
  const selectedTipos = useMemo(() => {
    const picked = tipoFilter.filter((t) => availableTipos.includes(t));
    return picked.length ? picked : availableTipos;
  }, [tipoFilter, availableTipos]);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      try {
        let from;
        let to;
        if (view === "mes") {
          ({ from, to } = monthRange(cursor.year, cursor.month));
        } else {
          // Agenda: desde hoy hasta el fin del 3er mes siguiente.
          const today = new Date();
          from = today;
          const end = addMonths(today.getFullYear(), today.getMonth(), 3);
          to = monthRange(end.year, end.month).to;
        }
        const params = {
          from: from.toISOString(),
          to: to.toISOString(),
          scope: effectiveScope,
          tipos: selectedTipos.join(","),
        };
        const { data } = await axios.get(API.calendario.LIST, {
          params,
          signal,
        });
        setItems(data.items || []);
      } catch (err) {
        if (axios.isCancel(err)) return;
        addToast({
          type: "error",
          title: "No pudimos cargar el calendario",
          message: "Reintentá en unos segundos.",
        });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [view, cursor, effectiveScope, selectedTipos, addToast],
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const itemsByDay = useMemo(() => groupByDay(items), [items]);

  // Día seleccionado efectivo: el clickeado, o por default hoy (si está en el
  // mes visible), o el primer día con items, o el día 1.
  const effectiveDayKey = useMemo(() => {
    if (selectedDayKey) return selectedDayKey;
    const todayKey = dayKey(new Date(now));
    const todayInMonth =
      new Date(now).getFullYear() === cursor.year &&
      new Date(now).getMonth() === cursor.month;
    if (todayInMonth) return todayKey;
    const firstWithItems = items.find((it) => {
      const p = dateParts(it.date);
      return p && p.year === cursor.year;
    });
    if (firstWithItems) return dayKey(firstWithItems.date);
    return dayKey(new Date(cursor.year, cursor.month, 1));
  }, [selectedDayKey, now, cursor, items]);

  const dayItems = itemsByDay.get(effectiveDayKey) || [];

  function goMonth(delta) {
    setCursor((c) => addMonths(c.year, c.month, delta));
    setSelectedDayKey(null);
  }
  function goToday() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedDayKey(dayKey(d));
  }

  function toggleTipo(t) {
    setTipoFilter((prev) => {
      const base = prev.length ? prev : availableTipos;
      const next = base.includes(t)
        ? base.filter((x) => x !== t)
        : [...base, t];
      // No permitir dejar 0 tipos: si quedaría vacío, lo reseteamos a todos.
      return next.length ? next : [];
    });
  }

  const dayPanelLabel = useMemo(() => {
    const p = dateParts(`${effectiveDayKey}T00:00:00`);
    if (!p) return "";
    return `${p.weekdayLong} ${p.day} de ${p.monthLong}`;
  }, [effectiveDayKey]);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{`Calendario — ${brandName}`}</title>
        <meta
          name="description"
          content="Mesas, eventos y torneos de la comunidad en un solo calendario"
        />
      </Helmet>

      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow}>
            <Meeple /> Agenda unificada
          </div>
          <h1 className={styles.heroTitle}>
            Qué se <em>viene</em>.
          </h1>
          <p className={styles.heroSub}>
            Mesas, eventos y torneos de la comunidad, todos en un solo lugar.
          </p>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatLabel}>Actividades</span>
            <span
              className={`${styles.heroStatValue} ${styles.heroStatValueAccent}`}
            >
              {items.length}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <div
            className={styles.viewToggle}
            role="group"
            aria-label="Cambiar vista"
          >
            <button
              type="button"
              className={`${styles.toggleBtn} ${view === "mes" ? styles.toggleBtnActive : ""}`}
              onClick={() => setView("mes")}
              aria-pressed={view === "mes"}
            >
              Mes
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${view === "agenda" ? styles.toggleBtnActive : ""}`}
              onClick={() => setView("agenda")}
              aria-pressed={view === "agenda"}
            >
              Agenda
            </button>
          </div>

          {user && (
            <div
              className={styles.viewToggle}
              role="group"
              aria-label="Alcance"
            >
              <button
                type="button"
                className={`${styles.toggleBtn} ${scope === "todas" ? styles.toggleBtnActive : ""}`}
                onClick={() => setScope("todas")}
                aria-pressed={scope === "todas"}
              >
                Comunidad
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${scope === "mias" ? styles.toggleBtnActive : ""}`}
                onClick={() => setScope("mias")}
                aria-pressed={scope === "mias"}
              >
                Mías
              </button>
            </div>
          )}
        </div>

        <div
          className={styles.chips}
          role="group"
          aria-label="Filtrar por tipo"
        >
          {availableTipos.map((t) => {
            const active = selectedTipos.includes(t);
            return (
              <button
                key={t}
                type="button"
                className={`${styles.chipFilter} ${styles[TIPO_META[t].cls]} ${active ? styles.chipFilterActive : ""}`}
                onClick={() => toggleTipo(t)}
                aria-pressed={active}
              >
                <span className={styles.chipDot} />
                {TIPO_META[t].label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "mes" && (
        <div className={styles.monthNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => goMonth(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft />
          </button>
          <span className={styles.monthNavLabel}>
            {monthLabel(cursor.year, cursor.month)}
          </span>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => goMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight />
          </button>
          <button type="button" className={styles.todayBtn} onClick={goToday}>
            Hoy
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonWrap} aria-hidden="true">
          {view === "mes" ? (
            <div className={styles.skelGrid}>
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className={styles.skelCell} />
              ))}
            </div>
          ) : (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={styles.skelRow} />
            ))
          )}
        </div>
      ) : availableTipos.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyDot}>
            <Meeple />
          </span>
          <p className={styles.emptyText}>
            No hay secciones habilitadas para mostrar en el calendario.
          </p>
        </div>
      ) : view === "mes" ? (
        <div className={styles.monthLayout}>
          <MonthGrid
            year={cursor.year}
            month={cursor.month}
            itemsByDay={itemsByDay}
            selectedKey={effectiveDayKey}
            onSelectDay={setSelectedDayKey}
          />
          <aside className={styles.dayPanel} aria-label="Actividades del día">
            <h2 className={styles.dayPanelTitle}>{dayPanelLabel}</h2>
            {dayItems.length === 0 ? (
              <p className={styles.dayPanelEmpty}>Sin actividades este día.</p>
            ) : (
              <div className={styles.dayPanelRows}>
                {dayItems.map((it) => (
                  <CalendarItemRow
                    key={`${it.tipo}-${it.id}`}
                    item={it}
                    now={now}
                  />
                ))}
              </div>
            )}
          </aside>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyDot}>
            <Meeple />
          </span>
          <p className={styles.emptyText}>
            {effectiveScope === "mias"
              ? "No tenés actividades próximas."
              : "No hay actividades próximas para esos filtros."}
          </p>
        </div>
      ) : (
        <AgendaList items={items} now={now} />
      )}
    </div>
  );
}
