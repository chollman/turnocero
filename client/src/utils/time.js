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
