const mongoose = require("mongoose");

const bggGameSchema = new mongoose.Schema(
  {
    gameId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    image: { type: String, default: null },
    thumbnail: { type: String, default: null },
    yearPublished: { type: Number, default: null },
    minPlayers: { type: Number, default: null },
    maxPlayers: { type: Number, default: null },
    lastFetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BggGame", bggGameSchema);
