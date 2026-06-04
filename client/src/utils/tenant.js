// Detección del "tenant" (subdominio de comunidad). Cuando la app se sirve en
// eslint-disable-next-line no-warning-comments
// `<slug>.turnocero.com`, todo el sitio se acota a esa comunidad. Esta util
// extrae el slug del host (o de un override de dev) para que:
//   - main.jsx mande el header `X-Community-Slug` en cada request, y
//   - CommunityContext entre en "modo tenant" (skin forzado, selector oculto).
//
// El dominio apex se configura con `VITE_TENANT_DOMAIN` (ej. "turnocero.com").
// Subdominios reservados que NUNCA son tenant: www / app / api, y el slug base
// "turnocero" (es el sitio principal multi-comunidad).

const RESERVED = new Set(["www", "app", "api", "turnocero"]);

function normalize(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function slugOrNull(sub) {
  const slug = normalize(sub);
  if (!slug || slug.includes(".") || RESERVED.has(slug)) return null;
  return { slug };
}

// Devuelve `{ slug }` si el request corresponde a un subdominio de comunidad, o
// `null`. Acepta overrides para testear sin tocar `window`.
export function detectTenant({
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
  search = typeof window !== "undefined" ? window.location.search : "",
} = {}) {
  // Override de desarrollo: ?tenant=<slug> (probar en localhost sin subdominios).
  try {
    const override = new URLSearchParams(search).get("tenant");
    if (override) return slugOrNull(override);
  } catch {
    /* search malformado → ignorar */
  }

  const host = normalize(hostname);
  if (!host) return null;

  // Dev: `<slug>.localhost` (los navegadores resuelven *.localhost a 127.0.0.1).
  if (host.endsWith(".localhost")) {
    return slugOrNull(host.slice(0, -".localhost".length));
  }

  // Producción: `<slug>.<VITE_TENANT_DOMAIN>`.
  const apex = normalize(import.meta.env.VITE_TENANT_DOMAIN);
  if (!apex) return null;
  const suffix = `.${apex}`;
  if (!host.endsWith(suffix)) return null;
  return slugOrNull(host.slice(0, -suffix.length));
}
