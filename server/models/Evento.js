const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:      { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt:  { type: Date },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNotes:  { type: String, trim: true, maxlength: 500 },
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
    eventDate:       { type: Date },
    location:        { type: String, trim: true, maxlength: 300 },
    maxParticipants: { type: Number, min: 1 },
    image:           { url: String, publicId: String },
    status:          { type: String, enum: ['draft', 'open', 'closed', 'cancelled'], default: 'open' },
    author:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    registrations:   [registrationSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Evento', eventoSchema);
