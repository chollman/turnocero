/**
 * Deterministic palette assignment from an arbitrary string key (typically a
 * user `_id`). Used by `<Avatar>` to give the same user the same color across
 * the app.
 */
export const AVATAR_PALETTE = [
  "--amber",
  "--red",
  "--green",
  "--orange",
  "--purple",
];

export function hashStringToInt(key = "") {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

export function hashToBrandColor(key = "") {
  return AVATAR_PALETTE[hashStringToInt(key) % AVATAR_PALETTE.length];
}
