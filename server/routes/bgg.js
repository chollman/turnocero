const express = require('express');
const router = express.Router();
const https = require('https');

router.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query || query.trim().length < 2) {
    return res.json({ items: [] });
  }

  const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query.trim())}&type=boardgame`;

  try {
    const xml = await fetchXML(url);
    if (xml.includes('<message>')) {
      return res.json({ items: [] });
    }
    const items = parseSearchXML(xml);
    res.json({ items: items.slice(0, 12) });
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
      });
    }
  }
  return items;
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
