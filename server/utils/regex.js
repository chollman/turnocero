// Escapa los metacaracteres de RegExp en un string. Usado cuando se construye
// una RegExp dinámica con input del usuario o de la DB (p. ej. para búsquedas
// case-insensitive). Sin esto, un input como ".*" o "[a-z]" inyecta sintaxis
// regex y los resultados se rompen — o peor, ReDoS.
//
// Antes este patrón aparecía duplicado en 5 lugares
// (eventos.js, bgg.js ×2, tables.js, torneos.js) como
// `.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.

function escapeRegex(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
