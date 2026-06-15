// Helper para actualizar el like de un comentario dentro del árbol de
// comentarios (top-level + replies de 1 nivel). El estado de comentarios es
// `comments[]`, cada uno con `replies[]`; un comentario puede estar en
// cualquiera de los dos niveles. Centraliza el map anidado que de otro modo
// se repetiría en CompartidaComments y TableComments (cf. handleEdit).
//
// Aplica `patch` (un objeto, normalmente `{ liked, likeCount }`) al comentario
// cuyo `_id === cid`, sin importar el nivel. Devuelve un nuevo array (inmutable).
export function patchCommentInTree(comments, cid, patch) {
  return comments.map((c) => {
    if (c._id === cid) return { ...c, ...patch };
    if (c.replies?.some((r) => r._id === cid)) {
      return {
        ...c,
        replies: c.replies.map((r) => (r._id === cid ? { ...r, ...patch } : r)),
      };
    }
    return c;
  });
}

// Calcula el patch de toggle de like a partir del estado actual de un
// comentario. `liked` nuevo = !liked; `likeCount` ±1 (clamp a 0).
export function toggleLikePatch(comment) {
  const nextLiked = !comment.liked;
  const nextCount = Math.max(
    0,
    (comment.likeCount || 0) + (nextLiked ? 1 : -1),
  );
  return { liked: nextLiked, likeCount: nextCount };
}
