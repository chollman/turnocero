// Parser uniforme de paginación. Antes cada router (eventos, tables,
// compartidas, etc.) hacía su propio Math.max/Math.min con límites distintos
// — eventos cap a 20, tables cap a 50 — y un typo silencioso podía romper
// la paginación de un endpoint sin warning.
//
// Uso:
//   const { page, limit, skip } = parsePagination(req.query); // 20 por default
//   const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });

const DEFAULTS = { defaultLimit: 20, maxLimit: 50 };

function parsePagination(query = {}, opts = {}) {
  const { defaultLimit, maxLimit } = { ...DEFAULTS, ...opts };
  const rawPage = parseInt(query.page, 10);
  const rawLimit = parseInt(query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const baseLimit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, baseLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = { parsePagination };
