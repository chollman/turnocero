// Utilities para validar / parsear URLs de Board Game Arena.
//
// Usado por:
//  - MesaForm (Paso 5 — Extras / sub-bloque BGA) — el host pega un URL
//    y necesitamos validarlo antes de mandar el form.
//  - Indirectamente en TableBga vía la URL ya persistida en la mesa.
//
// La regex está duplicada en server/routes/tables.js (validator) y en
// server/models/Table.js (validate). Si se relaja o expande acá,
// actualizar también esos dos.

export const BGA_URL_REGEX =
  /^https?:\/\/(www\.)?boardgamearena\.com\/.*/i;

/**
 * Trimea y valida un URL de Board Game Arena. Si el user pegó algo sin
 * schema (`boardgamearena.com/...`), le agregamos `https://`. Devuelve
 * la URL canónica o `null` si no es de BGA.
 *
 * @param {string} input — URL completa o sin schema.
 * @returns {string|null} URL canónica o null.
 */
export function parseBgaUrl(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withSchema = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  if (!BGA_URL_REGEX.test(withSchema)) return null;
  return withSchema;
}
