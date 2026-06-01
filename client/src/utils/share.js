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

export function buildCompartidaShare(post, origin = "") {
  const url = `${origin}/compartidas/${post._id}`;
  const parts = [];
  if (post.title) parts.push(`*${post.title}*`);
  const body = plainBody(post.body);
  if (body) parts.push(truncate(body));
  const caption = parts.join("\n");
  const whatsappText = caption ? `${caption}\n🎲 ${url}` : `🎲 ${url}`;
  return { url, caption, whatsappText };
}
