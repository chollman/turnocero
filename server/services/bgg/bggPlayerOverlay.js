// Read-time application + persistence helpers for the Bgg player overlay
// (curated names / avatars / merges over a user's BGG play roster).
//
// See models/BggPlayerOverlay.js for the data model. The pure functions here
// (rawKeyFor / applyOverlayToCoPlayers / applyOverlayToPlayers / sanitizeRawKeys
// / overlayToRow) are unit-tested in isolation; the DB helpers (loadOverlayIndex
// / getOrCreateOverlay / isLinkedToMember) are exercised via integration tests.

const BggPlayerOverlay = require("../../models/BggPlayerOverlay");
const { resolveUsersByBggUsernames } = require("../userLookup");

// The raw identity key of a player subdoc / co-player row. Mirrors the keying in
// computePlayedCoPlayers (bggAggregations.js): username wins, else name.
function rawKeyFor({ name, username } = {}) {
  const u = (username || "").trim().toLowerCase();
  if (u) return `u:${u}`;
  const n = (name || "").trim().toLowerCase();
  return `n:${n}`;
}

function firstUserKey(rawKeys) {
  const k = (rawKeys || []).find((x) => x.startsWith("u:"));
  return k ? k.slice(2) : null;
}

function nameFromKeys(rawKeys) {
  const k = (rawKeys || []).find((x) => x.startsWith("n:"));
  return k ? k.slice(2) : "";
}

// Normalize a client-supplied rawKeys array: keep only well-formed "u:"/"n:"
// keys, lowercased + deduped. Keys are already lowercase on both producer sides.
function sanitizeRawKeys(input) {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input
        .filter((k) => typeof k === "string")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => /^[un]:.+/.test(k)),
    ),
  ];
}

// Does a BggPlay player subdoc match any of the given username/name keys?
function matchesRawKey(player, usernameMatches, nameMatches) {
  const u = (player.username || "").trim().toLowerCase();
  if (u) return usernameMatches.includes(u);
  const n = (player.name || "").trim().toLowerCase();
  return nameMatches.includes(n);
}

// Build the mutation body for a BggPlay doc, reassigning the matched player's
// username to `newHandle`. Preserves every other field / player so the PUT to
// BGG doesn't wipe data.
function playDocToMutationBody(play, usernameMatches, nameMatches, newHandle) {
  return {
    objectid: play.gameId,
    playdate: play.date,
    length: play.duration,
    location: play.location,
    quantity: play.quantity,
    comments: play.comments,
    incomplete: play.incomplete,
    nowinstats: play.nowinstats,
    players: (play.players || []).map((p) => ({
      name: p.name,
      username: matchesRawKey(p, usernameMatches, nameMatches)
        ? newHandle
        : p.username,
      position: p.position,
      color: p.color,
      score: p.score,
      new: p.new,
      rating: p.rating,
      win: p.win,
    })),
  };
}

// Load every overlay for an owner once and index by claimed raw key.
async function loadOverlayIndex(lowerOwner) {
  const overlays = await BggPlayerOverlay.find({
    ownerUsername: lowerOwner,
  }).lean();
  const byKey = new Map();
  for (const o of overlays) {
    for (const k of o.rawKeys || []) byKey.set(k, o);
  }
  return { byKey, overlays };
}

// Collapse computePlayedCoPlayers output through the overlay index: rows claimed
// by the same overlay fold into one curated row; unclaimed rows pass through.
// With `excludeSelf`, rows flagged as the profile owner (isSelf) are dropped —
// used by the co-player rankings (mis-jugadores, topCoPlayers) where the owner
// shouldn't appear. The curation list passes excludeSelf:false so it can show
// them with a badge + an "undo" affordance.
function applyOverlayToCoPlayers(coPlayers, index, { excludeSelf = false } = {}) {
  const groups = new Map();
  for (const cp of coPlayers) {
    const key = rawKeyFor(cp);
    const overlay = index.byKey.get(key);
    const groupId = overlay ? `o:${overlay._id}` : `k:${key}`;
    let g = groups.get(groupId);
    if (!g) {
      g = {
        overlay: overlay || null,
        rawKeys: overlay ? [...overlay.rawKeys] : [key],
        name: cp.name,
        username: cp.username,
        numPlays: 0,
        lastPlayedDate: null,
        _hasUsernameRow: false,
      };
      groups.set(groupId, g);
    }
    g.numPlays += cp.numPlays || 0;
    if (
      cp.lastPlayedDate &&
      (!g.lastPlayedDate || cp.lastPlayedDate > g.lastPlayedDate)
    ) {
      g.lastPlayedDate = cp.lastPlayedDate;
    }
    // Prefer a row with a username for the fallback name/username.
    if (!g._hasUsernameRow && cp.username) {
      g.name = cp.name;
      g.username = cp.username;
      g._hasUsernameRow = true;
    }
  }
  return [...groups.values()]
    .filter((g) => !(excludeSelf && g.overlay?.isSelf))
    .map((g) => {
      const overlay = g.overlay;
      const effUsername = (overlay?.bggUsername || g.username || "").trim();
      const effName =
        (overlay?.nameOverride || g.name || effUsername || "").trim();
      return {
        key: overlay ? `o:${overlay._id}` : `k:${rawKeyFor(g)}`,
        overlayId: overlay ? String(overlay._id) : null,
        rawKeys: g.rawKeys,
        name: effName,
        username: effUsername,
        numPlays: g.numPlays,
        lastPlayedDate: g.lastPlayedDate,
        isSelf: !!overlay?.isSelf,
        avatar: overlay?.avatar?.url
          ? { url: overlay.avatar.url, publicId: overlay.avatar.publicId }
          : null,
      };
    });
}

// Apply curated name/username/avatar to a single play's players[] (playToApi
// shape). Linked (TurnoCero member) players are still resolved client-side via
// useBggUserMap, which takes precedence over these fields, so "TurnoCero wins".
// A player flagged isSelf is shown as the profile owner: its username is set to
// `ownerLower` so the client resolves it to the owner's TurnoCero profile.
function applyOverlayToPlayers(players, index, { ownerLower = null } = {}) {
  return (players || []).map((p) => {
    const overlay = index.byKey.get(rawKeyFor(p));
    if (!overlay) return p;
    const next = { ...p };
    if (overlay.isSelf && ownerLower) {
      next.username = ownerLower;
      return next;
    }
    if (overlay.nameOverride) next.name = overlay.nameOverride;
    if (overlay.bggUsername) next.username = overlay.bggUsername;
    if (overlay.avatar?.url) next.overlayAvatar = overlay.avatar;
    return next;
  });
}

// Curated row for a single overlay doc (mutation responses).
function overlayToRow(overlay, linkedUser) {
  const effUsername = (
    overlay.bggUsername ||
    firstUserKey(overlay.rawKeys) ||
    ""
  ).trim();
  const effName =
    overlay.nameOverride || effUsername || nameFromKeys(overlay.rawKeys);
  return {
    key: `o:${overlay._id}`,
    overlayId: String(overlay._id),
    rawKeys: overlay.rawKeys,
    name: effName,
    username: effUsername,
    avatar: overlay.avatar?.url
      ? { url: overlay.avatar.url, publicId: overlay.avatar.publicId }
      : null,
    isSelf: !!overlay.isSelf,
    linkedUser: linkedUser || null,
    isLinked: !!linkedUser,
    canEditNameAvatar: !linkedUser,
  };
}

// Find the overlay claiming any of `rawKeys`, creating one (claiming all keys)
// if none exists. Ensures all requested keys are claimed.
async function getOrCreateOverlay(lowerOwner, rawKeys) {
  let overlay = await BggPlayerOverlay.findOne({
    ownerUsername: lowerOwner,
    rawKeys: { $in: rawKeys },
  });
  if (!overlay) {
    overlay = await BggPlayerOverlay.create({
      ownerUsername: lowerOwner,
      rawKeys: [...new Set(rawKeys)],
    });
    return overlay;
  }
  const claimed = new Set(overlay.rawKeys);
  let changed = false;
  for (const k of rawKeys) {
    if (!claimed.has(k)) {
      overlay.rawKeys.push(k);
      changed = true;
    }
  }
  if (changed) await overlay.save();
  return overlay;
}

// Is the curated player (by effective bggUsername or any "u:" raw key) linked to
// a TurnoCero member? Used to lock name/avatar editing (TurnoCero wins).
async function isLinkedToMember(rawKeys, bggUsername) {
  const candidates = [];
  if (bggUsername) candidates.push(bggUsername);
  for (const k of rawKeys || []) {
    if (k.startsWith("u:")) candidates.push(k.slice(2));
  }
  if (!candidates.length) return false;
  const users = await resolveUsersByBggUsernames(candidates, { cap: 50 });
  return users.length > 0;
}

module.exports = {
  rawKeyFor,
  firstUserKey,
  nameFromKeys,
  sanitizeRawKeys,
  matchesRawKey,
  playDocToMutationBody,
  loadOverlayIndex,
  applyOverlayToCoPlayers,
  applyOverlayToPlayers,
  overlayToRow,
  getOrCreateOverlay,
  isLinkedToMember,
};
