const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isSectionEnabled } = require("../utils/siteConfig");
const { isTokenStale } = require("../utils/tokenFreshness");
const { userHasBetaFeature } = require("../config/betaFeatures");

async function ensureUserMaybe(req) {
  if (req.user) return;
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : req.cookies?.token;
  if (!token) return;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user && !isTokenStale(decoded, user)) {
      req.user = user;
    }
  } catch (_) {
    /* anon */
  }
}

function requireSection(name) {
  return async (req, res, next) => {
    if (isSectionEnabled(name)) return next();
    await ensureUserMaybe(req);
    if (req.user?.isAdmin) return next();
    return res.status(403).json({
      code: "section_disabled",
      section: name,
      message: "Sección deshabilitada",
    });
  };
}

// Feature en piloto (config/betaFeatures.js): la usan los admins y los usuarios
// que un admin habilitó (`User.betaFeatures`), y solo si el interruptor de la
// sección `key` está prendido. Apagado = solo admins, como requireSection.
function requireBetaFeature(key) {
  return async (req, res, next) => {
    await ensureUserMaybe(req);
    const allowed = isSectionEnabled(key)
      ? userHasBetaFeature(req.user, key)
      : !!req.user?.isAdmin;
    if (allowed) return next();
    return res.status(403).json({
      code: "feature_not_enabled",
      feature: key,
      message: req.t
        ? req.t("errors:betaFeatures.notEnabled")
        : "Feature not enabled",
    });
  };
}

module.exports = { requireSection, requireBetaFeature };
