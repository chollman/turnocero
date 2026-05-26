// Agrupa una fecha en uno de cinco "horizontes" relativos al ahora.
// Usado por MesasListPage para agrupar las mesas por proximidad temporal
// (Hoy / Mañana / Esta semana / Próximamente / Pasadas) en lugar de mostrar
// una lista cronológica plana.
//
// La granularidad es DIARIA (no por horas), comparando contra el inicio
// del día actual: una mesa a las 23:00 de hoy sigue siendo "today" aunque
// falten 5 minutos; una mesa a las 00:30 del día siguiente es "tomorrow".

export function mesaHorizon(dateInput, now = new Date()) {
  if (!dateInput) return "later";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "later";

  const startOfDay = (d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };

  const today0 = startOfDay(now);
  const target0 = startOfDay(date);
  const diffDays = Math.round((target0 - today0) / 86400000);

  if (diffDays < 0) return "past";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return "thisWeek";
  return "later";
}

export const HORIZON_META = {
  today: { name: "Hoy", sub: "a punto de empezar" },
  tomorrow: { name: "Mañana", sub: "24 horas" },
  thisWeek: { name: "Esta semana", sub: "próximos 7 días" },
  later: { name: "Próximamente", sub: "más adelante" },
  past: { name: "Pasadas", sub: "ya jugadas" },
};

// Orden estable para iterar los grupos al renderizar.
export const HORIZON_ORDER = ["today", "tomorrow", "thisWeek", "later", "past"];

// Agrupa una lista de items por horizonte y ordena cada grupo por fecha
// DESCENDIENTE (más reciente primero). Devuelve solo los grupos con items
// (para que el caller no tenga que filtrar).
// `dateAccessor`: función que extrae la fecha del item (default: t => t.date).
export function groupByHorizon(items, dateAccessor = (t) => t.date, now) {
  const groups = new Map();
  for (const it of items) {
    const h = mesaHorizon(dateAccessor(it), now);
    if (!groups.has(h)) groups.set(h, []);
    groups.get(h).push(it);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => new Date(dateAccessor(b)) - new Date(dateAccessor(a)));
  }
  return HORIZON_ORDER.filter((k) => groups.has(k)).map((k) => ({
    key: k,
    name: HORIZON_META[k].name,
    sub: HORIZON_META[k].sub,
    items: groups.get(k),
  }));
}
