// Minutos de lectura estimados desde HTML/texto (~200 palabras/min). Espejo del
// helper del server (server/utils/readingTime.js). Acepta HTML: lo reduce a
// texto plano antes de contar.

const WORDS_PER_MINUTE = 200;

export function readingMinutes(htmlOrText) {
  if (!htmlOrText || typeof htmlOrText !== "string") return 1;
  const text = htmlOrText.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function readingLabel(htmlOrText) {
  return `lectura ${readingMinutes(htmlOrText)} min`;
}
