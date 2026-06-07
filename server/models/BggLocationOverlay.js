const mongoose = require("mongoose");

// Local, TurnoCero-side overlay over the locations that appear across a user's
// BGG plays. Mirrors BggPlayerOverlay but for `BggPlay.location` strings. It
// survives BGG re-syncs (which overwrite BggPlay docs) because it lives in a
// separate collection and is re-applied at READ time.
//
// A "raw location key" is what computeLocationRoster uses:
//   "l:<lowerlocation>"  (the trimmed, lowercased location string)
// One overlay can claim several raw keys — that is how a merge folds duplicate
// spellings ("Casa", "casa", "Casa de Juan") into a single curated location.
//
// Locations are simpler than players: only a curated display name lives here
// (no avatar, no BGG handle, no self flag, no member linking).

const overlaySchema = new mongoose.Schema(
  {
    ownerUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    rawKeys: { type: [String], default: [] },
    nameOverride: { type: String, default: null },
  },
  { timestamps: true },
);

// "Which overlay claims this raw key" — multikey lookup for read-time apply.
overlaySchema.index({ ownerUsername: 1, rawKeys: 1 });

module.exports = mongoose.model("BggLocationOverlay", overlaySchema);
