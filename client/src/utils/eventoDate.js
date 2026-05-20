export const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const MESES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export const DIAS_LARGO  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const DIAS_CORTO  = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export function parseDate(s) {
  if (!s) return null;
  const d = s instanceof Date ? s : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateParts(s) {
  const d = parseDate(s);
  if (!d) return null;
  return {
    day:         d.getDate(),
    month:       MESES_CORTO[d.getMonth()],
    monthLong:   MESES_LARGO[d.getMonth()],
    year:        d.getFullYear(),
    weekday:     DIAS_CORTO[d.getDay()],
    weekdayLong: DIAS_LARGO[d.getDay()],
    time:        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    monthKey:    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    isoDate:     d,
  };
}

export function countdown(s, now = Date.now()) {
  const d = parseDate(s);
  if (!d) return { text: '', tone: 'past' };
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);

  if (diff < 0) {
    if (days >= 2) return { text: `hace ${days} días`, tone: 'past' };
    if (hours >= 1) return { text: `hace ${hours}h`, tone: 'past' };
    return { text: 'finalizado', tone: 'past' };
  }
  if (minutes < 60) return { text: `en ${minutes} min`, tone: 'urgent' };
  if (hours < 24) return { text: `en ${hours}h`, tone: 'urgent' };
  if (days <= 3) return { text: `en ${days} día${days > 1 ? 's' : ''}`, tone: 'urgent' };
  if (days <= 14) return { text: `en ${days} días`, tone: 'soon' };
  if (days <= 60) return { text: `en ${days} días`, tone: 'normal' };
  const weeks = Math.round(days / 7);
  if (weeks <= 12) return { text: `en ${weeks} semanas`, tone: 'normal' };
  const months = Math.round(days / 30);
  return { text: `en ${months} meses`, tone: 'normal' };
}

export function formatFee(fee) {
  if (!fee || fee === 0) return 'Gratis';
  return `$${Number(fee).toLocaleString('es-AR')}`;
}

export function formatDateLong(s) {
  const p = dateParts(s);
  if (!p) return '';
  return `${p.weekdayLong} ${p.day} de ${p.monthLong}, ${p.year} · ${p.time}`;
}

export function groupByMonth(events) {
  const groups = new Map();
  for (const ev of events) {
    const d = dateParts(ev.eventDate);
    if (!d) continue;
    const key = d.monthKey;
    if (!groups.has(key)) {
      groups.set(key, { key, name: d.monthLong, year: d.year, events: [] });
    }
    groups.get(key).events.push(ev);
  }
  return Array.from(groups.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(g => ({
      ...g,
      events: g.events.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)),
    }));
}
