const mongoose = require("mongoose");

// One document per (BGG username, BGG play id). Used to materialize a user's
// play history locally so reads of /api/bgg/partidas can be served from
// Mongo (paginated + filtered) instead of repeatedly hitting BGG. Mutations
// from Turnocero (POST/PUT/DELETE plays) keep this in sync. The
// "Sincronizar con BGG" button does a full re-sync to catch edits/deletes
// the user made directly on BGG's web UI, which BGG doesn't notify us of.

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, default: null },
    username: { type: String, default: null },
    userid: { type: Number, default: null },
    position: { type: String, default: null },
    color: { type: String, default: null },
    score: { type: String, default: null },
    win: { type: Boolean, default: false },
    new: { type: Boolean, default: false },
    rating: { type: Number, default: null },
  },
  { _id: false },
);

const bggPlaySchema = new mongoose.Schema(
  {
    bggUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    playId: { type: String, required: true },
    date: { type: String, default: null }, // YYYY-MM-DD per BGG
    gameId: { type: String, default: null },
    gameName: { type: String, default: null },
    gameThumbnail: { type: String, default: null },
    quantity: { type: Number, default: 1 },
    duration: { type: Number, default: null },
    location: { type: String, default: null },
    incomplete: { type: Boolean, default: false },
    nowinstats: { type: Boolean, default: false },
    comments: { type: String, default: null },
    players: { type: [playerSchema], default: [] },
    hash: { type: String, default: null, index: true },
  },
  { timestamps: true },
);

// Compound uniqueness — each play is unique per BGG user.
bggPlaySchema.index({ bggUsername: 1, playId: 1 }, { unique: true });
// Sort by date desc inside a user's plays (most common query).
bggPlaySchema.index({ bggUsername: 1, date: -1 });

module.exports = mongoose.model("BggPlay", bggPlaySchema);
