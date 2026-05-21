/**
 * Utilidades geográficas — distancia entre coordenadas usando Haversine.
 *
 * Haversine devuelve la distancia "great-circle" (línea recta sobre la
 * superficie esférica de la Tierra). Es lo suficientemente preciso para
 * el caso de uso de Turnocero ("¿qué tan lejos está esta mesa de mí?")
 * — el error vs distancia real por calle es típicamente < 30% en
 * distancias urbanas, irrelevante para decidir si una mesa es "cerca".
 *
 * No usa APIs externas — pure JS, gratis, instantáneo.
 */

// Radio medio de la Tierra en km.
const EARTH_RADIUS_KM = 6371;

const toRadians = (deg) => (deg * Math.PI) / 180;

/**
 * Distancia great-circle en kilómetros entre dos puntos (lat, lng) en grados.
 *
 * Devuelve null si alguna coordenada es null/undefined/NaN o fuera de rango.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number|null}
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  if (!isValidCoord(lat1, lng1) || !isValidCoord(lat2, lng2)) return null;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Valida que (lat, lng) sean números finitos dentro de rango terrestre.
 */
function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Agrega `distanceKm` a cada item de una lista de tables/eventos cuando el
 * user tiene direccion con coords. Si el item no tiene coords, distanceKm
 * queda null.
 *
 * Mantiene compat con docs Mongoose (toObject) y plain objects.
 *
 * @param {Array} items     lista de docs con `.location.{lat,lng}`
 * @param {number|null} userLat
 * @param {number|null} userLng
 * @returns {Array} items con `distanceKm` agregado
 */
function attachDistance(items, userLat, userLng) {
  if (!isValidCoord(userLat, userLng)) {
    return items.map((t) => {
      const obj = typeof t.toObject === 'function' ? t.toObject() : t;
      return { ...obj, distanceKm: null };
    });
  }
  return items.map((t) => {
    const obj = typeof t.toObject === 'function' ? t.toObject() : t;
    const tLat = obj.location?.lat;
    const tLng = obj.location?.lng;
    const km = (tLat != null && tLng != null) ? haversineKm(userLat, userLng, tLat, tLng) : null;
    return { ...obj, distanceKm: km };
  });
}

/**
 * Bounding box ~cuadrado de lado 2R km alrededor de (userLat, userLng).
 * Sirve como pre-filtro Mongo barato antes de refinar con Haversine en
 * memoria. Sin esto requeriríamos índice 2dsphere y migración a GeoJSON.
 *
 * @param {number} userLat
 * @param {number} userLng
 * @param {number} maxKm
 * @returns {Object} filtro Mongo con `location.lat` y `location.lng` bounded
 */
function buildBboxFilter(userLat, userLng, maxKm) {
  const latDelta = maxKm / 111;
  const lngDelta = maxKm / (111 * Math.cos(userLat * Math.PI / 180) || 1);
  return {
    'location.lat': { $gte: userLat - latDelta, $lte: userLat + latDelta },
    'location.lng': { $gte: userLng - lngDelta, $lte: userLng + lngDelta },
  };
}

module.exports = { haversineKm, isValidCoord, attachDistance, buildBboxFilter };
