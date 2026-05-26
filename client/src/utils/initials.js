/**
 * Compute the initials to render inside a user-avatar fallback.
 *
 * Rules:
 * - If `displayName` has 2+ space-separated words, take the first letter of
 *   each of the first two (e.g., "Claudio Hollman" → "CH").
 * - Otherwise return the first letter of `username` (or the displayName), or "?".
 *
 * Uses `Array.from(...)[0]` to safely take the first grapheme even when the
 * string starts with an astral-plane codepoint.
 *
 * @param {{ displayName?: string, name?: string, username?: string }} display
 * @returns {string} uppercase initial(s).
 */
export function getInitials(display = {}) {
  const name = display.displayName || display.name || "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (Array.from(parts[0])[0] + Array.from(parts[1])[0]).toUpperCase();
  }
  const single = display.username || name || "?";
  return (Array.from(single)[0] || "?").toUpperCase();
}
