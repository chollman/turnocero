// Helpers para armar el contenido de "compartir" de una compartida.
//
// Separa el deeplink (`url`) del `caption` (título + body, SIN la url) para
// que cada destino la inserte una sola vez. El bug anterior duplicaba la URL
// en Telegram: el botón pasaba `url=<url>` Y `text=<texto>` donde el texto ya
// terminaba en "🎲 <url>", así que el deeplink aparecía dos veces.
//
//   - WhatsApp: solo acepta un campo de texto → `whatsappText` mete la url una vez.
//   - Telegram: `url=<url>` + `text=<caption>` (caption SIN url → sin duplicado).
//   - Copiar enlace: solo `url`.

const MAX_BODY = 180;

function truncate(text) {
  return text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}…` : text;
}

// El body de las reseñas es HTML enriquecido. Para el caption de compartir lo
// pasamos a texto plano (las juntadas usan texto plano y quedan intactas).
function plainBody(body) {
  return (body || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// `overrideUrl` (opcional): un short link ya resuelto. Si viene, reemplaza al
// deeplink largo en `url` y en `whatsappText` — los call sites pasan
// `shortUrl || undefined`, así sin short link cae al canónico.
export function buildCompartidaShare(post, origin = "", overrideUrl) {
  const url = overrideUrl || `${origin}/compartidas/${post._id}`;
  const parts = [];
  if (post.title) parts.push(`*${post.title}*`);
  const body = plainBody(post.body);
  if (body) parts.push(truncate(body));
  const caption = parts.join("\n");
  const whatsappText = caption ? `${caption}\n🎲 ${url}` : `🎲 ${url}`;
  return { url, caption, whatsappText };
}

// Compartir una noticia (artículo). Mismo contrato: caption SIN url (título +
// bajada/cuerpo en texto plano), whatsappText con la url una sola vez.
export function buildNoticiaShare(noticia, origin = "", overrideUrl) {
  const url = overrideUrl || `${origin}/noticias/${noticia._id}`;
  const parts = [];
  if (noticia.title) parts.push(`*${noticia.title}*`);
  const body = plainBody(noticia.dek || noticia.body);
  if (body) parts.push(truncate(body));
  const caption = parts.join("\n");
  const whatsappText = caption ? `${caption}\n🗞️ ${url}` : `🗞️ ${url}`;
  return { url, caption, whatsappText };
}

// Compartir una partida de BG Watch (página /bg-watch/:user/partidas/:playId).
// Mismo contrato que buildCompartidaShare: caption SIN url, whatsappText con
// la url exactamente una vez.
export function buildPartidaShare(play, bggUsername, origin = "", overrideUrl) {
  const url =
    overrideUrl ||
    `${origin}/bg-watch/${encodeURIComponent(bggUsername)}/partidas/${play.id}`;
  const parts = [];
  if (play.gameName) parts.push(`*Partida de ${play.gameName}*`);
  const meta = [play.date, play.location].filter(Boolean).join(" · ");
  if (meta) parts.push(meta);
  const caption = parts.join("\n");
  const whatsappText = caption ? `${caption}\n🎲 ${url}` : `🎲 ${url}`;
  return { url, caption, whatsappText };
}
