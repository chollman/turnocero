const mongoose = require("mongoose");
const httpError = require("./httpError");
const { isSameId } = require("./idCompare");

// Visibilidad de una mesa para un user dado.
//
// Reglas:
//   - public  → siempre visible.
//   - private → visible para cualquier user autenticado (matchea comportamiento
//               histórico; el control de privacidad está en el join, no en la
//               discoverability).
//   - friends → visible solo si user es host, player, o el host está en
//               `friendIds`. Anónimos no la ven.
function canViewTable(table, user, friendIds = []) {
  if (!table) return false;
  const privacy = table.privacy || "public";

  if (privacy === "public") return true;
  if (!user) return false;

  if (isSameId(table.host?._id || table.host, user._id)) return true;
  if (
    Array.isArray(table.players) &&
    table.players.some((p) => isSameId(p?._id || p, user._id))
  ) {
    return true;
  }

  if (privacy === "private") return true;

  if (privacy === "friends") {
    const hostId = String(table.host?._id || table.host);
    return friendIds.some((id) => String(id) === hostId);
  }

  return false;
}

// Cláusula Mongo lista para spread en `Table.find({ ...buildPrivacyFilter() })`.
// - Anon: solo public.
// - Auth: public + private (cualquiera autenticado) + friends donde el host
//   esté en friendIds, OR el user sea host/player de la mesa (escape hatch).
function buildPrivacyFilter(user, friendIds = []) {
  if (!user) {
    return { privacy: "public" };
  }
  const friendObjectIds = friendIds
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  return {
    $or: [
      { privacy: { $in: ["public", "private"] } },
      { privacy: "friends", host: { $in: friendObjectIds } },
      { host: user._id },
      { players: user._id },
    ],
  };
}

// Gates server-side para acciones sociales que solo tienen sentido en mesas
// públicas: comentarios, valoraciones, follow, vincular a una Compartida.
function assertCanComment(table) {
  if ((table.privacy || "public") !== "public") {
    throw httpError(
      403,
      "Los comentarios solo se pueden agregar en mesas públicas",
    );
  }
}

function assertCanRate(table) {
  if ((table.privacy || "public") !== "public") {
    throw httpError(
      403,
      "Las valoraciones solo se pueden agregar en mesas públicas",
    );
  }
}

function assertCanFollow(table) {
  if ((table.privacy || "public") !== "public") {
    throw httpError(400, "Solo se pueden seguir mesas públicas");
  }
}

function assertLinkable(table) {
  if ((table.privacy || "public") !== "public") {
    throw httpError(
      403,
      "Solo se pueden vincular mesas públicas a Compartidas",
    );
  }
}

module.exports = {
  canViewTable,
  buildPrivacyFilter,
  assertCanComment,
  assertCanRate,
  assertCanFollow,
  assertLinkable,
};
