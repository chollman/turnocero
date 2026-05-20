const crypto = require('crypto');

// Deterministic content hash for a BggPlay. Used by the drift-detection
// probe: when BGG returns the 30 most recent plays for a user, we hash each
// one and compare against the locally stored `hash` field. A mismatch means
// the play was edited on BGG.com (player added, score changed, comments
// edited, etc.) since the last sync.
//
// IMPORTANT: do NOT sort players. BGG preserves player order across
// requests, and reordering players IS a user-facing edit we want to detect.
//
// Field order in the canonical JSON is fixed in code (not alphabetical) and
// must not change without bumping a hash version — every existing
// BggPlay.hash would have to be recomputed.

const PLAY_FIELDS = [
  'playId', 'date', 'quantity', 'duration', 'location',
  'comments', 'incomplete', 'nowinstats',
];

const PLAYER_FIELDS = [
  'name', 'username', 'userid', 'position', 'color',
  'score', 'win', 'new', 'rating',
];

function pickOrdered(obj, fields) {
  const out = {};
  for (const f of fields) {
    const v = obj == null ? undefined : obj[f];
    out[f] = v === undefined ? null : v;
  }
  return out;
}

function canonicalize(play) {
  const head = pickOrdered(play, PLAY_FIELDS);
  const players = Array.isArray(play?.players)
    ? play.players.map((p) => pickOrdered(p, PLAYER_FIELDS))
    : [];
  return { ...head, players };
}

function computePlayHash(play) {
  const canonical = canonicalize(play);
  const json = JSON.stringify(canonical);
  return crypto.createHash('sha1').update(json).digest('hex');
}

module.exports = { computePlayHash };
