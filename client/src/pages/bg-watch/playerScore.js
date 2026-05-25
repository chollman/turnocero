// Display-side filter for a play player's `score` field.
//
// Background: some plays carry the literal string "null" in the score field
// (data poisoned by older writes that coerced null → "null", or BGG returning
// "null" textually for some users). The naive truthy check `score && ...`
// passes "null" through and renders the four letters in the UI.
//
// Returns true only when the value should be shown to the user. Real
// scores like "0", "10.5", "negative-7" are kept.
export function hasDisplayableScore(score) {
  if (score == null) return false;
  const str = String(score).trim();
  if (str === "") return false;
  if (str.toLowerCase() === "null") return false;
  if (str.toLowerCase() === "undefined") return false;
  return true;
}
