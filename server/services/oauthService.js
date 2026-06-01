// Business logic de login/registro vía OAuth (Google / Facebook).
// El router (routes/auth.js) verifica el token del proveedor y delega acá
// el find-or-create. Token-based: no usamos Passport ni sesiones — el caller
// emite el mismo JWT que /login una vez resuelto el usuario.
//
// Patrón pareado con services/eventoService.js y services/torneoService.js.

const User = require("../models/User");
const logger = require("../utils/logger");

// Deriva un username base válido a partir del nombre o el email del proveedor.
// El modelo exige 3–30 chars; acá slugificamos (alfanumérico minúscula),
// recortamos y rellenamos si quedó muy corto.
function baseUsernameFrom(seed) {
  // NFD descompone acentos (é → e + marca); el strip final a [a-z0-9]
  // elimina las marcas combinantes y deja la letra base.
  const raw = String(seed || "")
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  let base = raw.slice(0, 20);
  if (base.length < 3) base = `jugador${base}`;
  return base.slice(0, 30);
}

// Genera un username único derivado de `seed`, agregando un sufijo numérico
// si colisiona. Acotado a 30 chars. Reserva espacio para el sufijo al recortar.
async function generateUniqueUsername(seed) {
  const base = baseUsernameFrom(seed);
  if (!(await User.exists({ username: base }))) return base;

  for (let i = 1; i < 10000; i++) {
    const suffix = String(i);
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  // Fallback prácticamente inalcanzable.
  return `${base.slice(0, 20)}${Date.now().toString(36)}`.slice(0, 30);
}

// find-or-create para una identidad OAuth ya verificada por el proveedor.
//   1. Si existe una cuenta con ese providerId → la devuelve.
//   2. Si existe una cuenta con ese email → vincula el proveedor y la devuelve.
//   3. Si no existe → crea una cuenta nueva, ya verificada y sin contraseña.
// `provider` ∈ { "google", "facebook" }. Devuelve un documento User.
async function findOrCreateOAuthUser({
  provider,
  providerId,
  email,
  name,
  picture,
}) {
  if (!provider || !providerId) {
    throw new Error("findOrCreateOAuthUser: provider y providerId requeridos");
  }
  const idField = provider === "google" ? "googleId" : "facebookId";
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  // 1. Ya vinculado por id de proveedor.
  const byProvider = await User.findOne({ [idField]: providerId });
  if (byProvider) return byProvider;

  // 2. Cuenta existente con el mismo email → vincular.
  if (normalizedEmail) {
    const byEmail = await User.findOne({ email: normalizedEmail });
    if (byEmail) {
      byEmail[idField] = providerId;
      byEmail.emailVerified = true; // el proveedor verificó el email
      if (!byEmail.authProviders.includes(provider)) {
        byEmail.authProviders.push(provider);
      }
      await byEmail.save({ validateModifiedOnly: true });
      logger.info("OAuth linked to existing account", {
        provider,
        userId: byEmail._id.toString(),
      });
      return byEmail;
    }
  }

  // 3. Cuenta nueva.
  const username = await generateUniqueUsername(name || normalizedEmail);
  const user = await User.create({
    username,
    email: normalizedEmail,
    emailVerified: true,
    [idField]: providerId,
    authProviders: [provider],
    displayName: name ? String(name).slice(0, 60) : "",
    avatar: picture ? { url: picture, publicId: "" } : undefined,
  });
  logger.info("OAuth account created", {
    provider,
    userId: user._id.toString(),
  });
  return user;
}

module.exports = {
  baseUsernameFrom,
  generateUniqueUsername,
  findOrCreateOAuthUser,
};
