// Read-time application + persistence helpers for the Bgg location overlay
// (curated names / merges over a user's BGG play locations). Mirrors
// bggPlayerOverlay.js but simpler: locations have only a name (no avatar / BGG
// handle / self flag / member link).
//
// See models/BggLocationOverlay.js for the data model. The pure functions here
// (locationKeyFor / applyOverlayToLocations / sanitizeLocationKeys) are unit-
// tested in isolation; the DB helpers (loadLocationOverlayIndex /
// getOrCreateLocationOverlay) are exercised via integration tests.

const BggLocationOverlay = require("../../models/BggLocationOverlay");

// The raw identity key of a location string. Mirrors the keying in
// computeLocationRoster (bggAggregations.js): trimmed + lowercased.
function locationKeyFor(name) {
  const n = (name || "").trim().toLowerCase();
  return n ? `l:${n}` : "";
}

function nameFromKey(rawKey) {
  return rawKey && rawKey.startsWith("l:") ? rawKey.slice(2) : "";
}

// Normalize a client-supplied rawKeys array: keep only well-formed "l:" keys,
// lowercased + deduped.
function sanitizeLocationKeys(input) {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input
        .filter((k) => typeof k === "string")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => /^l:.+/.test(k)),
    ),
  ];
}

// Load every overlay for an owner once and index by claimed raw key.
async function loadLocationOverlayIndex(lowerOwner) {
  const overlays = await BggLocationOverlay.find({
    ownerUsername: lowerOwner,
  }).lean();
  const byKey = new Map();
  for (const o of overlays) {
    for (const k of o.rawKeys || []) byKey.set(k, o);
  }
  return { byKey, overlays };
}

// Collapse computeLocationRoster output through the overlay index: rows claimed
// by the same overlay fold into one curated row; unclaimed rows pass through.
// The display name is the overlay's nameOverride, else the most-recent raw
// spelling within the group.
function applyOverlayToLocations(locations, index) {
  const groups = new Map();
  for (const loc of locations) {
    const key = loc.key;
    const overlay = index.byKey.get(key);
    const groupId = overlay ? `o:${overlay._id}` : `k:${key}`;
    let g = groups.get(groupId);
    if (!g) {
      g = {
        overlay: overlay || null,
        rawKeys: overlay ? [...overlay.rawKeys] : [key],
        name: loc.name,
        numPlays: 0,
        lastPlayedDate: null,
        _nameDate: "",
      };
      groups.set(groupId, g);
    }
    g.numPlays += loc.numPlays || 0;
    if (
      loc.lastPlayedDate &&
      (!g.lastPlayedDate || loc.lastPlayedDate > g.lastPlayedDate)
    ) {
      g.lastPlayedDate = loc.lastPlayedDate;
    }
    // Representative name = the spelling from the most-recently-played row.
    if (loc.name && (loc.lastPlayedDate || "") >= g._nameDate) {
      g.name = loc.name;
      g._nameDate = loc.lastPlayedDate || "";
    }
  }
  return [...groups.values()].map((g) => {
    const overlay = g.overlay;
    const name = (
      overlay?.nameOverride ||
      g.name ||
      nameFromKey(g.rawKeys[0]) ||
      ""
    ).trim();
    return {
      key: overlay ? `o:${overlay._id}` : `k:${g.rawKeys[0]}`,
      overlayId: overlay ? String(overlay._id) : null,
      rawKeys: g.rawKeys,
      name,
      numPlays: g.numPlays,
      lastPlayedDate: g.lastPlayedDate,
    };
  });
}

// Curated row for a single overlay doc (mutation responses).
function overlayToLocationRow(overlay) {
  const name = (
    overlay.nameOverride ||
    nameFromKey((overlay.rawKeys || [])[0]) ||
    ""
  ).trim();
  return {
    key: `o:${overlay._id}`,
    overlayId: String(overlay._id),
    rawKeys: overlay.rawKeys,
    name,
    numPlays: 0,
    lastPlayedDate: null,
  };
}

// Find the overlay claiming any of `rawKeys`, creating one (claiming all keys)
// if none exists. Ensures all requested keys are claimed.
async function getOrCreateLocationOverlay(lowerOwner, rawKeys) {
  let overlay = await BggLocationOverlay.findOne({
    ownerUsername: lowerOwner,
    rawKeys: { $in: rawKeys },
  });
  if (!overlay) {
    overlay = await BggLocationOverlay.create({
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

module.exports = {
  locationKeyFor,
  nameFromKey,
  sanitizeLocationKeys,
  loadLocationOverlayIndex,
  applyOverlayToLocations,
  overlayToLocationRow,
  getOrCreateLocationOverlay,
};
