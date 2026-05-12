const CRAWLER =
  /WhatsApp|facebookexternalhit|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|Googlebot/i

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default async function middleware(request) {
  const url = new URL(request.url)

  // Only handle /juntadas/<mongoId>
  const match = url.pathname.match(/^\/juntadas\/([a-f\d]{24})$/i)
  if (!match) return

  const ua = request.headers.get('user-agent') || ''
  if (!CRAWLER.test(ua)) return

  const apiUrl = process.env.VITE_API_URL
  if (!apiUrl) return

  const [, id] = match
  const postUrl = `${url.origin}/juntadas/${id}`

  try {
    const apiRes = await fetch(`${apiUrl}/api/juntadas/${id}/og`)
    if (!apiRes.ok) return
    const data = await apiRes.json()

    const title = data.title
      ? `${data.title} – Turnocero 🎲`
      : `Juntada de ${data.author} – Turnocero 🎲`
    const desc =
      data.body || 'Mirá esta juntada en Turnocero, la comunidad de juegos de mesa.'
    const image = data.image
      ? data.image.replace('/upload/', '/upload/w_1200,h_630,c_fill,g_auto/')
      : `${url.origin}/og-default.png`

    const html = `<!DOCTYPE html>
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
  <meta property="og:image:width"      content="1200">
  <meta property="og:image:height"     content="630">
  <meta property="og:image:alt"        content="${esc(title)}">
  <meta property="og:url"              content="${postUrl}">
  <meta property="og:locale"           content="es_AR">
  <meta property="og:site_name"        content="Turnocero">
  <meta name="twitter:card"            content="${data.image ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title"           content="${esc(title)}">
  <meta name="twitter:description"     content="${esc(desc)}">
  <meta name="twitter:image"           content="${image}">
  <meta http-equiv="refresh"           content="0; url=${postUrl}">
</head>
<body></body>
</html>`

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  } catch {
    return
  }
}

export const config = {
  matcher: '/juntadas/:id*',
}
