/**
 * Formatea una distancia en km a un string amigable para la UI argentina.
 * Reglas:
 *   - null/undefined         → null (el caller decide qué renderizar)
 *   - "esencialmente aquí"   → null (incluye 0 exacto y cualquier distancia que
 *                               redondee a 0m — el caller no debería mostrar
 *                               "0 m" ni un sufijo redundante junto a la dirección)
 *   - 10m – 999m             → "850 m" (sin decimales, redondeado al múltiplo de 10 más cercano)
 *   - 1 – 99,9 km            → "12,3 km" (1 decimal, coma decimal AR)
 *   - >= 100 km              → "250 km" (sin decimal)
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
    // tu propia dirección — la celda de ubicación ya lo dice todo.
    if (meters === 0) return null;
    return `${meters} m`;
  }
  if (km < 100) {
    return `${km.toFixed(1).replace('.', ',')} km`;
  }
  return `${Math.round(km)} km`;
}
