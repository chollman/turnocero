const { isSameId } = require("./idCompare");

// Serializa un comentario (CompartidaComment o Comment de mesa) para el
// cliente: reemplaza el array crudo `likes` (refs a User) por `likeCount` +
// `liked` (si el `userId` dado está entre los likes). Así el cliente nunca
// recibe la lista de ids de likers — esa se pide aparte vía el endpoint
// "¿quién likeó?" cuando el usuario abre el modal.
//
// Acepta tanto un documento Mongoose como un objeto plano (`.toObject()`).
// `userId` puede ser null/undefined (anónimo) → `liked: false`.
function serializeComment(comment, userId) {
  if (!comment) return comment;
  const obj =
    typeof comment.toObject === "function" ? comment.toObject() : comment;
  const { likes, ...rest } = obj;
  const list = Array.isArray(likes) ? likes : [];
  return {
    ...rest,
    likeCount: list.length,
    liked: userId ? list.some((l) => isSameId(l, userId)) : false,
  };
}

module.exports = serializeComment;
