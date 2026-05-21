const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:      { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt:  { type: Date },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNotes:  { type: String, trim: true, maxlength: 500 },
    // Cuando el host rechaza, puede marcar "permanente": el usuario queda bloqueado
    // del evento y no puede volver a inscribirse. Si es false/undefined, el rechazo
    // es "esta vez" y el usuario puede reintentar (reusa el slot del registro).
    permanentlyRejected: { type: Boolean, default: false },
    comprobante: {
      url:          String,
      publicId:     String,
      resourceType: String, // 'image' | 'raw' (PDF)
      uploadedAt:   { type: Date },
    },
  },
  { _id: true }
);

const eventoSchema = new mongoose.Schema(
  {
    title:           { type: String, required: true, trim: true, maxlength: 200 },
    description:     { type: String, trim: true, maxlength: 3000 },
    conditions:      { type: String, trim: true, maxlength: 2000 },
    fee:             { type: Number, min: 0, default: 0 },
    transferDetails: { type: String, trim: true, maxlength: 500 },
    eventDate:       { type: Date, required: true },
    // Migrado de String a subdocumento en 2026-05 para soportar cálculo
    // de distancias. Docs viejos con `location: "texto"` se normalizan al
    // hidratar vía `pre('init')` hook abajo — sin script de migración.
    location: {
      texto: { type: String, trim: true, maxlength: 300, default: '' },
      lat:   { type: Number, default: null },
      lng:   { type: Number, default: null },
    },
    maxParticipants: { type: Number, min: 1 },
    image:           { url: String, publicId: String },
    status:          { type: String, enum: ['draft', 'open', 'closed', 'cancelled'], default: 'open' },
    author:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    registrations:   [registrationSchema],
  },
  { timestamps: true }
);

// Lazy migration: normaliza `location` viejo (string plano) al nuevo shape.
// Corre solo al hidratar docs existentes — los nuevos ya nacen con la forma
// correcta. Sin esto, queries sobre eventos viejos tirarían CastError porque
// Mongoose espera el subdoc.
eventoSchema.pre('init', (doc) => {
  if (typeof doc.location === 'string') {
    doc.location = { texto: doc.location, lat: null, lng: null };
  }
});

module.exports = mongoose.model('Evento', eventoSchema);
