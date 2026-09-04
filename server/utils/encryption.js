const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const KEY_HEX_LENGTH = 64; // 32 bytes = 256 bits

function getKey(envVar) {
  const hex = process.env[envVar];
  if (!hex || hex.length !== KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      `${envVar} env var must be a 64-character hex string (32 bytes). ` +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns `iv:authTag:ciphertext` as colon-separated hex.
 *
 * `envVar` selects which env var holds the master key — defaults to
 * BGG_CREDS_KEY for backward compat with existing callers. Pass a different
 * name (e.g. INSTAGRAM_CREDS_KEY) to encrypt a different kind of secret under
 * its own rotatable key.
 */
function encrypt(plaintext, envVar = "BGG_CREDS_KEY") {
  if (plaintext === "" || plaintext == null) return "";
  const key = getKey(envVar);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/**
 * Decrypts a payload produced by encrypt(). Throws if the auth tag fails
 * (tampered ciphertext or wrong key). `envVar` must match the one used to
 * encrypt — see encrypt() above.
 */
function decrypt(payload, envVar = "BGG_CREDS_KEY") {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted payload format");
  const [ivHex, tagHex, encHex] = parts;
  const key = getKey(envVar);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

module.exports = { encrypt, decrypt };
