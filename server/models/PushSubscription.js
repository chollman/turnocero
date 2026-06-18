const mongoose = require("mongoose");

// Una fila por dispositivo suscripto a Web Push. Un usuario puede tener varias
// (desktop + teléfono + …). `endpoint` es la URL única que asigna el browser
// → upsert por endpoint: re-suscribir, o un device reusado por otro usuario,
// reasigna la fila limpio sin duplicar.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
