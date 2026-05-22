// Restringe un número a un rango [lo, hi]. Si el input no es un número
// finito (NaN, Infinity, undefined), devuelve `lo` como fallback seguro.
//
// Antes vivía como helper local en routes/torneos.js, donde parseInt
// puede devolver NaN si el query param o body field no es numérico.

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

module.exports = { clamp };
