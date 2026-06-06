const mongoose = require("mongoose");

// Local, TurnoCero-side overlay over the players that appear across a user's
// BGG plays. It survives BGG re-syncs (which overwrite BggPlay docs) because it
// lives in a separate collection and is re-applied at READ time.
//
// A "raw player identity" is the key computePlayedCoPlayers uses:
//   "u:<lowerusername>"  if the player has a BGG username
//   "n:<lowername>"      otherwise (free-typed name)
// One overlay can claim several raw keys — that is how a merge folds duplicate
// identities into a single curated player.
//
// What lives here (the local part of the hybrid model):
//   - nameOverride: a curated display name
//   - avatar:       a Cloudinary avatar for players NOT linked to a TurnoCero
//                   member (linked members use their TurnoCero avatar)
//   - bggUsername:  the canonical BGG handle. This is ALSO written back to BGG
//                   (rewriting the claimed plays) so the link survives sync; it
//                   is mirrored here so the overlay can re-key itself.

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
    bggUsername: { type: String, default: null },
    // Marca que este jugador es en realidad el dueño del perfil (registrado con
    // otro nombre). Local-only: lo excluye de los rankings de compañeros y lo
    // muestra como el dueño en las partidas. No toca BGG.
    isSelf: { type: Boolean, default: false },
    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

// "Which overlay claims this raw key" — multikey lookup for read-time apply.
overlaySchema.index({ ownerUsername: 1, rawKeys: 1 });

module.exports = mongoose.model("BggPlayerOverlay", overlaySchema);
