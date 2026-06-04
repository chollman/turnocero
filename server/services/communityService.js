// Business logic de Comunidades. Los routers son plumbing HTTP delgado; acá
// vive la lógica testeable en aislamiento (patrón pareado con oauthService /
// eventoService / torneoService).

const Community = require("../models/Community");
const User = require("../models/User");
const SCOPED_MODELS = require("../config/scopedModels");
const { isSameId } = require("../utils/idCompare");
const httpError = require("../utils/httpError");

function getBase() {
  return Community.getBase();
}

function resolveBySlug(slug, { withCode = false } = {}) {
  const q = Community.findOne({ slug });
  if (withCode) q.select("+inviteCode");
  return q;
}

// ── Membership helpers ───────────────────────────────────────────────────

function isMember(user, communityId) {
  return (user?.communityMemberships || []).some((m) =>
    isSameId(m.community, communityId),
  );
}

function isSubadmin(user, communityId) {
  return (user?.communityMemberships || []).some(
    (m) => isSameId(m.community, communityId) && m.role === "subadmin",
  );
}

function assertMembership(user, communityId) {
  if (!isMember(user, communityId)) {
    throw httpError(403, "No sos miembro de esa comunidad");
  }
}

// ¿El usuario puede moderar (borrar/ocultar) este doc de contenido?
// Autor del doc, admin global, o subadmin de la comunidad del doc.
function canModerate(user, doc) {
  if (!user || !doc) return false;
  if (user.isAdmin) return true;
  if (doc.author && isSameId(doc.author, user._id)) return true;
  return !!(doc.community && isSubadmin(user, doc.community));
}

// Agrega la membership al doc (sin guardar). Regla viewing-on-join: si el user
// curó un `viewing` (no vacío), sumar la comunidad nueva para que no quede
// invisible en el feed combinado.
function addMembership(user, communityId, role = "member") {
  user.communityMemberships.push({ community: communityId, role });
  const viewing = user.communityPrefs?.viewing || [];
  if (viewing.length && !viewing.some((v) => isSameId(v, communityId))) {
    user.communityPrefs.viewing.push(communityId);
  }
}

// Saca la comunidad de las prefs (viewing) y, si era el skin, lo resetea a base.
async function pruneCommunityFromPrefs(user, communityId) {
  if (!user.communityPrefs) user.communityPrefs = {};
  user.communityPrefs.viewing = (user.communityPrefs.viewing || []).filter(
    (v) => !isSameId(v, communityId),
  );
  if (isSameId(user.communityPrefs.skin, communityId)) {
    const base = await getBase();
    user.communityPrefs.skin = base._id;
  }
}

// Comunidad por defecto para crear contenido: la del skin activo, o la base.
async function defaultCommunityFor(user) {
  if (user?.communityPrefs?.skin) return user.communityPrefs.skin;
  const base = await getBase();
  return base._id;
}

// Resuelve la comunidad de un contenido nuevo.
//   - En un subdominio tenant (`tenant` presente), el contenido SIEMPRE va a esa
//     comunidad e ignora lo que mande el cliente — pero la validación de
//     membresía sigue aplicando: un no-miembro no puede publicar (la vidriera es
//     read-only), un admin global sí.
//   - Si no hay tenant y el cliente mandó `requested`, valida membresía (admins
//     exentos) y usa esa.
//   - Si no, cae al default (skin activo ?? base).
async function resolveCreateCommunity(user, requested, tenant = null) {
  if (tenant) {
    const tid = tenant._id || tenant;
    if (!user?.isAdmin) assertMembership(user, tid);
    return tid;
  }
  if (requested) {
    if (!user?.isAdmin) assertMembership(user, requested);
    return requested;
  }
  return defaultCommunityFor(user);
}

// Garantiza membership base + skin base. Idempotente. Se llama en TODO alta de
// usuario (registro password + OAuth). Muta y persiste el doc.
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

// ── Join / leave ─────────────────────────────────────────────────────────

// `community` debe venir con +inviteCode si su joinPolicy es 'code'.
// Devuelve { status: 'joined' | 'pending' }.
async function joinCommunity(user, community, { code } = {}) {
  if (isMember(user, community._id)) {
    throw httpError(400, "Ya sos miembro de esta comunidad");
  }
  if (community.joinPolicy === "code") {
    if (!code || code !== community.inviteCode) {
      throw httpError(403, "Código de invitación inválido");
    }
  }
  if (community.joinPolicy === "approval") {
    const already = (community.pendingMembers || []).some((p) =>
      isSameId(p.user, user._id),
    );
    if (already) throw httpError(400, "Ya tenés una solicitud pendiente");
    community.pendingMembers.push({ user: user._id });
    await community.save();
    return { status: "pending" };
  }
  addMembership(user, community._id);
  await user.save({ validateModifiedOnly: true });
  return { status: "joined" };
}

async function leaveCommunity(user, community) {
  if (community.isBase) {
    throw httpError(403, "No podés salir de la comunidad base");
  }
  if (!isMember(user, community._id)) {
    throw httpError(400, "No sos miembro de esta comunidad");
  }
  user.communityMemberships = user.communityMemberships.filter(
    (m) => !isSameId(m.community, community._id),
  );
  await pruneCommunityFromPrefs(user, community._id);
  await user.save({ validateModifiedOnly: true });
}

// ── Moderación de membresías (subadmin/admin) ──────────────────────────────

// Acepta una solicitud pendiente → agrega la membership al solicitante.
// Devuelve el doc del solicitante (para notificar).
async function acceptRequest(community, userId) {
  const pending = (community.pendingMembers || []).find((p) =>
    isSameId(p.user, userId),
  );
  if (!pending) throw httpError(404, "Solicitud no encontrada");
  community.pendingMembers = community.pendingMembers.filter(
    (p) => !isSameId(p.user, userId),
  );
  await community.save();
  const requester = await User.findById(userId);
  if (requester && !isMember(requester, community._id)) {
    addMembership(requester, community._id);
    await requester.save({ validateModifiedOnly: true });
  }
  return requester;
}

async function rejectRequest(community, userId) {
  const pending = (community.pendingMembers || []).find((p) =>
    isSameId(p.user, userId),
  );
  if (!pending) throw httpError(404, "Solicitud no encontrada");
  community.pendingMembers = community.pendingMembers.filter(
    (p) => !isSameId(p.user, userId),
  );
  await community.save();
  return User.findById(userId);
}

async function expelMember(community, userId) {
  if (community.isBase) {
    throw httpError(403, "No podés expulsar de la comunidad base");
  }
  const user = await User.findById(userId);
  if (!user || !isMember(user, community._id)) {
    throw httpError(404, "El usuario no es miembro de la comunidad");
  }
  user.communityMemberships = user.communityMemberships.filter(
    (m) => !isSameId(m.community, community._id),
  );
  await pruneCommunityFromPrefs(user, community._id);
  await user.save({ validateModifiedOnly: true });
  return user;
}

async function setSubadmin(community, userId, makeSubadmin) {
  const user = await User.findById(userId);
  const membership = (user?.communityMemberships || []).find((m) =>
    isSameId(m.community, community._id),
  );
  if (!membership) {
    throw httpError(400, "El usuario no es miembro de la comunidad");
  }
  membership.role = makeSubadmin ? "subadmin" : "member";
  await user.save({ validateModifiedOnly: true });
  return user;
}

// ── Cascada de borrado ─────────────────────────────────────────────────────

async function countContent(community) {
  let total = 0;
  for (const { model } of SCOPED_MODELS) {
    total += await model.countDocuments({ community: community._id });
  }
  return total;
}

async function reassignContentToBase(community) {
  if (community.isBase) {
    throw httpError(400, "La comunidad base no se reasigna");
  }
  const base = await getBase();
  for (const { model } of SCOPED_MODELS) {
    await model.updateMany(
      { community: community._id },
      { $set: { community: base._id } },
    );
  }
  return base;
}

// Borra una comunidad: 403 si es base, 409 si tiene contenido (hay que
// reasignar primero). Purga las refs colgantes en TODOS los usuarios
// (membership, viewing, y skin → base).
async function deleteCommunity(community) {
  if (community.isBase) {
    throw httpError(403, "La comunidad base no se puede borrar");
  }
  if ((await countContent(community)) > 0) {
    throw httpError(
      409,
      "La comunidad tiene contenido. Reasignalo a la base antes de borrarla.",
    );
  }
  const base = await getBase();
  await User.updateMany(
    {},
    {
      $pull: {
        communityMemberships: { community: community._id },
        "communityPrefs.viewing": community._id,
      },
    },
  );
  await User.updateMany(
    { "communityPrefs.skin": community._id },
    { $set: { "communityPrefs.skin": base._id } },
  );
  await community.deleteOne();
}

// ── Directorio / notificaciones ────────────────────────────────────────────

// Conteo de miembros de UNA comunidad (lookup por índice). Para el detalle:
// evita el $unwind+$group sobre TODOS los usuarios que hace memberCounts().
async function memberCount(communityId) {
  return User.countDocuments({
    "communityMemberships.community": communityId,
  });
}

// Map<communityId(string), memberCount> en una sola aggregation.
async function memberCounts() {
  const rows = await User.aggregate([
    { $unwind: "$communityMemberships" },
    { $group: { _id: "$communityMemberships.community", count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const r of rows) map.set(String(r._id), r.count);
  return map;
}

// Ids de los miembros de UNA comunidad (lookup por índice). Lo usa la difusión
// dirigida de contenido (ej. el toast `noticia:published`) para no emitir en
// broadcast global a usuarios que ni integran la comunidad. `exclude` omite un
// id (típicamente el autor, que no necesita un toast de su propia publicación).
async function memberIds(communityId, { exclude } = {}) {
  const query = { "communityMemberships.community": communityId };
  if (exclude) query._id = { $ne: exclude };
  const users = await User.find(query).select("_id").lean();
  return users.map((u) => u._id);
}

// Ids de los destinatarios de una solicitud de unión: subadmins de la comunidad
// + admins globales (así una solicitud nunca queda sin moderador).
async function joinRequestRecipientIds(community) {
  const users = await User.find({
    $or: [
      { isAdmin: true },
      {
        communityMemberships: {
          $elemMatch: { community: community._id, role: "subadmin" },
        },
      },
    ],
  }).select("_id");
  return users.map((u) => u._id);
}

module.exports = {
  getBase,
  resolveBySlug,
  isMember,
  isSubadmin,
  assertMembership,
  canModerate,
  addMembership,
  defaultCommunityFor,
  resolveCreateCommunity,
  ensureBaseMembership,
  memberIds,
  joinCommunity,
  leaveCommunity,
  acceptRequest,
  rejectRequest,
  expelMember,
  setSubadmin,
  countContent,
  reassignContentToBase,
  deleteCommunity,
  memberCount,
  memberCounts,
  joinRequestRecipientIds,
};
