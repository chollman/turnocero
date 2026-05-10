const express = require('express');
const router = express.Router();
const https = require('https');
const zlib = require('zlib');

const BGG_BASE = 'https://api.geekdo.com/xmlapi2';

const BGG_HEADERS = {
  'Accept': 'text/xml',
};

router.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query || query.trim().length < 2) {
    return res.json({ items: [] });
  }

  const searchUrl = `${BGG_BASE}/search?query=${encodeURIComponent(query.trim())}&type=boardgame`;

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
    const thingUrl = `${BGG_BASE}/thing?id=${ids}&type=boardgame`;

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
    // BGG unavailable — degrade gracefully
    res.json({ items: [] });
  }
});

function fetchXML(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: BGG_HEADERS, timeout: 10000 }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        resp.resume(); // drain body so socket is released
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        const next = resp.headers.location.startsWith('http')
          ? resp.headers.location
          : new URL(resp.headers.location, url).href;
        fetchXML(next, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }
      if (resp.statusCode !== 200) {
        resp.resume();
        reject(new Error(`BGG returned ${resp.statusCode}`));
        return;
      }

      const encoding = resp.headers['content-encoding'] || '';
      const chunks = [];
      resp.on('data', (chunk) => chunks.push(chunk));
      resp.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (encoding === 'gzip') {
          zlib.gunzip(buf, (err, decoded) =>
            err ? reject(err) : resolve(decoded.toString('utf8'))
          );
        } else if (encoding === 'deflate') {
          zlib.inflate(buf, (err, decoded) =>
            err ? reject(err) : resolve(decoded.toString('utf8'))
          );
        } else {
          resolve(buf.toString('utf8'));
        }
      });
      resp.on('error', reject);
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
  // Match <item> tags regardless of attribute order
  const itemRegex = /<item ([^>]+)>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const inner = match[2];
    const typeMatch = attrs.match(/type="([^"]+)"/);
    const idMatch = attrs.match(/id="(\d+)"/);
    if (!idMatch || !typeMatch || typeMatch[1] !== 'boardgame') continue;

    const nameMatch = inner.match(/<name [^>]*type="primary"[^>]*value="([^"]+)"/);
    const yearMatch = inner.match(/<yearpublished value="(\d+)"/);
    if (nameMatch) {
      items.push({
        id: idMatch[1],
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
  const itemRegex = /<item ([^>]+)>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const inner = match[2];
    const idMatch = attrs.match(/id="(\d+)"/);
    if (!idMatch) continue;
    const thumbMatch = inner.match(/<thumbnail>([^<]+)<\/thumbnail>/);
    if (thumbMatch) {
      let url = thumbMatch[1].trim();
      if (url.startsWith('//')) url = 'https:' + url;
      thumbnails[idMatch[1]] = url;
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
