// Helpers puros de ranking de búsqueda contra el catálogo BGG. La
// implementación es nuestra heurística client-side porque los endpoints
// "web" de BGG (`/search/boardgame`, `/geeksearch.php`) están detrás de
// Cloudflare desde Node — el TLS fingerprint de Node cae al challenge
// y solo el xmlapi2 (sin gating) responde con datos limpios. Ver
// `feedback-bgg-write-quirks` para el detalle.
//
// La heurística aproxima el ranking nativo de BGG: exact match >
// prefix-con-separador > word-boundary > substring. Tiebreak por
// nombre corto + año desc lo aplica el caller.

const { escapeRegex } = require("../../utils/regex");

// Quita artículos en inglés al inicio para normalizar el match. "The
// LOOP" matchea igual que "LOOP" para el bucket de relevancia.
// Aproxima lo que BGG hace con `sortindex` en su web (ignora "The",
// "A", "An").
function stripLeadingArticle(s) {
  return s.replace(/^(the|a|an)\s+/i, "");
}

// Bucket de relevancia (menor = mejor match) sobre el nombre
// normalizado. NO replica el factor de popularidad (no tenemos
// numowned/numratings en cache) — el tiebreak final lo agrega el caller
// con `name.length` y `year` desc.
//
// Buckets:
//   0 — match exacto
//   1 — prefix con separador típico: "LOOP: …", "LOOP - …", "LOOP's …"
//   2 — palabra completa en cualquier posición (word boundary)
//   3 — substring (cae adentro de otra palabra, ej. "loop" en "looping")
//   4 — no matchea (descartar)
function scoreSearchMatch(name, query) {
  const normalized = stripLeadingArticle(name).toLowerCase();
  const q = query.toLowerCase();
  if (normalized === q) return 0;
  if (
    normalized.startsWith(`${q} `) ||
    normalized.startsWith(`${q}:`) ||
    normalized.startsWith(`${q}-`) ||
    normalized.startsWith(`${q}'`) ||
    normalized.startsWith(`${q},`)
  )
    return 1;
  if (new RegExp(`\\b${escapeRegex(q)}\\b`, "i").test(normalized)) return 2;
  if (normalized.includes(q)) return 3;
  return 4;
}

module.exports = {
  stripLeadingArticle,
  scoreSearchMatch,
};
