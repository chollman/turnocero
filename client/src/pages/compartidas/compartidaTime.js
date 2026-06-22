// Formato relativo propio de las tarjetas de compartidas/reseñas: "recién" /
// "hace 3h" para lo reciente, y la fecha larga ("el 15 de enero", agregando el
// año si es de un año anterior) para lo viejo. Devuelve un label completo (ya
// incluye su prefijo "hace"/"el") — el caller NO debe anteponer nada.
//
// Es una función pura (no componente React) que lee el idioma activo del
// singleton global de i18n, igual que utils/time.js. Los conectores ("hace",
// "el", las unidades min/h/d) salen por i18n; el armado de la fecha larga sigue
// el locale activo vía getLocale().
import i18n from "../../i18n";
import { getLocale } from "../../utils/locale";

export function compartidaTimeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return i18n.t("compartidas:time.justNow");
  if (diff < 3600)
    return i18n.t("compartidas:time.minutesAgo", {
      count: Math.floor(diff / 60),
    });
  if (diff < 86400)
    return i18n.t("compartidas:time.hoursAgo", {
      count: Math.floor(diff / 3600),
    });
  if (diff < 604800)
    return i18n.t("compartidas:time.daysAgo", {
      count: Math.floor(diff / 86400),
    });
  const isOlderYear = d.getFullYear() < new Date().getFullYear();
  return i18n.t("compartidas:time.onDate", {
    date: d.toLocaleDateString(getLocale(), {
      day: "numeric",
      month: "long",
      ...(isOlderYear && { year: "numeric" }),
    }),
  });
}
