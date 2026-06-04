// Construye el CSS de override de una comunidad-skin. Se inyecta en un
// <style id="community-skin"> scopeado por `data-community`, en 3 bloques:
//   - acentos: aplican en ambos temas
//   - neutros dark / light: scopeados por `data-theme` (especificidad 0,3,0
//     para ganarle al base sin romper el tema opuesto)
//
// Las keys camelCase se mapean a CSS vars kebab: bgCard → --bg-card,
// textPrimary → --text-primary, amber → --amber.

export const cssVarName = (key) =>
  `--${String(key).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;

// Defensa en profundidad: el server ya sanitiza, pero re-validamos antes de
// inyectar al <style> (nunca CSS crudo).
const COLOR_RE =
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|^rgba?\([\d.,%/\s]+\)$/i;

function block(selector, tokens) {
  const decls = Object.entries(tokens || {})
    .filter(([, v]) => typeof v === "string" && COLOR_RE.test(v.trim()))
    .map(([k, v]) => `${cssVarName(k)}: ${v.trim()};`)
    .join(" ");
  return decls ? `${selector} { ${decls} }` : "";
}

// Devuelve el CSS de 3 bloques para una comunidad. "" si no hay nada que
// overridear (ej. la base, o un skin vacío).
export function buildSkinCss(slug, skin) {
  if (!slug || !skin) return "";
  const root = `:root[data-community="${slug}"]`;
  return [
    block(root, skin.accents),
    block(`:root[data-theme="dark"][data-community="${slug}"]`, skin.neutralsDark),
    block(
      `:root[data-theme="light"][data-community="${slug}"]`,
      skin.neutralsLight,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
