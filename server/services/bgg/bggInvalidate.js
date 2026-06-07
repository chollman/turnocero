// Costura ÚNICA para invalidar los caches derivados del log de partidas de un
// usuario. Los dos disparadores —editar una partida (POST/PUT/DELETE partidas)
// y curar un jugador (fusión / "sos vos" / renombre / avatar / bgg-username)—
// pasan por acá, así quedan simétricos: nunca uno invalida y el otro no.
//
// Hoy la capa derivada es chica: el cache L1 en memoria de partidas
// (clearPartidasCache) + el cache materializado "Mis juegos" (markUserGamesDirty,
// que lo marca sucio para reconstruir en la próxima lectura). Cualquier cache
// derivado futuro se agrega ACÁ y queda cableado en los ~9 call sites de una
// sola vez — ningún handler puede olvidarse de invalidarlo.
//
// Nota: las lecturas del overlay de curación son en vivo en casi todas las
// vistas, así que la mayoría ya queda fresca sin esto. El valor es mantener el
// invariante honesto el día que una stat se materialice.
//
// Acepta el bggUsername case-preserved: clearPartidasCache y markUserGamesDirty
// normalizan a lowercase internamente.

const { clearPartidasCache } = require("./bggCache");
const { markUserGamesDirty } = require("./bggUserGames");

async function invalidateOwnerDerived(bggUsername) {
  if (!bggUsername) return;
  clearPartidasCache(bggUsername);
  await markUserGamesDirty(bggUsername);
}

module.exports = { invalidateOwnerDerived };
