// Minutos de lectura estimados a partir de texto plano (~200 palabras/min).
// Reutilizable; el cliente tiene su espejo en utils/readingTime.js.

const WORDS_PER_MINUTE = 200;

function readingMinutes(text) {
  if (!text || typeof text !== "string") return 1;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

module.exports = { readingMinutes, WORDS_PER_MINUTE };
