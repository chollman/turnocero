/**
 * Formatea el texto de ubicación de un Evento/Table según el caso de uso.
 *
 * El input es el `formatted_address` que devuelve Google Places — formato
 * típico AR:
 *   "Av. de Mayo 1123, B1650 San Martín, Provincia de Buenos Aires, Argentina"
 *
 * Modos:
 *   - "fullAddress" (default): devuelve el texto tal cual.
 *   - "city": solo la localidad — útil en listas/cards compactas.
 *   - "regular": calle + altura + ciudad — sin provincia/país, formato cómodo
 *     para detalles que quieren más contexto que la ciudad pero menos ruido
 *     que la dirección completa.
 *
 * Si el texto no parece tener formato Google (sin comas o solo una), se
 * devuelve sin tocar — texto libre del usuario no se puede parsear.
 *
 * @param {string|null|undefined} texto
 * @param {"fullAddress"|"city"|"regular"} mode
 * @returns {string}
 */
/**
 * Devuelve qué mostrar para una location en un componente:
 *   - Si tiene `displayName` (alias amigable seteado por el admin), lo usa tal cual.
 *   - Si no, formatea el texto crudo según el `mode` (city/regular/fullAddress).
 *
 * Centraliza el "override del nombre" para que cualquier pantalla lo respete
 * sin tener que duplicar el check en cada componente.
 *
 * @param {Object|string|null|undefined} location  subdoc { texto, displayName? } o string legacy
 * @param {"fullAddress"|"city"|"regular"} mode    formato a aplicar si no hay displayName
 * @returns {string}
 */
export function getLocationDisplay(location, mode = 'fullAddress') {
  if (!location) return '';
  if (typeof location === 'string') return formatLocation(location, mode);
  if (location.displayName && location.displayName.trim()) {
    return location.displayName.trim();
  }
  return formatLocation(location.texto || '', mode);
}

export function formatLocation(texto, mode = 'fullAddress') {
  if (!texto) return '';

  // Si el modo no es válido, fallback a fullAddress.
  if (mode !== 'city' && mode !== 'regular') return texto;

  const parts = texto.split(',').map((p) => p.trim()).filter(Boolean);
  // Texto libre (sin formato Google): devolver tal cual.
  if (parts.length < 2) return texto;

  const cityPart = extractCity(parts);
  if (mode === 'city') return cityPart || texto;

  // mode === "regular": "calle, ciudad". Si parts[0] tiene número (street-like)
  // y NO es la ciudad misma, lo prependeamos. Sino devolvemos solo la ciudad.
  const street = parts[0];
  const streetLooksLikeStreet = /\d/.test(street) && street !== cityPart;
  return streetLooksLikeStreet ? `${street}, ${cityPart}` : cityPart;
}

/**
 * Extrae la localidad de una formatted_address de Google.
 *
 * Estrategia: descartar el país (último elemento si matchea una lista corta)
 * y la provincia (elementos que empiezan con "Provincia de"). El último
 * elemento que queda es la ciudad — funcione para todos los formatos:
 *
 *   "Av X 100, B1650 San Martín, Provincia de Buenos Aires, Argentina" → "San Martín"
 *   "San Martín, Provincia de Buenos Aires, Argentina"                  → "San Martín"
 *   "Av X 100, C1006 CABA, Argentina"                                   → "CABA"
 *   "Florida 100, Buenos Aires"                                         → "Buenos Aires"
 *
 * Si después de filtrar no queda nada (ej. el user picó solo una provincia),
 * devuelve '' — el caller usa el texto completo como fallback.
 */
function extractCity(parts) {
  // Lista de países que aparecen al final en formatted_address típicos.
  // Para uso AR-focused esto cubre el 99%; si en el futuro hay otros países,
  // ampliar el array.
  const COUNTRY_TOKENS = new Set(['Argentina', 'Uruguay', 'Chile', 'Brasil', 'Brazil']);

  let candidates = [...parts];
  // Strip país si está al final.
  if (candidates.length > 1 && COUNTRY_TOKENS.has(candidates[candidates.length - 1])) {
    candidates.pop();
  }
  // Strip provincias ("Provincia de XXX", "Provincia XXX", "XXX Province").
  candidates = candidates.filter((p) => !/^Provincia(\s+de)?\s+/i.test(p) && !/\sProvince$/i.test(p));

  if (candidates.length === 0) return '';
  // La ciudad es el último elemento que queda — funciona tanto si arranca con
  // calle como si arranca directo con la ciudad.
  return stripPostalCode(candidates[candidates.length - 1]);
}

/**
 * Quita códigos postales argentinos al inicio de un fragmento.
 * Formatos típicos: "B1650 San Martín", "C1006 CABA", "1414 Palermo".
 */
function stripPostalCode(s) {
  return s.replace(/^[A-Z]?\d{4}\s+/, '').trim();
}
