const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { Client } = require("@googlemaps/google-maps-services-js");
const GeocodeCache = require("../models/GeocodeCache");
const { protect } = require("../middleware/auth");
const logger = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

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
  keyGenerator: (req, res) =>
    req.user?._id?.toString() || ipKeyGenerator(req, res),
  message: { message: "Demasiadas búsquedas de dirección, esperá un minuto." },
});

// Normaliza la query para usarla como clave de caché:
// lowercase + trim + colapsar espacios múltiples.
const normalizeQuery = (q) => q.toLowerCase().trim().replace(/\s+/g, " ");

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
 *   502 si Google responde con error o falla red
 *   500 si geocoding no está configurado
 */
router.get(
  "/",
  protect,
  geocodeLimiter,
  asyncHandler(async (req, res) => {
    const raw = (req.query.q || "").toString();
    if (raw.trim().length < 3) {
      throw httpError(400, "La dirección debe tener al menos 3 caracteres.");
    }

    const query = normalizeQuery(raw);

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
      throw httpError(500, "Geocoding no está configurado en el servidor.");
    }

    // Capturamos los errores del client de Google acá adentro para preservar
    // el mensaje específico ("Error de Google Geocoding: <status>"). El
    // errorHandler central solo expone err.message en 4xx; con un 502 sin
    // catch quedaría como "Error interno del servidor".
    let response;
    try {
      response = await googleClient.geocode({
        params: {
          address: raw.trim(),
          key: apiKey,
          // Sesgar a Argentina (más probable que la dirección sea local).
          region: "ar",
          language: "es",
        },
        timeout: 5000,
      });
    } catch (err) {
      if (err.response?.data?.status) {
        const detail = err.response.data.error_message || "";
        logger.warn("[geocode] Google API error", {
          status: err.response.data.status,
          detail,
        });
        throw httpError(
          502,
          `Error de Google Geocoding: ${err.response.data.status}${detail ? ` — ${detail}` : ""}`,
        );
      }
      logger.warn("[geocode] Unexpected error", { error: err.message });
      throw httpError(500, "Error al consultar geocoding.");
    }

    const result = response.data.results?.[0];
    if (!result) {
      throw httpError(404, "No se encontró esa dirección.");
    }

    const { lat, lng } = result.geometry.location;
    const formatted = result.formatted_address || raw.trim();

    // Upsert: guardar (o refrescar lastFetchedAt si ya existía pero venció).
    await GeocodeCache.findOneAndUpdate(
      { query },
      { query, lat, lng, formatted, lastFetchedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true },
    );

    // Algunos status (REQUEST_DENIED, OVER_QUERY_LIMIT) vienen con HTTP 200
    // + status en el body. Capturarlos también acá.
    if (
      response.data.status &&
      response.data.status !== "OK" &&
      response.data.status !== "ZERO_RESULTS"
    ) {
      const detail = response.data.error_message || "";
      logger.warn("[geocode] Google returned non-OK status", {
        status: response.data.status,
        detail,
      });
      throw httpError(
        502,
        `Error de Google Geocoding: ${response.data.status}${detail ? ` — ${detail}` : ""}`,
      );
    }

    return res.json({ lat, lng, formatted, cached: false });
  }),
);

module.exports = router;
