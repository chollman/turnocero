// Composición/parseo del campo `comments` de una partida de BGG.
//
// Al guardar, las notas del usuario se combinan con bloques estructurados que
// BGG renderiza: expansiones jugadas (links [thing=ID]…[/thing]), variante/
// tablero, y una firma invisible "@turnocero0" (sólo al crear). Al editar, se
// parsea de vuelta para mostrar SÓLO las notas del usuario (los bloques y la
// firma quedan fuera del textarea) y reconstruir los chips.

export const SIGNATURE = "@turnocero0";
const EXP_HEADER = "Played with expansions:";
const VARIANT_LABEL = "Variante/Tablero:";

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Arma el comentario final para BGG. Orden: notas, expansiones, variante, firma.
export function composeComments({
  notes = "",
  expansions = [],
  variant = "",
  sign = false,
} = {}) {
  const parts = [];
  const n = String(notes || "").trim();
  if (n) parts.push(n);

  const exp = (expansions || []).filter((e) => e && e.id && e.name);
  if (exp.length) {
    const lines = exp.map((e) => `- [thing=${e.id}]${e.name}[/thing]`);
    parts.push([EXP_HEADER, ...lines].join("\n"));
  }

  const v = String(variant || "").trim();
  if (v) parts.push(`${VARIANT_LABEL} ${v}`);

  if (sign) parts.push(SIGNATURE);

  return parts.join("\n\n");
}

// Separa un comentario crudo de BGG en { notes, expansions, variant, signed }.
// Quita la firma y los bloques estructurados (que se agregan en orden al final),
// dejando sólo las notas del usuario.
export function parseComments(raw) {
  let text = String(raw || "");

  // 1) Firma (al final).
  const signed = new RegExp(`\\n*${escapeRe(SIGNATURE)}\\s*$`).test(text);
  text = text.replace(new RegExp(`\\n*${escapeRe(SIGNATURE)}\\s*$`), "");

  // 2) Variante (línea al final).
  let variant = "";
  const vm = text.match(
    new RegExp(
      `(?:^|\\n)[ \\t]*${escapeRe(VARIANT_LABEL)}[ \\t]*([^\\n]+?)[ \\t]*$`,
    ),
  );
  if (vm) {
    variant = vm[1].trim();
    text = text.slice(0, vm.index).replace(/\s+$/, "");
  }

  // 3) Bloque de expansiones (al final).
  const expansions = [];
  const em = text.match(
    new RegExp(
      `(?:^|\\n)[ \\t]*${escapeRe(EXP_HEADER)}((?:\\n[ \\t]*-[ \\t]*\\[thing=\\d+\\][^\\n]*\\[/thing\\])+)\\s*$`,
    ),
  );
  if (em) {
    const re = /\[thing=(\d+)\]([^[]*)\[\/thing\]/g;
    let m;
    while ((m = re.exec(em[1])) !== null) {
      expansions.push({ id: Number(m[1]), name: m[2].trim() });
    }
    text = text.slice(0, em.index).replace(/\s+$/, "");
  }

  return { notes: text.trim(), expansions, variant, signed };
}
