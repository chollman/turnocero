const User = require("../models/User");

// Batch-resolve BGG usernames (case-insensitive) to TurnoCero users that are
// members (have a bggUsername set and are not banned). Returns the public-ish
// user shape (id, username, displayName, avatar, bggUsername).
//
// Shared by `POST /api/users/by-bgg-usernames` (the BG Watch link surfaces) and
// the "Jugadores" curation tab, which needs the same membership resolution.
async function resolveUsersByBggUsernames(usernames, { cap = 50 } = {}) {
  const lowered = [
    ...new Set(
      (usernames || [])
        .filter((u) => typeof u === "string" && u.trim().length > 0)
        .map((u) => u.trim().toLowerCase()),
    ),
  ].slice(0, cap);

  if (lowered.length === 0) return [];

  return User.aggregate([
    {
      $match: {
        bggUsername: { $exists: true, $nin: [null, ""] },
        isBanned: { $ne: true },
      },
    },
    {
      $project: {
        _id: 1,
        username: 1,
        displayName: 1,
        avatar: 1,
        bggUsername: 1,
        _lower: { $toLower: "$bggUsername" },
      },
    },
    { $match: { _lower: { $in: lowered } } },
    { $project: { _lower: 0 } },
  ]);
}

module.exports = { resolveUsersByBggUsernames };
