const crypto = require("crypto");

// 6-digit numeric code, zero-padded, for email verification.
function generateCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

// URL-safe random token for password reset links (~64 chars hex).
function generateUrlToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// Constant-time compare to avoid timing attacks on token lookups.
function compareToken(token, hash) {
  if (!token || !hash) return false;
  const candidate = hashToken(token);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  generateCode,
  generateUrlToken,
  hashToken,
  compareToken,
};
