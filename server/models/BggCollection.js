const mongoose = require("mongoose");

// One document per BGG username (lowercased). Mutable data: collections
// change when users add/remove games on BGG, so resolveCollection treats
// `lastFetchedAt` as a TTL check (6 h by default) and re-fetches on miss.
// The `games` array stores the same shape returned by /api/bgg/coleccion.
const bggCollectionItemSchema = new mongoose.Schema(
  {
    id: { type: String },
    name: { type: String },
    thumbnail: { type: String, default: null },
    image: { type: String, default: null },
    yearPublished: { type: Number, default: null },
    userRating: { type: Number, default: null },
    bggRating: { type: Number, default: null },
    numPlays: { type: Number, default: 0 },
  },
  { _id: false },
);

const bggCollectionSchema = new mongoose.Schema(
  {
    bggUsername: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    games: { type: [bggCollectionItemSchema], default: [] },
    lastFetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BggCollection", bggCollectionSchema);
