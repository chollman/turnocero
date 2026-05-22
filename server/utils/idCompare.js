// Comparación de ObjectIds tolerante a strings vs ObjectId instances.
// El patrón `a.toString() !== b.toString()` aparece ~180 veces en server/
// para validar ownership ("is este recurso del usuario que llama?"). Es
// trivial pero fácil de cagar: si una de las dos es null/undefined, el
// .toString() tira; si se compara `a === b` sin convertir, falla porque
// uno suele ser un ObjectId y el otro un string.

function isSameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

module.exports = { isSameId };
