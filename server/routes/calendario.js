const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const { resolveCommunities } = require("../middleware/resolveCommunities");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { getCalendarItems, ALL_TIPOS } = require("../services/calendarService");

router.use(requireSection("calendario"));

const DAY_MS = 86400000;
const MAX_RANGE_MS = 366 * DAY_MS; // tope anti-abuso del rango consultado

function parseDateParam(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /api/calendario?from=&to=&scope=mias|todas&tipos=mesa,evento,torneo
//
// Agrega mesas + eventos + torneos en un rango de fechas. Read-only.
// `scope=mias` requiere auth. Si from/to faltan, se asume el mes corriente
// más el siguiente (ventana de ~62 días).
router.get(
  "/",
  optionalAuth,
  resolveCommunities,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const from =
      parseDateParam(req.query.from) ||
      new Date(now.getFullYear(), now.getMonth(), 1);
    let to =
      parseDateParam(req.query.to) ||
      new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

    if (from > to) {
      throw httpError(400, "El rango de fechas es inválido (from > to)");
    }
    // Clampeamos rangos absurdos para no escanear años enteros de golpe.
    if (to - from > MAX_RANGE_MS) {
      to = new Date(from.getTime() + MAX_RANGE_MS);
    }

    const scope = req.query.scope === "mias" ? "mias" : "todas";
    if (scope === "mias" && !req.user) {
      throw httpError(401, "Iniciá sesión para ver tu calendario");
    }

    const tipos = req.query.tipos
      ? String(req.query.tipos)
          .split(",")
          .map((t) => t.trim())
          .filter((t) => ALL_TIPOS.includes(t))
      : ALL_TIPOS;

    const friendIds = (req.user?.friends || []).map((id) => String(id));

    const { items } = await getCalendarItems({
      user: req.user || null,
      friendIds,
      from,
      to,
      scope,
      tipos,
      isAdmin: !!req.user?.isAdmin,
      viewingCommunities: req.viewingCommunities || [],
    });

    res.json({
      items,
      range: { from: from.toISOString(), to: to.toISOString() },
      scope,
    });
  }),
);

module.exports = router;
