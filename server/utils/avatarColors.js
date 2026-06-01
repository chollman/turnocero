// Paleta de colores que un usuario puede elegir para su avatar cuando NO subió
// una foto propia. Son los mismos tokens de marca que usa el cliente para los
// avatares con inicial (client/src/utils/hash.js#AVATAR_PALETTE) — se guardan
// como nombre de CSS variable ("--green") para que el render adapte al tema.
// Mantener en sync con la paleta del cliente (lista corta, documentada).
const AVATAR_COLORS = ["--amber", "--red", "--green", "--orange", "--purple"];

// Devuelve true si `color` es uno de los tokens permitidos. Cualquier otra cosa
// (string arbitrario, hex, vacío, no-string) es inválida. El campo es cosmético:
// los callers ignoran un valor inválido en vez de bloquear el flujo.
function isValidAvatarColor(color) {
  return typeof color === "string" && AVATAR_COLORS.includes(color);
}

module.exports = { AVATAR_COLORS, isValidAvatarColor };
