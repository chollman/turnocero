const mongoose = require("mongoose");

const torneoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    game: { type: String, required: true, trim: true, maxlength: 200 },
    format: {
      type: String,
      enum: ["league", "single_elim", "groups"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "registration", "in_progress", "finished"],
      default: "draft",
      index: true,
    },
    inscriptionMode: {
      type: String,
      enum: ["open", "admin_only"],
      default: "open",
    },
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    maxParticipants: { type: Number, default: null, min: 2 },

    // Fecha opcional del torneo. Solo se usa para ubicarlo en el Calendario
    // unificado — los torneos con `fecha` aparecen ahí; los que no la tienen
    // simplemente no se muestran. Campo nullable, sin migración.
    fecha: { type: Date, default: null },

    // Groups format config (only used when format === 'groups')
    tableSize: { type: Number, min: 2, max: 12, default: 4 },
    gamesPerGroup: { type: Number, min: 1, max: 12, default: 3 },
    qualifiersPerGroup: { type: Number, min: 1, default: 2 },
    currentPhase: { type: Number, default: 0, min: 0 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pendingRegistrations: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    rejectedRegistrations: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],

    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    runnerUp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

torneoSchema.index({ status: 1, createdAt: -1 });
torneoSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Torneo", torneoSchema);
