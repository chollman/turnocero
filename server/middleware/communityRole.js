const Community = require("../models/Community");
const httpError = require("../utils/httpError");
const { isSubadmin } = require("../services/communityService");

// requireCommunityRole — permite si el usuario es admin global O subadmin de la
// comunidad referida por el slug. Resuelve la comunidad y la adjunta como
// req.community. Corre DESPUÉS de protect (necesita req.user). Espeja la forma
// de requireSection/requireAdmin.
function requireCommunityRole(slugParam = "slug") {
  return async (req, res, next) => {
    try {
      const community = await Community.findOne({ slug: req.params[slugParam] });
      if (!community) return next(httpError(404, "Comunidad no encontrada"));
      req.community = community;
      if (req.user?.isAdmin) return next();
      if (isSubadmin(req.user, community._id)) return next();
      return next(httpError(403, "No tenés permisos en esta comunidad"));
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requireCommunityRole;
