const express = require("express");
const router = express.Router();
const { protect, requireAdmin } = require("../middleware/auth");
const { getSiteConfig, updateSiteConfig } = require("../utils/siteConfig");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

// GET /api/site-config — public; clients (incluso anónimos) necesitan saber qué mostrar
router.get("/", (_req, res) => {
  res.json(getSiteConfig());
});

// PATCH /api/site-config — admin only
router.patch(
  "/",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { sections } = req.body || {};
    if (!sections || typeof sections !== "object") {
      throw httpError(400, "Body inválido: se esperaba { sections: {...} }");
    }
    const io = req.app.get("io");
    const updated = await updateSiteConfig(sections, req.user._id, io);
    res.json(updated);
  }),
);

module.exports = router;
