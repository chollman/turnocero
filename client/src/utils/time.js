// Texto vía el singleton global de i18n (estos helpers son funciones puras, no
// componentes React — leen el idioma activo igual que locale.js). El formato
// relativo sigue el locale activo vía getLocale().
import i18n from "../i18n";
import { getLocale } from "./locale";

// RelativeTimeFormat es caro de instanciar; lo memoizamos por locale para no
// recrearlo en cada llamada (ej. una lista larga de notificaciones).
const rtfByLocale = new Map();
function getRtf() {
  const locale = getLocale();
  let rtf = rtfByLocale.get(locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    rtfByLocale.set(locale, rtf);
  }
  return rtf;
}

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
  if (absSec < 45) return i18n.t("time:justNow");
  const rtf = getRtf();
  for (const { unit, seconds } of UNITS) {
    if (absSec >= seconds) {
      return rtf.format(Math.round(diffSec / seconds), unit);
    }
  }
  return rtf.format(diffSec, "second");
}

/**
 * Hora exacta de una fecha (24h). Si cae en otro día que hoy, antepone la fecha
 * (D/M, agregando el año si difiere del actual). Los conectores ("a las"/"el")
 * salen por i18n; el armado numérico (HH:MM, D/M) se mantiene igual en ambos
 * idiomas. Pensado para usarse como `Actualizado ${formatExactDateTime(...)}`:
 *   - hoy 14:30        → "a las 14:30" / "at 14:30"
 *   - otro día (mismo año) → "el 3/6 a las 14:30" / "on 3/6 at 14:30"
 *   - otro año         → "el 3/6/2025 a las 14:30" / "on 3/6/2025 at 14:30"
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
  if (sameDay) return i18n.t("time:atTime", { time });
  let dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
  if (d.getFullYear() !== now.getFullYear()) {
    dateStr += `/${d.getFullYear()}`;
  }
  return i18n.t("time:onDateAtTime", { date: dateStr, time });
}
