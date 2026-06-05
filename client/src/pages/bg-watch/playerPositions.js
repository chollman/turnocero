// Derivación de posiciones a partir del puntaje, para el form de cargar/editar
// partidas. Espeja la regla que el server ya usa en partidas de grupos: mayor
// score = 1°, los empates COMPARTEN posición (competition ranking 1,2,2,4).
//
// `players[].score` es un string libre (puede ser "", "null", "negative-7"),
// así que reusamos `hasDisplayableScore` + un parse numérico con guarda. Los
// jugadores sin score numérico no se rankean: quedan al final, en su orden
// original (típico de cooperativos o cuando todavía no se cargó el puntaje).

import { hasDisplayableScore } from "./playerScore";

// Score numérico de un jugador, o null si no es un número mostrable.
function numericScore(p) {
  if (!hasDisplayableScore(p?.score)) return null;
  const n = Number(String(p.score).trim());
  return Number.isFinite(n) ? n : null;
}

// Comparador estable: numéricos por score desc; sin score al final; empate por
// orden original (índice). Recibe los scores ya parseados para no recalcular.
function makeComparator(nums) {
  return (a, b) => {
    const na = nums[a];
    const nb = nums[b];
    if (na === null && nb === null) return a - b;
    if (na === null) return 1;
    if (nb === null) return -1;
    if (nb !== na) return nb - na;
    return a - b;
  };
}

// Posiciones 1-based alineadas con `players` (mismo largo/orden que el input).
// Sin ningún score numérico → posición = orden del array (comportamiento
// histórico). Con scores → ranking desc con empates compartidos.
export function computePlayerPositions(players = []) {
  const nums = players.map(numericScore);
  if (!nums.some((n) => n !== null)) return players.map((_, i) => i + 1);

  const order = players.map((_, i) => i).sort(makeComparator(nums));

  const positions = new Array(players.length);
  let prevNum = null;
  let prevPos = 0;
  order.forEach((origIdx, rank) => {
    const n = nums[origIdx];
    // Solo empatan dos scores NUMÉRICOS iguales (null === null no cuenta).
    if (n !== null && n === prevNum) {
      positions[origIdx] = prevPos;
    } else {
      prevPos = rank + 1;
      positions[origIdx] = prevPos;
    }
    prevNum = n;
  });
  return positions;
}

// Copia de `players` ordenada por score desc (sin score al final, orden
// original estable). NO muta el input.
export function sortPlayersByScoreDesc(players = []) {
  const nums = players.map(numericScore);
  const cmp = makeComparator(nums);
  return players
    .map((_, i) => i)
    .sort(cmp)
    .map((i) => players[i]);
}
