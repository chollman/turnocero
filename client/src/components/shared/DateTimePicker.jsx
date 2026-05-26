import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./DateTimePicker.module.css";

// ── Icons ────────────────────────────────────────────────────────────
const CalendarIcon = ({ size = 16 }) => (
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
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ClockIcon = ({ size = 14 }) => (
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
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ChevronLeft = ({ size = 16 }) => (
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
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = ({ size = 16 }) => (
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
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// ── Date helpers ─────────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DDTHH:mm" en hora local — formato datetime-local nativo.
function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseLocalInputValue(str) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isSameDate(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Genera 6 semanas (42 días) que cubren el mes visible — empieza el lunes
// previo o coincide con el 1º si cae en lunes.
function buildCalendarGrid(viewMonth) {
  const first = startOfMonth(viewMonth);
  // Lunes = 0, Domingo = 6 (formato AR).
  const dayOfWeekMondayFirst = (first.getDay() + 6) % 7;
  const startDate = new Date(first);
  startDate.setDate(first.getDate() - dayOfWeekMondayFirst);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    days.push({
      date,
      dayNum: date.getDate(),
      isOtherMonth: date.getMonth() !== viewMonth.getMonth(),
    });
  }
  return days;
}

// Devuelve "Mayo 2026" capitalizado.
function formatMonthYear(d) {
  const s = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Preview trigger format ───────────────────────────────────────────
function formatTrigger(date) {
  const weekday = date
    .toLocaleDateString("es-AR", { weekday: "short" })
    .replace(".", "");
  const day = date.getDate();
  const month = date
    .toLocaleDateString("es-AR", { month: "short" })
    .replace(".", "");
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month.charAt(0).toUpperCase() + month.slice(1)} · ${hh}:${mm}`;
}

// ── Component ────────────────────────────────────────────────────────
/**
 * DateTimePicker custom — sin picker nativo del browser.
 *
 * Click en el trigger abre un popover con:
 *   - Navegación de mes (← Mes Año →)
 *   - Grid 6 × 7 con encabezados de día (L M M J V S D, semana arranca lunes)
 *   - Time selector (dos selects estilizados HH:MM)
 *
 * El popover detecta el espacio disponible bajo el trigger en el viewport;
 * si no entra (estás cerca del bottom de la pantalla), se abre hacia arriba.
 *
 * Props:
 *   value     "YYYY-MM-DDTHH:mm" (hora local)
 *   onChange  (newValue: string) => void
 *   id, name  para el hidden input (form submission compatibility)
 *   required  aria-required en el trigger button
 */
// Alto aproximado del popover en px — usado para decidir si abrir up/down.
// Coincide con el contenido típico (header + 6 filas de días + time row + padding).
const POPOVER_HEIGHT_PX = 380;

export default function DateTimePicker({
  value = "",
  onChange,
  id,
  name,
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);

  const selectedDate = useMemo(() => parseLocalInputValue(value), [value]);

  // Mes visible en el calendar. Sincroniza con `value` cuando se elige uno nuevo.
  const [viewMonth, setViewMonth] = useState(() => {
    return startOfMonth(selectedDate || new Date());
  });

  useEffect(() => {
    if (selectedDate) setViewMonth(startOfMonth(selectedDate));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar al clickear afuera + Escape.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Hora actual del picker — toma del value si existe; sino, default 20:00.
  const currentHour = selectedDate ? selectedDate.getHours() : 20;
  const currentMinute = selectedDate ? selectedDate.getMinutes() : 0;

  const days = useMemo(() => buildCalendarGrid(viewMonth), [viewMonth]);
  const today = useMemo(() => TODAY(), []);

  const setDateAndTime = (date, hour, minute) => {
    const d = new Date(date);
    d.setHours(hour, minute, 0, 0);
    onChange?.(toLocalInputValue(d));
  };

  const handleDayClick = (date) => {
    setDateAndTime(date, currentHour, currentMinute);
  };

  const handleHourChange = (h) => {
    const base = selectedDate || new Date();
    setDateAndTime(base, h, currentMinute);
  };

  const handleMinuteChange = (m) => {
    const base = selectedDate || new Date();
    setDateAndTime(base, currentHour, m);
  };

  // Al togglear, si vamos a abrir medimos el espacio disponible debajo del
  // trigger. Si no entra el popover, lo abrimos hacia arriba.
  const handleToggle = () => {
    if (!open && triggerRef.current && typeof window !== "undefined") {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Abrir hacia arriba si no hay espacio abajo Y hay más espacio arriba.
      setOpenUpward(spaceBelow < POPOVER_HEIGHT_PX && spaceAbove > spaceBelow);
    }
    setOpen((o) => !o);
  };

  const triggerLabel = selectedDate
    ? formatTrigger(selectedDate)
    : "Elegí fecha y hora";

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {/* Trigger — botón que abre el popover. Reemplaza al input nativo.
          Lleva el `id` principal para que el <label htmlFor=...> apunte
          acá (los buttons son labellable, los hidden inputs no). */}
      <button
        type="button"
        ref={triggerRef}
        id={id}
        className={`${styles.trigger} ${selectedDate ? styles.triggerActive : ""}`}
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
      >
        <span className={styles.triggerIcon}>
          <CalendarIcon />
        </span>
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <span className={styles.triggerChevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {/* Hidden input — value escapa al form submission via FormData (name).
          Sin id porque el id ya lo lleva el trigger button. */}
      <input type="hidden" name={name} value={value} readOnly />

      {/* Popover — la clase `popoverUp` ancla bottom-edge en lugar de top-edge. */}
      {open && (
        <div
          className={`${styles.popover} ${openUpward ? styles.popoverUp : ""}`}
          role="dialog"
          aria-label="Seleccionar fecha y hora"
        >
          {/* Month nav */}
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.monthNavBtn}
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft />
            </button>
            <span className={styles.monthLabel}>
              {formatMonthYear(viewMonth)}
            </span>
            <button
              type="button"
              className={styles.monthNavBtn}
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight />
            </button>
          </div>

          {/* Weekday header */}
          <div className={styles.weekdays} aria-hidden="true">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <span key={i} className={styles.weekday}>
                {d}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className={styles.daysGrid} role="grid">
            {days.map((d, i) => {
              const isSelected = isSameDate(d.date, selectedDate);
              const isToday = isSameDate(d.date, today);
              const isPast = d.date < today;
              return (
                <button
                  type="button"
                  key={i}
                  role="gridcell"
                  className={[
                    styles.day,
                    d.isOtherMonth ? styles.otherMonth : "",
                    isSelected ? styles.daySelected : "",
                    isToday ? styles.dayToday : "",
                    isPast ? styles.dayPast : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={isPast}
                  onClick={() => handleDayClick(d.date)}
                  aria-label={d.date.toLocaleDateString("es-AR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  aria-current={isToday ? "date" : undefined}
                  aria-selected={isSelected}
                >
                  {d.dayNum}
                </button>
              );
            })}
          </div>

          {/* Time picker */}
          <div className={styles.timeRow}>
            <span className={styles.timeIcon} aria-hidden="true">
              <ClockIcon />
            </span>
            <select
              className={styles.timeSelect}
              value={currentHour}
              onChange={(e) => handleHourChange(Number(e.target.value))}
              aria-label="Hora"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {pad2(h)}
                </option>
              ))}
            </select>
            <span className={styles.timeSep}>:</span>
            <select
              className={styles.timeSelect}
              value={currentMinute}
              onChange={(e) => handleMinuteChange(Number(e.target.value))}
              aria-label="Minutos"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {pad2(m)}
                </option>
              ))}
            </select>
            <span className={styles.timeUnit}>hs</span>
            <button
              type="button"
              className={styles.doneBtn}
              onClick={() => setOpen(false)}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
