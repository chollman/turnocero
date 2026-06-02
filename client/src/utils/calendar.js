// Helpers puros para la grilla del Calendario unificado. Sin librerías de
// fecha — todo nativo con `Date` (convención del repo, ver eventoDate.js).
// La semana arranca en LUNES (convención es-AR).

import { MESES_LARGO } from "./eventoDate";

// Iniciales de día arrancando en lunes, para los headers de la grilla.
export const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

// Clave local "YYYY-MM-DD" de una fecha (sin tocar timezone). Sirve para
// agrupar items por día y para matchear celdas con items.
export function dayKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Offset lunes-primero: getDay() devuelve 0=Dom..6=Sáb; lo rotamos a
// 0=Lun..6=Dom.
function mondayOffset(date) {
  return (date.getDay() + 6) % 7;
}

// Etiqueta "Junio 2026".
export function monthLabel(year, month) {
  return `${MESES_LARGO[month]} ${year}`;
}

// Avanza/retrocede meses con wraparound de año. delta puede ser ±N.
export function addMonths(year, month, delta) {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// Primer y último instante (local) del mes — útil para pedir el rango al server.
export function monthRange(year, month) {
  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

// Matriz del mes: array de semanas (lunes→domingo), cada una con 7 celdas
// `{ date, key, inMonth, isToday }`. Genera solo las semanas necesarias
// (5 o 6 filas) para no dejar una fila vacía al final.
export function buildMonthMatrix(year, month, today = new Date()) {
  const first = new Date(year, month, 1);
  const offset = mondayOffset(first);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const todayKey = dayKey(today);

  const start = new Date(year, month, 1 - offset);
  const matrix = [];
  for (let w = 0; w < weeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + w * 7 + d,
      );
      const key = dayKey(date);
      week.push({
        date,
        key,
        inMonth: date.getMonth() === month,
        isToday: key === todayKey,
      });
    }
    matrix.push(week);
  }
  return matrix;
}

// Agrupa items del calendario (con `.date`) por día local → Map<key, item[]>.
export function groupByDay(items = []) {
  const map = new Map();
  for (const it of items) {
    const key = dayKey(it.date);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return map;
}
