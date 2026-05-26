const CRAWLER =
  /WhatsApp|facebookexternalhit|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|Googlebot/i;

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ogHtml({ title, desc, image, imageIsLarge, canonicalUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <meta name="description"             content="${esc(desc)}">
  <meta property="og:type"             content="article">
  <meta property="og:title"            content="${esc(title)}">
  <meta property="og:description"      content="${esc(desc)}">
  <meta property="og:image"            content="${image}">
  <meta property="og:image:secure_url" content="${image}">
  ${imageIsLarge ? '<meta property="og:image:width"      content="1200">\n  <meta property="og:image:height"     content="630">' : ""}
  <meta property="og:image:alt"        content="${esc(title)}">
  <meta property="og:url"              content="${canonicalUrl}">
  <meta property="og:locale"           content="es_AR">
  <meta property="og:site_name"        content="Turnocero">
  <meta name="twitter:card"            content="${imageIsLarge ? "summary_large_image" : "summary"}">
  <meta name="twitter:title"           content="${esc(title)}">
  <meta name="twitter:description"     content="${esc(desc)}">
  <meta name="twitter:image"           content="${image}">
  <meta http-equiv="refresh"           content="0; url=${canonicalUrl}">
</head>
<body></body>
</html>`;
}

async function handleCompartida(url, id, apiUrl) {
  const canonicalUrl = `${url.origin}/compartidas/${id}`;
  const apiRes = await fetch(`${apiUrl}/api/compartidas/${id}/og`);
  if (!apiRes.ok) return null;
  const data = await apiRes.json();

  const title = data.title
    ? `${data.title} – Turnocero 🎲`
    : `Compartida de ${data.author} – Turnocero 🎲`;
  const desc =
    data.body ||
    "Mirá esta compartida en Turnocero, la comunidad de juegos de mesa.";
  const hasImage = Boolean(data.image);
  const image = hasImage
    ? data.image.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto/")
    : `${url.origin}/og-default.png`;

  return ogHtml({ title, desc, image, imageIsLarge: hasImage, canonicalUrl });
}

async function handleEvento(url, id, apiUrl) {
  const canonicalUrl = `${url.origin}/eventos/${id}`;
  const apiRes = await fetch(`${apiUrl}/api/eventos/${id}/og`);
  if (!apiRes.ok) return null;
  const data = await apiRes.json();

  const title = `${data.title} – Evento en Turnocero 🎲`;
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
      : "Sumate a este evento en Turnocero, la comunidad de juegos de mesa.";

  const hasImage = Boolean(data.image);
  const image = hasImage
    ? data.image.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto/")
    : `${url.origin}/og-default.png`;

  return ogHtml({ title, desc, image, imageIsLarge: true, canonicalUrl });
}

async function handleBgWatch(url, bggUsername, apiUrl) {
  const canonicalUrl = `${url.origin}/bg-watch/${bggUsername}`;
  const apiRes = await fetch(
    `${apiUrl}/api/bgg/og/${encodeURIComponent(bggUsername)}`,
  );
  if (!apiRes.ok) return null;
  const data = await apiRes.json();

  const title = `BG Watch de ${data.displayName} – Turnocero 🎲`;

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
    : "Mirá el historial de partidas de este jugador en Turnocero.";

  const hasThumb = Boolean(data.topGame?.thumbnail);
  const image = hasThumb
    ? data.topGame.thumbnail
    : `${url.origin}/og-default.png`;

  // BGG thumbnails are roughly square, not the 1.91:1 ratio og:image expects.
  // Use the default OG image (1200×630) when no game thumbnail exists, summary card when we do.
  return ogHtml({ title, desc, image, imageIsLarge: !hasThumb, canonicalUrl });
}

export default async function middleware(request) {
  const url = new URL(request.url);

  const compartidaMatch = url.pathname.match(/^\/compartidas\/([a-f\d]{24})$/i);
  const eventoMatch = url.pathname.match(/^\/eventos\/([a-f\d]{24})$/i);
  const bgWatchMatch = url.pathname.match(/^\/bg-watch\/([^/]+)$/i);
  if (!compartidaMatch && !eventoMatch && !bgWatchMatch) return;

  const ua = request.headers.get("user-agent") || "";
  if (!CRAWLER.test(ua)) return;

  const apiUrl = process.env.VITE_API_URL;
  if (!apiUrl) return;

  try {
    let html = null;
    if (compartidaMatch) {
      html = await handleCompartida(url, compartidaMatch[1], apiUrl);
    } else if (eventoMatch) {
      html = await handleEvento(url, eventoMatch[1], apiUrl);
    } else if (bgWatchMatch) {
      html = await handleBgWatch(
        url,
        decodeURIComponent(bgWatchMatch[1]),
        apiUrl,
      );
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
  matcher: ["/compartidas/:id*", "/eventos/:id*", "/bg-watch/:username*"],
};
