const express = require('express');
const router = express.Router();
const https = require('https');

router.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query || query.trim().length < 2) {
    return res.json({ items: [] });
  }

  const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query.trim())}&type=boardgame`;

  try {
    const searchXml = await fetchXML(searchUrl);
    if (searchXml.includes('<message>')) {
      return res.json({ items: [] });
    }

    const items = parseSearchXML(searchXml).slice(0, 12);
    if (items.length === 0) {
      return res.json({ items: [] });
    }

    const ids = items.map((i) => i.id).join(',');
    const thingUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${ids}&type=boardgame`;

    try {
      const thingXml = await fetchXML(thingUrl);
      const thumbnails = parseThumbnails(thingXml);
      items.forEach((item) => {
        item.thumbnail = thumbnails[item.id] || null;
      });
    } catch {
      // thumbnails are optional — return items without them on failure
    }

    res.json({ items });
  } catch {
    res.status(502).json({ message: 'Error al contactar BGG', items: [] });
  }
});

function fetchXML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (resp) => {
      if (resp.statusCode !== 200) {
        reject(new Error(`BGG returned ${resp.statusCode}`));
        return;
      }
      let data = '';
      resp.on('data', (chunk) => (data += chunk));
      resp.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('BGG timeout'));
    });
  });
}

function parseSearchXML(xml) {
  const items = [];
  const itemRegex = /<item type="boardgame" id="(\d+)">([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const id = match[1];
    const inner = match[2];
    const nameMatch = inner.match(/<name type="primary"[^>]*value="([^"]+)"/);
    const yearMatch = inner.match(/<yearpublished value="(\d+)"/);
    if (nameMatch) {
      items.push({
        id,
        name: decodeXMLEntities(nameMatch[1]),
        year: yearMatch ? yearMatch[1] : null,
        thumbnail: null,
      });
    }
  }
  return items;
}

function parseThumbnails(xml) {
  const thumbnails = {};
  const itemRegex = /<item type="boardgame" id="(\d+)">([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const id = match[1];
    const inner = match[2];
    const thumbMatch = inner.match(/<thumbnail>([^<]+)<\/thumbnail>/);
    if (thumbMatch) {
      let url = thumbMatch[1].trim();
      if (url.startsWith('//')) url = 'https:' + url;
      thumbnails[id] = url;
    }
  }
  return thumbnails;
}

function decodeXMLEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

module.exports = router;
