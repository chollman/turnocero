const express = require('express');
const rateLimit = require('express-rate-limit');
const { Client } = require('@googlemaps/google-maps-services-js');
const GeocodeCache = require('../models/GeocodeCache');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Cliente compartido (interno: usa axios, sin estado).
const googleClient = new Client({});

// Rate limit por usuario autenticado — proteger nuestra cuota de Google ante
// loops o abusos. 30 requests/min por user es muchísimo para uso humano normal.
const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { message: 'Demasiadas búsquedas de dirección, esperá un minuto.' },
});

// Normaliza la query para usarla como clave de caché:
// lowercase + trim + colapsar espacios múltiples.
const normalizeQuery = (q) =>
  q.toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * GET /api/geocode?q=<texto>
 *
 * Auth requerida (no queremos endpoint público que gaste nuestra cuota).
 * Cache-first sobre GeocodeCache; si no hay hit (o el doc venció por TTL),
 * llama a Google Geocoding API y guarda.
 *
 * Respuesta: { lat, lng, formatted, cached }
 * Errores:
 *   400 si q está vacío o muy corto
 *   404 si Google no encontró nada
 *   500 si Google falla
 */
router.get('/', protect, geocodeLimiter, async (req, res) => {
  const raw = (req.query.q || '').toString();
  if (raw.trim().length < 3) {
    return res.status(400).json({ message: 'La dirección debe tener al menos 3 caracteres.' });
  }

  const query = normalizeQuery(raw);

  try {
    // Cache hit.
    const cached = await GeocodeCache.findOne({ query }).lean();
    if (cached) {
      return res.json({
        lat: cached.lat,
        lng: cached.lng,
        formatted: cached.formatted,
        cached: true,
      });
    }

    // Cache miss — llamar a Google.
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Geocoding no está configurado en el servidor.' });
    }

    const response = await googleClient.geocode({
      params: {
        address: raw.trim(),
        key: apiKey,
        // Sesgar a Argentina (más probable que la dirección sea local).
        region: 'ar',
        language: 'es',
      },
      timeout: 5000,
    });

    const result = response.data.results?.[0];
    if (!result) {
      return res.status(404).json({ message: 'No se encontró esa dirección.' });
    }

    const { lat, lng } = result.geometry.location;
    const formatted = result.formatted_address || raw.trim();

    // Upsert: guardar (o refrescar lastFetchedAt si ya existía pero venció).
    await GeocodeCache.findOneAndUpdate(
      { query },
      { query, lat, lng, formatted, lastFetchedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // Algunos status (REQUEST_DENIED, OVER_QUERY_LIMIT) vienen con HTTP 200
    // + status en el body. Capturarlos también acá.
    if (response.data.status && response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      const detail = response.data.error_message || '';
      logger.warn('[geocode] Google returned non-OK status', {
        status: response.data.status,
        detail,
      });
      return res.status(502).json({
        message: `Error de Google Geocoding: ${response.data.status}${detail ? ` — ${detail}` : ''}`,
      });
    }

    return res.json({ lat, lng, formatted, cached: false });
  } catch (err) {
    // Errores de Google (network, timeout, quota exceeded) → 502.
    if (err.response?.data?.status) {
      const detail = err.response.data.error_message || '';
      logger.warn('[geocode] Google API error', {
        status: err.response.data.status,
        detail,
      });
      return res.status(502).json({
        message: `Error de Google Geocoding: ${err.response.data.status}${detail ? ` — ${detail}` : ''}`,
      });
    }
    logger.warn('[geocode] Unexpected error', { error: err.message });
    return res.status(500).json({ message: 'Error al consultar geocoding.' });
  }
});

module.exports = router;
