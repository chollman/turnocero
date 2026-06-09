const CRAWLER =
  /WhatsApp|facebookexternalhit|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|Googlebot/i;

// Marca por defecto del sitio. En un subdominio de comunidad se reemplaza por la
// de esa comunidad (ver `resolveTenantBrand`), para que los previews sociales
// muestren su nombre/logo en vez del genérico de TurnoCero.
const DEFAULT_BRAND = { name: "TurnoCero", tagline: "", logo: null };

// Subdominios reservados que NUNCA son tenant (espeja client/src/utils/tenant.js).
const RESERVED = new Set(["www", "app", "api", "turnocero"]);

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Deriva el slug de comunidad del `Host` (`<slug>.turnocero.app`) usando el apex
// de `VITE_TENANT_DOMAIN`. Devuelve null en el apex / subdominios reservados.
export function detectTenantSlug(hostname) {
  const apex = process.env.VITE_TENANT_DOMAIN;
  if (!apex || !hostname) return null;
  const host = hostname.toLowerCase();
  const suffix = `.${apex.toLowerCase()}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes(".") || RESERVED.has(slug)) return null;
  return slug;
}

// Trae la marca de la comunidad del subdominio. Sólo devuelve marca si la
// comunidad tiene `subdomainEnabled` (igual criterio que el cliente); si no,
// null → se usa la marca por defecto. brandName/tagline caen al `name`.
async function resolveTenantBrand(slug, apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/api/comunidades/${slug}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.subdomainEnabled) return null;
    const skin = data.skin || {};
    return {
      name: skin.brandName || data.name || "TurnoCero",
      tagline: skin.tagline || "",
      logo: skin.logoLight?.url || skin.logoDark?.url || null,
    };
  } catch {
    return null;
  }
}

function ogHtml({
  title,
  desc,
  image,
  imageIsLarge,
  canonicalUrl,
  siteName = "TurnoCero",
  ogType = "article",
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <meta name="description"             content="${esc(desc)}">
  <meta property="og:type"             content="${ogType}">
  <meta property="og:title"            content="${esc(title)}">
  <meta property="og:description"      content="${esc(desc)}">
  <meta property="og:image"            content="${image}">
  <meta property="og:image:secure_url" content="${image}">
  ${imageIsLarge ? '<meta property="og:image:width"      content="1200">\n  <meta property="og:image:height"     content="630">' : ""}
  <meta property="og:image:alt"        content="${esc(title)}">
  <meta property="og:url"              content="${canonicalUrl}">
  <meta property="og:locale"           content="es_AR">
  <meta property="og:site_name"        content="${esc(siteName)}">
  <meta name="twitter:card"            content="${imageIsLarge ? "summary_large_image" : "summary"}">
  <meta name="twitter:title"           content="${esc(title)}">
  <meta name="twitter:description"     content="${esc(desc)}">
  <meta name="twitter:image"           content="${image}">
  <meta http-equiv="refresh"           content="0; url=${canonicalUrl}">
</head>
<body></body>
</html>`;
}

// OG de la "vidriera" de un subdominio de comunidad (cuando se comparte la raíz
// `https://<slug>.turnocero.app`). Usa el logo de la comunidad como card cuadrada
// (summary); sin logo cae al og-default 1200×630.
function handleTenantRoot(url, brand) {
  const canonicalUrl = `${url.origin}/`;
  const title = `${brand.name} 🎲`;
  const desc =
    brand.tagline ||
    `Sumate a ${brand.name}, una comunidad de juegos de mesa en TurnoCero.`;
  const hasLogo = Boolean(brand.logo);
  const image = hasLogo ? brand.logo : `${url.origin}/og-default.png`;
  return ogHtml({
    title,
    desc,
    image,
    imageIsLarge: !hasLogo,
    canonicalUrl,
    siteName: brand.name,
    ogType: "website",
  });
}

async function handleCompartida(url, id, apiUrl, brand = DEFAULT_BRAND) {
  const canonicalUrl = `${url.origin}/compartidas/${id}`;
  const apiRes = await fetch(`${apiUrl}/api/compartidas/${id}/og`);
  if (!apiRes.ok) return null;
  const data = await apiRes.json();

  const title = data.title
    ? `${data.title} – ${brand.name} 🎲`
    : `Compartida de ${data.author} – ${brand.name} 🎲`;
  const desc =
    data.body ||
    `Mirá esta compartida en ${brand.name}, la comunidad de juegos de mesa.`;
  const hasImage = Boolean(data.image);
  const image = hasImage
    ? data.image.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto/")
    : `${url.origin}/og-default.png`;

  // Siempre card grande: con foto va la imagen de la compartida; sin foto va el
  // og-default.png (1200×630), así que el summary_large_image queda consistente
  // con eventos (antes, sin foto, caía a card chica).
  return ogHtml({
    title,
    desc,
    image,
    imageIsLarge: true,
    canonicalUrl,
    siteName: brand.name,
  });
}

async function handleEvento(url, id, apiUrl, brand = DEFAULT_BRAND) {
  const canonicalUrl = `${url.origin}/eventos/${id}`;
  const apiRes = await fetch(`${apiUrl}/api/eventos/${id}/og`);
  if (!apiRes.ok) return null;
  const data = await apiRes.json();

  const title = `${data.title} – Evento en ${brand.name} 🎲`;
  const descParts = [];
  if (data.eventDate) {
    try {
      const d = new Date(data.eventDate);
      descParts.push(
        d.toLocaleDateString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      );
    } catch {
      /* ignore */
    }
  }
  if (data.location) descParts.push(data.location);
  if (data.host) descParts.push(`organiza ${data.host}`);
  const desc = data.description
    ? data.description
    : descParts.length
      ? descParts.join(" · ")
      : `Sumate a este evento en ${brand.name}, la comunidad de juegos de mesa.`;

  const hasImage = Boolean(data.image);
  const image = hasImage
    ? data.image.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto/")
    : `${url.origin}/og-default.png`;

  return ogHtml({
    title,
    desc,
    image,
    imageIsLarge: true,
    canonicalUrl,
    siteName: brand.name,
  });
}

async function handleBgWatch(url, bggUsername, apiUrl, brand = DEFAULT_BRAND) {
  const canonicalUrl = `${url.origin}/bg-watch/${bggUsername}`;
  const apiRes = await fetch(
    `${apiUrl}/api/bgg/og/${encodeURIComponent(bggUsername)}`,
  );
  if (!apiRes.ok) return null;
  const data = await apiRes.json();

  const title = `BG Watch de ${data.displayName} – ${brand.name} 🎲`;

  const descParts = [];
  if (typeof data.partidas === "number") {
    descParts.push(
      `${data.partidas} ${data.partidas === 1 ? "partida registrada" : "partidas registradas"} en BGG`,
    );
  }
  if (typeof data.juegos === "number") {
    descParts.push(
      `${data.juegos} ${data.juegos === 1 ? "juego en colección" : "juegos en colección"}`,
    );
  }
  if (data.topGame?.name) {
    descParts.push(`más jugado: ${data.topGame.name}`);
  }
  const desc = descParts.length
    ? descParts.join(" · ")
    : `Mirá el historial de partidas de este jugador en ${brand.name}.`;

  const hasThumb = Boolean(data.topGame?.thumbnail);
  const image = hasThumb
    ? data.topGame.thumbnail
    : `${url.origin}/og-default.png`;

  // BGG thumbnails are roughly square, not the 1.91:1 ratio og:image expects.
  // Use the default OG image (1200×630) when no game thumbnail exists, summary card when we do.
  return ogHtml({
    title,
    desc,
    image,
    imageIsLarge: !hasThumb,
    canonicalUrl,
    siteName: brand.name,
  });
}

async function handleNoticia(url, id, apiUrl, brand = DEFAULT_BRAND) {
  const canonicalUrl = `${url.origin}/noticias/${id}`;
  const apiRes = await fetch(`${apiUrl}/api/noticias/${id}/og`);
  if (!apiRes.ok) return null;
  const data = await apiRes.json();

  const title = data.title
    ? `${data.title} – ${brand.name} 🎲`
    : `Noticia de ${brand.name} 🎲`;
  const desc =
    data.body ||
    `Novedades de ${brand.name}, la comunidad de juegos de mesa.`;
  const hasImage = Boolean(data.image);
  const image = hasImage
    ? data.image.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto/")
    : `${url.origin}/og-default.png`;

  return ogHtml({
    title,
    desc,
    image,
    imageIsLarge: true,
    canonicalUrl,
    siteName: brand.name,
  });
}

async function handleMesa(url, id, apiUrl, brand = DEFAULT_BRAND) {
  const canonicalUrl = `${url.origin}/mesas/${id}`;
  const apiRes = await fetch(`${apiUrl}/api/tables/${id}/og`);
  if (!apiRes.ok) return null;
  const data = await apiRes.json();

  const title = data.boardGame
    ? `${data.boardGame} – Mesa en ${brand.name} 🎲`
    : `Mesa en ${brand.name} 🎲`;

  const descParts = [];
  if (data.date) {
    try {
      const d = new Date(data.date);
      descParts.push(
        d.toLocaleDateString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      );
    } catch {
      /* ignore */
    }
  }
  if (data.location) descParts.push(data.location);
  if (data.host) descParts.push(`organiza ${data.host}`);
  const desc = descParts.length
    ? descParts.join(" · ")
    : `Sumate a esta mesa en ${brand.name}, la comunidad de juegos de mesa.`;

  // La imagen del juego viene de BGG (≈cuadrada, no 1.91:1) y NO está en
  // Cloudinary, así que no la podemos recortar a 1200×630. Igual que BG Watch:
  // card chica (summary) con la tapa del juego; sin imagen, og-default grande.
  const hasImage = Boolean(data.image);
  const image = hasImage ? data.image : `${url.origin}/og-default.png`;

  return ogHtml({
    title,
    desc,
    image,
    imageIsLarge: !hasImage,
    canonicalUrl,
    siteName: brand.name,
  });
}

// Sirve el OG de un recurso para un crawler, despachando por tipo. Reusado por
// los deep-links directos y por los short links (que resuelven a {type, ref}).
async function ogForResource(type, url, ref, apiUrl, brand) {
  if (type === "compartida") return handleCompartida(url, ref, apiUrl, brand);
  if (type === "evento") return handleEvento(url, ref, apiUrl, brand);
  if (type === "noticia") return handleNoticia(url, ref, apiUrl, brand);
  if (type === "bgwatch") return handleBgWatch(url, ref, apiUrl, brand);
  return null;
}

export default async function middleware(request) {
  const url = new URL(request.url);

  const shortMatch = url.pathname.match(/^\/s\/([A-Za-z0-9]+)$/);
  const compartidaMatch = url.pathname.match(/^\/compartidas\/([a-f\d]{24})$/i);
  const eventoMatch = url.pathname.match(/^\/eventos\/([a-f\d]{24})$/i);
  const noticiaMatch = url.pathname.match(/^\/noticias\/([a-f\d]{24})$/i);
  const mesaMatch = url.pathname.match(/^\/mesas\/([a-f\d]{24})$/i);
  const bgWatchMatch = url.pathname.match(/^\/bg-watch\/([^/]+)$/i);
  const tenantSlug = detectTenantSlug(url.hostname);
  const isRoot = url.pathname === "/" || url.pathname === "";
  // Sólo actuamos en short links, deep-links O en la raíz de un subdominio.
  if (
    !shortMatch &&
    !compartidaMatch &&
    !eventoMatch &&
    !noticiaMatch &&
    !mesaMatch &&
    !bgWatchMatch &&
    !(tenantSlug && isRoot)
  )
    return;

  const apiUrl = process.env.VITE_API_URL;
  if (!apiUrl) return;

  const ua = request.headers.get("user-agent") || "";
  const isCrawler = CRAWLER.test(ua);

  // En un subdominio de comunidad, la marca del preview es la de esa comunidad
  // (nombre/logo/tagline) en vez del genérico de TurnoCero.
  async function brandFor() {
    if (!tenantSlug) return DEFAULT_BRAND;
    return (await resolveTenantBrand(tenantSlug, apiUrl)) || DEFAULT_BRAND;
  }

  // Short link: resolvemos el destino. Humano → 302 al canónico; crawler →
  // servimos el OG del recurso apuntado (sin salto de redirect — más confiable
  // para WhatsApp). Un /s/ que no resuelve cae al SPA (que muestra NotFound).
  if (shortMatch) {
    try {
      const res = await fetch(`${apiUrl}/api/shortlinks/${shortMatch[1]}`);
      if (!res.ok) return;
      const { type, ref, path } = await res.json();
      if (!path) return;
      if (!isCrawler) return Response.redirect(`${url.origin}${path}`, 302);
      const html = await ogForResource(type, url, ref, apiUrl, await brandFor());
      if (!html) return;
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch {
      return;
    }
  }

  // Deep-links directos: sólo OG para crawlers (humanos caen al SPA).
  if (!isCrawler) return;

  try {
    const brand = await brandFor();
    let html = null;
    if (compartidaMatch) {
      html = await handleCompartida(url, compartidaMatch[1], apiUrl, brand);
    } else if (eventoMatch) {
      html = await handleEvento(url, eventoMatch[1], apiUrl, brand);
    } else if (noticiaMatch) {
      html = await handleNoticia(url, noticiaMatch[1], apiUrl, brand);
    } else if (mesaMatch) {
      html = await handleMesa(url, mesaMatch[1], apiUrl, brand);
    } else if (bgWatchMatch) {
      html = await handleBgWatch(
        url,
        decodeURIComponent(bgWatchMatch[1]),
        apiUrl,
        brand,
      );
    } else if (tenantSlug && isRoot && brand !== DEFAULT_BRAND) {
      // Vidriera del subdominio: sólo si la comunidad resolvió (subdomainEnabled).
      html = handleTenantRoot(url, brand);
    }
    if (!html) return;
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    // Edge runtime swallows the error — falling through returns undefined,
    // which Vercel interprets as "continue to the SPA shell".
  }
}

export const config = {
  // "/" cubre la vidriera de los subdominios de comunidad; el handler igual sale
  // temprano para no-crawlers y para el apex (sin tenant). "/s/:code" actúa para
  // humanos también (302 al canónico).
  matcher: [
    "/",
    "/s/:code*",
    "/compartidas/:id*",
    "/eventos/:id*",
    "/noticias/:id*",
    "/mesas/:id*",
    "/bg-watch/:username*",
  ],
};
