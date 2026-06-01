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

// True si `color` es uno de los tokens elegibles para el avatar (los que ofrece
// el picker cuando el usuario no subió foto). Espeja server/utils/avatarColors.js.
export function isValidAvatarColor(color) {
  return typeof color === "string" && AVATAR_PALETTE.includes(color);
}
