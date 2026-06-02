// Business logic de Comunidades. Los routers son plumbing HTTP delgado; acá
// vive la lógica testeable en aislamiento (patrón pareado con oauthService /
// eventoService / torneoService).
//
// Fase 1 expone solo lo necesario para el read-scoping + el default de
// escritura + el alta de usuario. Se irá ampliando (join/leave/roles/cascada)
// en fases siguientes.

const Community = require("../models/Community");
const { isSameId } = require("../utils/idCompare");
const httpError = require("../utils/httpError");

function getBase() {
  return Community.getBase();
}

// ¿El usuario es miembro de esta comunidad?
function isMember(user, communityId) {
  return (user?.communityMemberships || []).some((m) =>
    isSameId(m.community, communityId),
  );
}

// Lanza 403 si el usuario no es miembro de la comunidad dada.
function assertMembership(user, communityId) {
  if (!isMember(user, communityId)) {
    throw httpError(403, "No sos miembro de esa comunidad");
  }
}

// Comunidad por defecto para crear contenido: la del skin activo, o la base si
// el usuario no tiene skin seteado todavía.
async function defaultCommunityFor(user) {
  if (user?.communityPrefs?.skin) return user.communityPrefs.skin;
  const base = await getBase();
  return base._id;
}

// Garantiza que el usuario pertenezca a la comunidad base (membership `member`)
// y tenga el skin base si no eligió otro. Idempotente. Se llama en TODO alta de
// usuario (registro password + OAuth) para que nadie quede sin comunidad.
// Muta y persiste el doc recibido.
async function ensureBaseMembership(user) {
  const base = await getBase();
  let changed = false;

  if (!isMember(user, base._id)) {
    user.communityMemberships.push({ community: base._id, role: "member" });
    changed = true;
  }
  if (!user.communityPrefs) user.communityPrefs = {};
  if (!user.communityPrefs.skin) {
    user.communityPrefs.skin = base._id;
    changed = true;
  }
  if (changed) await user.save({ validateModifiedOnly: true });
  return base;
}

module.exports = {
  getBase,
  isMember,
  assertMembership,
  defaultCommunityFor,
  ensureBaseMembership,
};
