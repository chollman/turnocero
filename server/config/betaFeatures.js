// Features en piloto que un admin puede habilitar a usuarios puntuales desde
// /panel-admin (campo `User.betaFeatures`). Cada clave es también una sección
// de SiteConfig: con el interruptor apagado solo la ven los admins; prendido,
// los admins y los usuarios habilitados. Para pilotear una feature nueva,
// sumá su clave acá y usá `requireBetaFeature(clave)` / `useBetaFeature(clave)`.
const BETA_FEATURE_KEYS = ["bgwatchAgent"];

function isBetaFeatureKey(key) {
  return BETA_FEATURE_KEYS.includes(key);
}

// ¿Este usuario puede usar la feature? (sin mirar el interruptor global)
function userHasBetaFeature(user, key) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return Array.isArray(user.betaFeatures) && user.betaFeatures.includes(key);
}

module.exports = { BETA_FEATURE_KEYS, isBetaFeatureKey, userHasBetaFeature };
