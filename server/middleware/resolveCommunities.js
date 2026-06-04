const Community = require("../models/Community");

// ── resolveTenant ────────────────────────────────────────────────────────
//
// Middleware GLOBAL (montado en app.js antes de las rutas). Detecta si el
// request llega por el subdominio de una comunidad (single-tenant) leyendo el
// header `X-Community-Slug` que el cliente setea desde window.location.hostname
// (fallback `?tenant=` para hits directos a la API / crawlers). Resuelve el slug
// a su comunidad tenant (cacheada) y la deja en `req.tenant` (o null).
//
// Cuando NO hay slug (sitio principal — la mayoría del tráfico) no toca Mongo:
// setea req.tenant = null y sigue. Así un request normal nunca depende de este
// lookup. Con slug presente, un error real (Mongo caído) propaga vía next(err).
async function resolveTenant(req, res, next) {
  try {
    const slug = req.get("X-Community-Slug") || req.query.tenant;
    if (!slug) {
      req.tenant = null;
      return next();
    }
    req.tenant = await Community.resolveTenant(slug);
    next();
  } catch (err) {
    next(err);
  }
}

// ── resolveCommunities ───────────────────────────────────────────────────
//
// Middleware para endpoints de LISTA. Corre DESPUÉS del optionalAuth/protect
// de la ruta (que es quien puebla req.user) y resuelve:
//   - req.viewingCommunities: array de ids de comunidad cuyo contenido el
//     usuario quiere ver (feed combinado). SIEMPRE ≥1 (la base es el piso).
//   - req.skinCommunity: la comunidad cuyo skin aplica (single id).
//
// Invariante "nunca vacío": `community: { $in: [] }` matchearía CERO docs y
// vaciaría todas las listas — por eso siempre cae a [base].
async function resolveCommunities(req, res, next) {
  try {
    // Modo tenant (subdominio de comunidad): el contenido se acota SIEMPRE a esa
    // comunidad — anónimos, no-miembros y miembros por igual (vidriera pública).
    // Los filtros de privacy existentes se siguen componiendo aparte, así que el
    // contenido friends/private ajeno queda oculto igual que en el sitio normal.
    if (req.tenant) {
      req.viewingCommunities = [req.tenant._id];
      req.skinCommunity = req.tenant._id;
      return next();
    }

    const base = await Community.getBase();

    if (!req.user) {
      // Anónimo / crawler → solo la comunidad base.
      req.viewingCommunities = [base._id];
      req.skinCommunity = base._id;
      return next();
    }

    const memberships = (req.user.communityMemberships || [])
      .map((m) => m.community)
      .filter(Boolean);
    const M = memberships.length ? memberships : [base._id];

    // `viewing` es el subconjunto que el usuario eligió "ver juntas". Vacío =
    // todas las memberships. NUNCA confiar a ciegas: intersectar con M (el user
    // pudo dejar una comunidad y quedó una ref stale en sus prefs).
    const viewing = req.user.communityPrefs?.viewing || [];
    let effective;
    if (viewing.length) {
      const mset = new Set(M.map(String));
      effective = viewing.filter((v) => mset.has(String(v)));
    } else {
      effective = M;
    }
    if (!effective.length) effective = [base._id];

    req.viewingCommunities = effective;
    req.skinCommunity = req.user.communityPrefs?.skin || base._id;
    next();
  } catch (err) {
    next(err);
  }
}

// Cláusula de filtro para componer (como $and adicional) con los filtros de
// privacy existentes, sin tocarlos. Devuelve `{ community: { $in: [...] } }`.
function communityFilter(req) {
  return { community: { $in: req.viewingCommunities || [] } };
}

module.exports = { resolveTenant, resolveCommunities, communityFilter };
