const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const PushSubscription = require("../models/PushSubscription");
const { protect, requireAdmin } = require("../middleware/auth");
const userRateLimit = require("../middleware/userRateLimit");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const pushService = require("../services/pushService");

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, errors.array()[0].msg);
}

// POST /api/push/subscribe — registra (o actualiza) la suscripción push del
// dispositivo actual para el usuario autenticado. Upsert por endpoint, así
// re-suscribir el mismo device no duplica filas.
router.post(
  "/subscribe",
  protect,
  userRateLimit({ windowMs: 60_000, max: 20 }),
  [
    body("endpoint")
      .isURL({ require_tld: false })
      .withMessage("endpoint inválido"),
    body("keys.p256dh")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("keys.p256dh requerido"),
    body("keys.auth")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("keys.auth requerido"),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);
    const { endpoint, keys } = req.body;
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: req.user._id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: (req.get("user-agent") || "").slice(0, 256),
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.status(201).json({ ok: true });
  }),
);

// POST /api/push/unsubscribe — elimina la suscripción de este dispositivo.
// Scopeado por user: nadie puede borrar el device de otro.
router.post(
  "/unsubscribe",
  protect,
  [
    body("endpoint")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("endpoint requerido"),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);
    await PushSubscription.deleteOne({
      endpoint: req.body.endpoint,
      user: req.user._id,
    });
    res.json({ ok: true });
  }),
);

// POST /api/push/test — envía una notificación push de prueba a TODOS los
// dispositivos suscriptos del admin autenticado. Herramienta de diagnóstico del
// panel: verifica que la entrega Web Push al sistema operativo funciona, sin
// depender de que ocurra un evento real ni del allowlist de tipos pusheables.
// Lleva el flag `test: true` para que el service worker la muestre aunque la app
// esté en foco (el resto de las push se suprimen con la ventana enfocada).
router.post(
  "/test",
  protect,
  requireAdmin,
  userRateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const result = await pushService.sendToUser(req.user._id, {
      test: true,
      type: "test",
      title: "Notificación de prueba",
      body: "Si ves esto, las notificaciones push funcionan. 🎲",
      url: "/panel-admin",
    });
    // { sent, pruned } — el cliente usa `sent` para distinguir "llegó a N
    // dispositivos" de "no tenés ninguno suscripto".
    res.json({ ok: true, ...result });
  }),
);

module.exports = router;
