const { isValidCoord } = require('./geo');

/**
 * Helpers para normalizar el subdocumento `location` ({ texto, lat, lng })
 * usado tanto en Table como en Evento.
 *
 * Reglas:
 *   - Acepta input como string (legacy / FormData simple) o como objeto.
 *   - Si vienen lat/lng inválidos (fuera de rango, NaN, no-numéricos), los
 *     descarta a null en vez de tirar 400 — mejor UX que rechazar el guardado.
 *   - Sólo guarda coords si AMBAS son válidas (una sola sirve de poco).
 *
 * También expone `locationForCreate` que aplica fallback al direccion del
 * perfil del autor cuando la location entrante está vacía (usado en POST
 * /api/tables y POST /api/eventos).
 */

const MAX_TEXTO_LEN = 300;

function normalizeLocationInput(loc) {
  if (loc == null) return undefined;
  if (typeof loc === 'string') {
    // FormData siempre llega como string; si parece JSON, parsearlo.
    const trimmed = loc.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return normalizeLocationInput(JSON.parse(trimmed));
      } catch {
        // Caída a tratarlo como texto plano abajo.
      }
    }
    return { texto: loc.slice(0, MAX_TEXTO_LEN), lat: null, lng: null };
  }
  if (typeof loc === 'object') {
    const texto = typeof loc.texto === 'string' ? loc.texto.slice(0, MAX_TEXTO_LEN) : '';
    const latRaw = loc.lat;
    const lngRaw = loc.lng;
    const lat = typeof latRaw === 'number' && isValidCoord(latRaw, lngRaw ?? 0) ? latRaw : null;
    const lng = typeof lngRaw === 'number' && isValidCoord(latRaw ?? 0, lngRaw) ? lngRaw : null;
    const bothValid = lat !== null && lng !== null;
    return { texto, lat: bothValid ? lat : null, lng: bothValid ? lng : null };
  }
  return undefined;
}

function isEmptyLocation(loc) {
  if (!loc) return true;
  return !loc.texto && loc.lat == null && loc.lng == null;
}

/**
 * Para POST de Table/Evento: si el autor no especificó location, heredar la
 * del perfil (si la tiene). Si tampoco, queda sin ubicación.
 *
 * PUT NO debe usar este fallback — el autor puede borrar location explícitamente.
 */
function locationForCreate(input, userDireccion) {
  const normalized = normalizeLocationInput(input);
  if (!isEmptyLocation(normalized)) return normalized;

  const hasUserCoords = userDireccion?.lat != null && userDireccion?.lng != null;
  const hasUserTexto = Boolean(userDireccion?.texto);
  if (!hasUserCoords && !hasUserTexto) return normalized;

  return {
    texto: userDireccion.texto || '',
    lat: hasUserCoords ? userDireccion.lat : null,
    lng: hasUserCoords ? userDireccion.lng : null,
  };
}

module.exports = { normalizeLocationInput, isEmptyLocation, locationForCreate };
