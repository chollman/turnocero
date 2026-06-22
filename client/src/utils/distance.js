import { formatNumber } from "./locale";

/**
 * Formatea una distancia en km a un string amigable, sensible al idioma activo.
 * Las unidades (m/km) son universales (SI); lo único que varía por idioma es el
 * separador decimal ("12,3 km" en es / "12.3 km" en en), vía Intl (locale.js).
 * Reglas:
 *   - null/undefined         → null (el caller decide qué renderizar)
 *   - "esencialmente aquí"   → null (incluye 0 exacto y cualquier distancia que
 *                               redondee a 0m — el caller no debería mostrar
 *                               "0 m" ni un sufijo redundante junto a la dirección)
 *   - 10m – 999m             → "850 m" (sin decimales, redondeado al múltiplo de 10 más cercano)
 *   - 1 – 99,9 km            → "12,3 km" (1 decimal, separador decimal del locale)
 *   - >= 100 km              → "250 km" (entero, sin separador de miles)
 *
 * @param {number|null|undefined} km
 * @returns {string|null}
 */
export function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) {
    const meters = Math.round((km * 1000) / 10) * 10;
    // Distancia tan chica que redondea a 0m (incluye km === 0) → null.
    // Sirve para no mostrar "0 m" o "Aquí mismo" cuando el evento es en
    // tu propia dirección — la celda de ubicación ya da contexto suficiente.
    if (meters === 0) return null;
    return `${meters} m`;
  }
  if (km < 100) {
    // En este rango (1–99,9) no hay separador de miles, así que Intl sólo
    // cambia la coma/punto decimal — sin sorpresas de "1.234".
    const value = formatNumber(km, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${value} km`;
  }
  // Entero sin separador de miles (universal) — mantiene "1235 km", no "1.235 km".
  return `${Math.round(km)} km`;
}
