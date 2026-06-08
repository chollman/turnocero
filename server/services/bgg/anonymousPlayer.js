// "Jugador anónimo": un asiento ad-hoc en una partida que NO debe trackearse
// como compañero del dueño. BGG no tiene un campo "anónimo", así que el cliente
// lo carga con un NOMBRE RESERVADO ("Jugador anónimo N") y acá lo filtramos de
// las agregaciones que derivan identidades de co-jugadores (mis-jugadores,
// última juntada). El jugador SÍ existe en la partida (cuenta, score, posición,
// win) — sólo es invisible como identidad reutilizable.

// Regex espejo del cliente (client/src/pages/bg-watch/anonymousPlayer.js):
// prefijo reservado + número opcional, acento- y case-insensible, anclado.
const ANON_RE = /^\s*jugador an[oó]nimo(\s+\d+)?\s*$/i;

// Para usar dentro de pipelines de Mongo ($regexMatch). Sin anclar al final
// (alcanza con el prefijo + opcional número) para tolerar variantes de BGG.
const ANON_MONGO_REGEX = "^\\s*jugador an[oó]nimo";

function isAnonymousName(name) {
  return ANON_RE.test(String(name || ""));
}

module.exports = { isAnonymousName, ANON_MONGO_REGEX };
