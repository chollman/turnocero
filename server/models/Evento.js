const mongoose = require("mongoose");

// Ludoteca del Evento: cada user (confirmed registrant o admin del evento)
// agrega juegos que va a llevar/proponer para jugar el día del evento.
// La metadata (name/thumbnail/year/min-max players) se hidrata server-side
// vía `resolveGame()` del módulo BGG al persistir — el cliente solo manda
// `bggGameId` + `notes` opcional. Dedupe lógico por (bggGameId, addedBy) se
// chequea en el route (un user no agrega 2× el mismo juego).
const ludotecaItemSchema = new mongoose.Schema(
  {
    bggGameId: { type: Number, required: true },
    gameName: { type: String, required: true, trim: true, maxlength: 200 },
    thumbnail: { type: String, default: "" },
    image: { type: String, default: "" },
    year: { type: Number, default: null },
    minPlayers: { type: Number, default: null },
    maxPlayers: { type: Number, default: null },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: true },
);

const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected"],
      default: "pending",
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminNotes: { type: String, trim: true, maxlength: 500 },
    // Cuando el host rechaza, puede marcar "permanente": el usuario queda bloqueado
    // del evento y no puede volver a inscribirse. Si es false/undefined, el rechazo
    // es "esta vez" y el usuario puede reintentar (reusa el slot del registro).
    permanentlyRejected: { type: Boolean, default: false },
    comprobante: {
      url: String,
      publicId: String,
      resourceType: String, // 'image' | 'raw' (PDF)
      uploadedAt: { type: Date },
    },
  },
  { _id: true },
);

const eventoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 3000 },
    conditions: { type: String, trim: true, maxlength: 2000 },
    fee: { type: Number, min: 0, default: 0 },
    transferDetails: { type: String, trim: true, maxlength: 500 },
    eventDate: { type: Date, required: true },
    // Migrado de String a subdocumento en 2026-05 para soportar cálculo
    // de distancias. Docs viejos con `location: "texto"` se normalizan al
    // hidratar vía `pre('init')` hook abajo — sin script de migración.
    //
    // `displayName` (opcional) es un alias amigable que el admin puede setear
    // — ej. "Bar de Pepe" en vez de "Av. Corrientes 1234, CABA". Cuando está
    // presente, las pantallas que muestran la ubicación lo usan en lugar del
    // texto formateado. La dirección real (texto + coords) se sigue usando
    // para distancia y mapa.
    location: {
      texto: { type: String, trim: true, maxlength: 300, default: "" },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      displayName: { type: String, trim: true, maxlength: 100, default: "" },
    },
    maxParticipants: { type: Number, min: 1 },
    image: { url: String, publicId: String },
    status: {
      type: String,
      enum: ["draft", "open", "closed", "cancelled"],
      default: "open",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    registrations: [registrationSchema],
    // Ludoteca del Evento — juegos que van a estar disponibles el día del evento,
    // aportados por registrants confirmados y/o el admin del evento.
    ludoteca: { type: [ludotecaItemSchema], default: [] },
    // Marcado por el cron de eventoReminders cuando ya envió el recordatorio
    // 24h. Permite filtrar y NO depender de la ventana [now+23h, now+25h]
    // si el cron se atrasa más de 1h (eventos podrían caerse del rango).
    reminderSentAt: { type: Date, default: null },
    // Mismo principio para el recordatorio "2h antes" (opt-in via
    // User.eventoReminderHours). Campo independiente porque un evento puede
    // tener users con preferencia 24h y otros con 2h — cada ventana se marca
    // por separado.
    reminder2hSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes — listados y dashboards filtran por status + ordenan por eventDate
// o createdAt. Sin estos, GET /api/eventos hace collection scans.
eventoSchema.index({ status: 1, eventDate: 1 });
eventoSchema.index({ status: 1, createdAt: -1 });
// Lookup "¿en qué eventos estoy inscripto?" + filtros del cron de reminders.
eventoSchema.index({ "registrations.user": 1 });
// Cron de reminders barre por eventDate y filtra por reminderSentAt nulo.
eventoSchema.index({ eventDate: 1, reminderSentAt: 1 });

// Lazy migration: normaliza `location` viejo (string plano) al nuevo shape.
// Corre solo al hidratar docs existentes — los nuevos ya nacen con la forma
// correcta. Sin esto, queries sobre eventos viejos tirarían CastError porque
// Mongoose espera el subdoc.
eventoSchema.pre("init", (doc) => {
  if (typeof doc.location === "string") {
    doc.location = {
      texto: doc.location,
      lat: null,
      lng: null,
      displayName: "",
    };
  }
});

// Defensa contra docs legacy donde `location` puede estar como string en el
// DB pero como subdoc en memoria (via pre('init') normalization). Sin esto,
// Mongoose emite $set sobre paths anidados (ej. location.displayName) que
// MongoDB rechaza con "Cannot create field X in element {location: '<str>'}".
// Marcar el subdoc completo fuerza un overwrite atómico al primer save.
eventoSchema.pre("save", function () {
  if (this.location && typeof this.location === "object") {
    this.markModified("location");
  }
});

module.exports = mongoose.model("Evento", eventoSchema);
