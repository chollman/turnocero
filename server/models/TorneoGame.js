const mongoose = require("mongoose");

const gameResultSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    score: { type: Number, required: true },
    position: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const torneoGameSchema = new mongoose.Schema(
  {
    torneo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Torneo",
      required: true,
      index: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TorneoGroup",
      required: true,
      index: true,
    },
    gameNumber: { type: Number, required: true, min: 1 },
    results: [gameResultSchema],
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    playedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

torneoGameSchema.index({ group: 1, gameNumber: 1 });

module.exports = mongoose.model("TorneoGame", torneoGameSchema);
