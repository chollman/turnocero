/**
 * Formatea una distancia en km a un string amigable para la UI argentina.
 * Reglas:
 *   - null/undefined → null (el caller decide qué renderizar)
 *   - < 1 km        → "850 m" (sin decimales, entero al múltiplo de 10 más cercano)
 *   - 1 – 99.9 km   → "12,3 km" (1 decimal, coma decimal AR)
 *   - >= 100 km     → "250 km" (sin decimal)
 *
 * Para el caso edge de 0km exacto (mesa en la dirección del user) → "Aquí mismo".
 *
 * @param {number|null|undefined} km
 * @returns {string|null}
 */
export function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km === 0) return 'Aquí mismo';
  if (km < 1) {
    const meters = Math.round(km * 1000 / 10) * 10;
    return `${meters} m`;
  }
  if (km < 100) {
    return `${km.toFixed(1).replace('.', ',')} km`;
  }
  return `${Math.round(km)} km`;
}
