const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

const UNITS = [
  { unit: "year", seconds: 31536000 },
  { unit: "month", seconds: 2592000 },
  { unit: "week", seconds: 604800 },
  { unit: "day", seconds: 86400 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

export function formatTimeAgo(date) {
  if (!date) return "";
  const target = new Date(date).getTime();
  if (isNaN(target)) return "";
  const diffSec = Math.round((target - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 45) return "recién";
  for (const { unit, seconds } of UNITS) {
    if (absSec >= seconds) {
      return rtf.format(Math.round(diffSec / seconds), unit);
    }
  }
  return rtf.format(diffSec, "second");
}

/**
 * Hora exacta de una fecha (es-AR, 24h). Si cae en otro día que hoy, antepone
 * la fecha (D/M, agregando el año si difiere del actual). Pensado para usarse
 * como `Actualizado ${formatExactDateTime(...)}`:
 *   - hoy 14:30        → "a las 14:30"
 *   - otro día (mismo año) → "el 3/6 a las 14:30"
 *   - otro año         → "el 3/6/2025 a las 14:30"
 */
export function formatExactDateTime(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return `a las ${time}`;
  let dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
  if (d.getFullYear() !== now.getFullYear()) {
    dateStr += `/${d.getFullYear()}`;
  }
  return `el ${dateStr} a las ${time}`;
}
