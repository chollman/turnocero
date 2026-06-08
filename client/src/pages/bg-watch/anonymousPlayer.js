// "Jugador anónimo": un asiento ad-hoc en una partida que NO se trackea como
// compañero. BGG no tiene un campo "anónimo", así que se modela con un NOMBRE
// RESERVADO ("Jugador anónimo N") que el server filtra de la lista de
// compañeros y de "última juntada" (ver server/services/bgg/anonymousPlayer.js).
// El número es sólo para distinguir filas al cargar puntajes.

export const ANON_PREFIX = "Jugador anónimo";

// Regex espejo del server: prefijo reservado + número opcional. Acento-insensible
// (anónimo / anonimo) y case-insensible, por si la partida vino de BGG escrita
// distinto. Anclado para no marcar nombres que apenas contengan el prefijo.
const ANON_RE = /^\s*jugador an[oó]nimo(\s+\d+)?\s*$/i;

export function makeAnonName(n) {
  return `${ANON_PREFIX} ${n}`;
}

export function isAnonName(name) {
  return ANON_RE.test(String(name || ""));
}
