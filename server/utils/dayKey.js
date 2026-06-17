// Claves de día calendario en hora de Argentina (UTC-3, sin horario de
// verano). El reporte de uso de BGG agrupa "por día" desde la óptica del
// usuario argentino, no en UTC — si no, un evento a las 22:00 AR caería en
// el día siguiente.

const AR_TZ = "America/Argentina/Buenos_Aires";

// 'YYYY-MM-DD' del día calendario AR para una fecha dada (default: ahora).
// en-CA formatea como YYYY-MM-DD, que es justo lo que queremos como key.
function dayKeyAR(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Rango UTC [start, end) que cubre los días AR `fromDay`..`toDay` inclusive.
// AR es UTC-3 fijo, así que el offset literal `-03:00` es seguro y evita
// depender de la tz del proceso. `end` es el inicio del día siguiente a
// `toDay` (exclusivo) para poder usar `$gte start` + `$lt end`.
function dayRangeToUtc(fromDay, toDay) {
  const start = new Date(`${fromDay}T00:00:00-03:00`);
  const endBase = new Date(`${toDay}T00:00:00-03:00`);
  const end = new Date(endBase.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Resta `days` días calendario a un day-key AR y devuelve el nuevo key.
function subtractDays(dayKey, days) {
  const d = new Date(`${dayKey}T00:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() - days);
  return dayKeyAR(d);
}

module.exports = { dayKeyAR, dayRangeToUtc, subtractDays, AR_TZ };
