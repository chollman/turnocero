const express = require("express");
const router = express.Router();
const { protect, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const { resolveCommunities } = require("../middleware/resolveCommunities");
const userRateLimit = require("../middleware/userRateLimit");
const User = require("../models/User");
const BggPlay = require("../models/BggPlay");
const logger = require("../utils/logger");
const { escapeRegex } = require("../utils/regex");
const { withUserLock } = require("../utils/bggSync");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

// Rate limits para endpoints caros (BGG-bound). El sync re-fetchea TODAS las
// pages de plays del user — es de lejos lo más caro que tenemos. Las
// mutations (POST/PUT/DELETE) hablan a geekplay.php que no es endpoint
// público de BGG; pegarle agresivo nos puede traer baneo. Per-user limits
// (no per-IP) porque todos los endpoints son authed.
const bggSyncLimiter = userRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3, // 3 full-syncs cada 5 min — más que suficiente para uso humano
  message: "Demasiados syncs con BGG, esperá unos minutos.",
});
const bggMutationLimiter = userRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30, // 30 partidas creadas/editadas/borradas cada 5 min
  message: "Demasiadas operaciones sobre BGG, esperá un momento.",
});
const {
  computeGameStats,
  computeOverallStats,
  computeActivityHeatmap,
  computeCoPlayerStats,
  computeLastJuntada,
  computePlayedGames,
  computeTopPlayedGame,
  computePlayedLocations,
  computeLocationRoster,
  computeLocationStats,
  computeGamePlayCount,
  computePlayedCoPlayers,
  computeGroupStats,
} = require("../services/bgg/bggAggregations");
const { parsePagination } = require("../utils/paginate");
const BggUserGame = require("../models/BggUserGame");
const {
  ensureFreshUserGames,
  normalizeForSearch,
} = require("../services/bgg/bggUserGames");
// `stripLeadingArticle` no se usa directamente acá pero vive en
// bggSearch junto a scoreSearchMatch para que el ranking de búsqueda
// quede en un solo módulo testeable.
const { scoreSearchMatch } = require("../services/bgg/bggSearch");
const { cache, getCached, setCached } = require("../services/bgg/bggCache");
const {
  getManualRefreshRemainingMs,
  stampManualRefresh,
} = require("../services/bgg/bggCooldown");
const {
  parser,
  parsePlaysXml,
  playToApi,
} = require("../services/bgg/bggParse");
const {
  BGG_API,
  fetchBgg,
  resolveGame,
  resolveGameExpansions,
  resolveGamesBatch,
  resolveCollection,
} = require("../services/bgg/bggResolve");
const {
  clearUserCache,
  reconcileFull,
  probe,
  stampProbeOutcome,
  triggerBackgroundReconcile,
  decidePlaysSyncAction,
} = require("../services/bgg/bggSyncEngine");
const {
  buildPlayForm,
  validatePlayBody,
  submitToGeekplay,
  verifyPlayOnBgg,
  upsertPlayFromBgg,
  createPlay,
} = require("../services/bgg/bggMutations");
const {
  notifyPlayParticipants,
  acknowledgeSharedPlay,
} = require("../services/bgg/bggPlayShare");
const Notification = require("../models/Notification");
const BggPlayerOverlay = require("../models/BggPlayerOverlay");
const { resolveUsersByBggUsernames } = require("../services/userLookup");
const multer = require("../config/multer");
const { uploadToCloudinary, cloudinary } = require("../config/cloudinary");
const {
  sanitizeRawKeys,
  loadOverlayIndex,
  loadSelfKeys,
  applyOverlayToCoPlayers,
  applyOverlayToPlayers,
  overlayToRow,
  getOrCreateOverlay,
  isLinkedToMember,
  rawKeyFor,
  firstUserKey,
  nameFromKeys,
} = require("../services/bgg/bggPlayerOverlay");
const { invalidateOwnerDerived } = require("../services/bgg/bggInvalidate");
const {
  sanitizeLocationKeys,
  loadLocationOverlayIndex,
  applyOverlayToLocations,
  overlayToLocationRow,
  getOrCreateLocationOverlay,
  nameFromKey: locationNameFromKey,
} = require("../services/bgg/bggLocationOverlay");
const BggLocationOverlay = require("../models/BggLocationOverlay");
const BggGameVariant = require("../models/BggGameVariant");
const {
  connectedMemberUsernames,
  communityMemberUsernames,
  topCommunityGames,
  gameCommunityStats,
  gameOwners,
  communityPlayerLeaderboard,
  communityWinRates,
  communityStreaks,
  headToHead,
  communityActivityFeed,
  communityActivityHeatmap,
  playerGameRank,
} = require("../services/bgg/bggCommunityStats");

router.use(requireSection("bgwatch"));

// Fecha de corte (YYYY-MM-DD) `n` días atrás, para los filtros de período del
// hub de comunidad ("en llamas" = últimos 30 días, heatmap = último año).
function daysAgoStr(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Hub de comunidad (cross-user) ─────────────────────────────────────────
// Todos read-only, gateados por `bgwatch` (router.use arriba). El scope por
// comunidad (fase 2) se resuelve en `communityScope`: deriva
// `req.viewingCommunities` (resolveCommunities) y de ahí la allowlist de
// bggUsernames de esos miembros (`req.bggScope`). En global / viendo la base
// queda `null` (sin filtro), preservando el comportamiento histórico.

// Deriva `req.bggScope` (null = global | [usernames] = comunidad activa) a
// partir de `req.viewingCommunities`. Corre después de resolveCommunities.
async function attachBggScope(req, res, next) {
  try {
    req.bggScope = await communityMemberUsernames(req.viewingCommunities);
    next();
  } catch (err) {
    next(err);
  }
}

// Cadena reusable para los endpoints del hub que aceptan scope de comunidad.
const communityScope = [optionalAuth, resolveCommunities, attachBggScope];

// GET /api/bgg/comunidad/juegos?periodo=all|mes&limit=
router.get(
  "/comunidad/juegos",
  communityScope,
  asyncHandler(async (req, res) => {
    const periodo = req.query.periodo === "mes" ? "mes" : "all";
    const limit = Math.min(
      48,
      Math.max(1, parseInt(req.query.limit, 10) || 12),
    );
    const sinceDate = periodo === "mes" ? daysAgoStr(30) : null;
    const games = await topCommunityGames({
      limit,
      sinceDate,
      bggUsernames: req.bggScope,
    });
    res.json({ periodo, games });
  }),
);

// GET /api/bgg/comunidad/juego/:gameId — stats + dueños (solo miembros).
router.get(
  "/comunidad/juego/:gameId",
  communityScope,
  asyncHandler(async (req, res) => {
    const { gameId } = req.params;
    if (!/^\d+$/.test(gameId)) throw httpError(400, "gameId inválido");
    // gameOwners SIEMPRE necesita una allowlist de miembros (ver su doc). En
    // modo global (req.bggScope === null) usamos todos los miembros conectados;
    // con scope de comunidad, ese subconjunto.
    const ownerScope = req.bggScope || (await connectedMemberUsernames());
    const [game, stats, owners] = await Promise.all([
      resolveGame(gameId),
      gameCommunityStats(gameId, { bggUsernames: req.bggScope }),
      gameOwners(gameId, { bggUsernames: ownerScope }),
    ]);
    res.json({ game, stats, owners });
  }),
);

// GET /api/bgg/comunidad/jugadores?metric=plays|variedad|winrate|racha&periodo=
router.get(
  "/comunidad/jugadores",
  communityScope,
  asyncHandler(async (req, res) => {
    const metric = req.query.metric || "plays";
    const periodo = req.query.periodo === "mes" ? "mes" : "all";
    const sinceDate = periodo === "mes" ? daysAgoStr(30) : null;
    const bggUsernames = req.bggScope;

    let players;
    if (metric === "winrate") {
      players = await communityWinRates({ minPlays: 5, bggUsernames });
    } else if (metric === "racha") {
      players = await communityStreaks({ bggUsernames });
    } else {
      const m = metric === "variedad" ? "variedad" : "plays";
      players = await communityPlayerLeaderboard({
        metric: m,
        sinceDate,
        bggUsernames,
      });
    }
    res.json({ metric, periodo, players });
  }),
);

// GET /api/bgg/comunidad/h2h/:userA/:userB
// Sin scope: es estrictamente entre dos usuarios nombrados.
router.get(
  "/comunidad/h2h/:userA/:userB",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const a = req.params.userA.toLowerCase();
    const b = req.params.userB.toLowerCase();
    if (a === b) throw httpError(400, "Elegí dos usuarios distintos");
    const result = await headToHead(a, b);
    res.json(result);
  }),
);

// GET /api/bgg/comunidad/actividad?page=&limit=
router.get(
  "/comunidad/actividad",
  communityScope,
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 40,
    });
    const feed = await communityActivityFeed({
      page,
      limit,
      bggUsernames: req.bggScope,
    });
    res.json(feed);
  }),
);

// GET /api/bgg/comunidad/heatmap — partidas por día del último año.
router.get(
  "/comunidad/heatmap",
  communityScope,
  asyncHandler(async (req, res) => {
    const heatmap = await communityActivityHeatmap({
      sinceDate: daysAgoStr(365),
      bggUsernames: req.bggScope,
    });
    res.json({ heatmap });
  }),
);

// GET /api/bgg/comunidad/rank/:bggUsername/:gameId — posición del usuario en
// ese juego dentro de la comunidad (insight personal en la vista per-game).
router.get(
  "/comunidad/rank/:bggUsername/:gameId",
  communityScope,
  asyncHandler(async (req, res) => {
    const { bggUsername, gameId } = req.params;
    if (!/^\d+$/.test(gameId)) throw httpError(400, "gameId inválido");
    const rank = await playerGameRank(bggUsername.toLowerCase(), gameId, {
      bggUsernames: req.bggScope,
    });
    res.json({ rank });
  }),
);

// El sync engine (probe + reconcile + slot management) vive en
// services/bgg/bggSyncEngine.js. Las mutations contra geekplay.php
// (POST/PUT/DELETE partidas) viven en services/bgg/bggMutations.js.
// Acá solo quedan los handlers HTTP.

// GET /api/bgg/search?q=<query>
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").trim();
    if (q.length < 3) return res.json([]);

    const cacheKey = `search:${q.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // try/catch interno: el contrato es responder 502 con mensaje custom de
    // "No se pudo conectar con BGG" cuando fetchBgg falla — no queremos
    // exponer detalles del upstream. asyncHandler envuelve igual para
    // cualquier rejection que se escape.
    try {
      const xml = await fetchBgg(
        `${BGG_API}/search?query=${encodeURIComponent(q)}&type=boardgame`,
      );
      const parsed = parser.parse(xml);

      const root = parsed?.items;
      if (!root) return res.json([]);

      const rawItems = root.item || [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      const results = items
        .map((item) => {
          const nameRaw = item.name;
          const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
          const primary =
            nameArr.find((n) => n["@_type"] === "primary") || nameArr[0];
          const name = primary?.["@_value"] || "";
          const year = item.yearpublished?.["@_value"]
            ? Number(item.yearpublished["@_value"])
            : null;
          return {
            id: Number(item["@_id"]),
            name,
            year,
            thumbnail: null,
            image: null,
          };
        })
        .filter((g) => g.name)
        // Ranking por relevancia (bucket de match → nombre corto → año desc).
        // xmlapi2/search no devuelve los items en ningún orden útil; este sort
        // los pone más cerca del orden que BGG usa en su autocomplete (que está
        // gateado por Cloudflare desde Node, ver historia de PR).
        .sort((a, b) => {
          const sa = scoreSearchMatch(a.name, q);
          const sb = scoreSearchMatch(b.name, q);
          if (sa !== sb) return sa - sb;
          if (a.name.length !== b.name.length)
            return a.name.length - b.name.length;
          return (b.year || 0) - (a.year || 0);
        })
        .slice(0, 30);

      // Batch-resolve thumbnails + images (memoria → Mongo → BGG, compartido entre usuarios)
      if (results.length > 0) {
        try {
          const gamesMap = await resolveGamesBatch(results.map((g) => g.id));
          results.forEach((g) => {
            const game = gamesMap.get(g.id);
            g.thumbnail = game?.thumbnail || null;
            g.image = game?.image || null;
          });
        } catch {
          // thumbnails son opcionales, no bloqueamos el resultado
        }
      }

      setCached(cacheKey, results);
      res.json(results);
    } catch {
      throw httpError(502, "No se pudo conectar con BGG");
    }
  }),
);

// GET /api/bgg/game/:id
router.get(
  "/game/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) throw httpError(400, "Invalid game ID");

    try {
      const game = await resolveGame(id);
      if (!game) throw httpError(404, "Juego no encontrado");
      res.json(game);
    } catch (err) {
      if (err.isExplicit) throw err; // propaga el 404 ya armado
      if (err.status === 404) throw httpError(404, "Juego no encontrado");
      throw httpError(502, "No se pudo conectar con BGG");
    }
  }),
);

// GET /api/bgg/game/:id/expansiones — expansiones del juego (para el picker
// "Expansiones jugadas"). Devuelve [{ id, name }].
router.get(
  "/game/:id/expansiones",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) throw httpError(400, "Invalid game ID");
    try {
      const items = await resolveGameExpansions(id);
      res.json({ items });
    } catch (err) {
      if (err.status === 404) {
        res.json({ items: [] });
        return;
      }
      throw httpError(502, "No se pudo conectar con BGG");
    }
  }),
);

// GET /api/bgg/variantes/:bggUsername/:gameId — variantes/tableros que el
// usuario ya cargó para ese juego (autocompletado del picker). Texto libre
// persistido en BggGameVariant.
router.get(
  "/variantes/:bggUsername/:gameId",
  asyncHandler(async (req, res) => {
    const lower = String(req.params.bggUsername || "").toLowerCase();
    const gameId = String(req.params.gameId || "");
    const items = await BggGameVariant.find({ bggUsername: lower, gameId })
      .sort({ lastUsedAt: -1 })
      .limit(50)
      .select("name -_id")
      .lean();
    res.json({ items: items.map((v) => v.name) });
  }),
);

// GET /api/bgg/coleccion/:bggUsername
router.get(
  "/coleccion/:bggUsername",
  asyncHandler(async (req, res) => {
    const { bggUsername } = req.params;
    const forceRefresh = req.query.refresh === "1";

    // Server-side cooldown for the manual "Actualizar" button (60s per panel).
    // Applies to anyone hitting ?refresh=1 — the client only shows the button
    // to owner/admin, but we throttle here regardless of auth. 429 con header
    // X-Refresh-Cooldown-Ms y retryAfterMs en el body — necesita res.status
    // directo para preservar la forma.
    if (forceRefresh) {
      const remaining = await getManualRefreshRemainingMs(
        bggUsername,
        "coleccion",
      );
      if (remaining > 0) {
        res.setHeader("X-Refresh-Cooldown-Ms", String(remaining));
        return res.status(429).json({
          message: `Esperá ${Math.ceil(remaining / 1000)}s antes de actualizar.`,
          retryAfterMs: remaining,
        });
      }
      await stampManualRefresh(bggUsername, "coleccion");
    }

    try {
      const collection = await resolveCollection(bggUsername, { forceRefresh });
      const remaining = await getManualRefreshRemainingMs(
        bggUsername,
        "coleccion",
      );
      res.setHeader("X-Refresh-Cooldown-Ms", String(remaining));
      res.json(collection);
    } catch (err) {
      if (err.status === 404) {
        throw httpError(404, err.message || "Usuario de BGG no encontrado");
      }
      throw httpError(502, "No se pudo conectar con BGG");
    }
  }),
);

// GET /api/bgg/partidas/:bggUsername
const PAGE_SIZE = 10;
const BGG_PAGE_SIZE = 30;
const PAGES_PER_BGG = BGG_PAGE_SIZE / PAGE_SIZE; // 3 client pages per BGG page

// Aggregates per-game stats for the user — used by the /bg-watch/:user/juego/:gameId
// view to show stats over the entire history instead of just the visible page.
// "Owner" is the player whose username matches `bggUsername` case-insensitively
// (BGG returns the account holder among the play's players).
//
// Returns { wins, rated, avgDuration, lastDate } where rated is the number of
// plays in which we could identify the owner (plays without a matching player
// are excluded from the win rate denominator).
// GET /api/bgg/juegos-jugados/:bggUsername — list of games the user has
// played, derived from BggPlay aggregation. Returns [] when the user has
// no plays in Mongo so the client can fall back to the collection-derived
// list (only useful for users on the L1/L3 fallback path; for synced
// users the server-derived list is authoritative).
router.get(
  "/juegos-jugados/:bggUsername",
  asyncHandler(async (req, res) => {
    const { bggUsername } = req.params;
    const lower = bggUsername.toLowerCase();
    try {
      const items = await computePlayedGames(lower);
      res.json(items);
    } catch (err) {
      logger.error("[bgg/juegos-jugados] aggregation failed", {
        bggUsername: lower,
        error: err.message,
      });
      throw httpError(500, "No se pudieron computar los juegos jugados");
    }
  }),
);

// GET /api/bgg/resumen/:bggUsername — agregados para el sidebar del perfil de
// BG Watch (widgets de heatmap de actividad + win-rate). Se computa UNA vez por
// perfil (independiente de la paginación/filtro de la lista de partidas), por
// eso no se cuelga de /partidas. Derivado del log COMPLETO de BggPlay, así que
// win-rate y totales son correctos sin importar qué página se ve. Público
// (optionalAuth), igual que el resto de las lecturas de BG Watch.
router.get(
  "/resumen/:bggUsername",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const selfKeys = await loadSelfKeys(lower);
    const [overallStats, heatmap] = await Promise.all([
      computeOverallStats(lower, { selfKeys }),
      // ~13 semanas atrás (la grilla del heatmap muestra 13 columnas).
      computeActivityHeatmap(lower, { sinceDate: daysAgoStr(91) }),
    ]);
    res.json({ overallStats, heatmap });
  }),
);

// GET /api/bgg/mis-juegos/:bggUsername — selector paginado al cargar partidas.
// Sirve desde el cache materializado BggUserGame (ludoteca ∪ juegos jugados),
// reconstruido lazy si está viejo/sucio. Soporta ?page, ?limit y ?q (búsqueda
// por nombre accent/case-insensitive). Orden: más recientemente jugado primero.
router.get(
  "/mis-juegos/:bggUsername",
  asyncHandler(async (req, res) => {
    const { bggUsername } = req.params;
    const lower = bggUsername.toLowerCase();
    await ensureFreshUserGames(bggUsername);

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    const filter = { bggUsername: lower };
    const q = (req.query.q || "").trim();
    if (q) filter.searchName = new RegExp(escapeRegex(normalizeForSearch(q)));
    const sort = { lastPlayedDate: -1, numPlays: -1, name: 1, gameId: 1 };

    const [total, rows] = await Promise.all([
      BggUserGame.countDocuments(filter),
      BggUserGame.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    res.json({
      items: rows.map((r) => ({
        id: r.gameId,
        name: r.name,
        thumbnail: r.thumbnail,
        image: r.image,
        year: r.year,
        numPlays: r.numPlays,
        lastPlayedDate: r.lastPlayedDate,
        owned: r.owned,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }),
);

// GET /api/bgg/mis-ubicaciones/:bggUsername — selector paginado de ubicaciones
// al cargar partidas. Deriva las ubicaciones distintas de las partidas del
// usuario (computePlayedLocations) — siempre fresco, sin materializar. Soporta
// ?page, ?limit y ?q (búsqueda por nombre accent/case-insensitive, substring).
// Orden: más recientemente usada primero, luego más partidas, luego alfabético.
router.get(
  "/mis-ubicaciones/:bggUsername",
  asyncHandler(async (req, res) => {
    const { bggUsername } = req.params;
    const lower = bggUsername.toLowerCase();

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    let items = await computePlayedLocations(lower);

    const q = (req.query.q || "").trim();
    if (q) {
      const needle = normalizeForSearch(q);
      items = items.filter((it) =>
        normalizeForSearch(it.name).includes(needle),
      );
    }

    items.sort((a, b) => {
      const da = a.lastPlayedDate || "";
      const db = b.lastPlayedDate || "";
      if (da !== db) return db.localeCompare(da); // recencia desc
      if (a.numPlays !== b.numPlays) return b.numPlays - a.numPlays;
      return a.name.localeCompare(b.name);
    });

    const total = items.length;
    res.json({
      items: items.slice(skip, skip + limit),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }),
);

// GET /api/bgg/mis-jugadores/:bggUsername — selector paginado de compañeros al
// agregar un jugador. Deriva los compañeros distintos de las partidas del
// usuario (computePlayedCoPlayers) — siempre fresco. Soporta ?page, ?limit y ?q
// (busca por nombre o username, accent/case-insensitive). Orden: más reciente
// primero, luego más partidas juntos, luego alfabético.
router.get(
  "/mis-jugadores/:bggUsername",
  asyncHandler(async (req, res) => {
    const { bggUsername } = req.params;
    const lower = bggUsername.toLowerCase();

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const rawCoPlayers = await computePlayedCoPlayers(lower);
    // Aplicar el overlay de curación: nombres/avatares editados y duplicados
    // fusionados se reflejan también en el selector del form de carga.
    const overlayIndex = await loadOverlayIndex(lower);
    // Los jugadores marcados "sos vos" (isSelf) no deben aparecer como
    // compañeros en el selector de carga de partidas.
    let items = applyOverlayToCoPlayers(rawCoPlayers, overlayIndex, {
      excludeSelf: true,
    });

    const q = (req.query.q || "").trim();
    if (q) {
      const needle = normalizeForSearch(q);
      items = items.filter(
        (it) =>
          normalizeForSearch(it.name).includes(needle) ||
          normalizeForSearch(it.username).includes(needle),
      );
    }

    items.sort((a, b) => {
      const da = a.lastPlayedDate || "";
      const db = b.lastPlayedDate || "";
      if (da !== db) return db.localeCompare(da); // recencia desc
      if (a.numPlays !== b.numPlays) return b.numPlays - a.numPlays;
      return (a.name || "").localeCompare(b.name || "");
    });

    const total = items.length;
    res.json({
      items: items.slice(skip, skip + limit),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }),
);

// GET /api/bgg/ultima-juntada/:bggUsername — roster (nombre + @BGG) + ubicación
// de la partida más reciente del usuario, para el botón "Usar última juntada"
// del form de carga. Devuelve { juntada: null } si no hay partidas.
router.get(
  "/ultima-juntada/:bggUsername",
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const juntada = await computeLastJuntada(lower);
    res.json({ juntada });
  }),
);

// Cuántas páginas de plays (100 c/u) escanear en BGG cuando un usuario sin
// espejo en Mongo abre una partida para editar por deep-link/refresh. Lo común
// es editar una partida reciente, que está en las primeras páginas (orden
// fecha desc), así que un cap acotado cubre el caso normal sin barrer todo.
const PARTIDA_BGG_SCAN_PAGES = 10;

// Busca una partida puntual directamente en BGG (fallback cuando no hay espejo
// en Mongo). El XML API no filtra por play id, así que escaneamos páginas hasta
// encontrarla o agotar el cap/total. Devuelve la play parseada (con thumbnail
// resuelto best-effort) o null.
async function findPlayOnBgg(bggUsername, playId) {
  const wanted = String(playId);
  for (let page = 1; page <= PARTIDA_BGG_SCAN_PAGES; page++) {
    let xml;
    try {
      xml = await fetchBgg(
        `${BGG_API}/plays?username=${encodeURIComponent(bggUsername)}&page=${page}`,
      );
    } catch {
      return null;
    }
    const parsed = parsePlaysXml(xml);
    if (!parsed || parsed.plays.length === 0) return null;
    const match = parsed.plays.find((p) => p.playId === wanted);
    if (match) {
      if (match.gameId) {
        try {
          const game = await resolveGame(match.gameId);
          match.gameThumbnail = game?.thumbnail || null;
        } catch {
          /* thumbnail opcional */
        }
      }
      return match;
    }
    if (parsed.total && page * 100 >= parsed.total) return null;
  }
  return null;
}

// GET /api/bgg/partida/:bggUsername/:playId — precarga una partida para editar
// (singular `partida` para no chocar con `/partidas/:bggUsername`). Solo el
// dueño (case-insensitive) o un admin. Devuelve la shape que consume el form.
router.get(
  "/partida/:bggUsername/:playId",
  protect,
  asyncHandler(async (req, res) => {
    const { bggUsername, playId } = req.params;
    const lower = bggUsername.toLowerCase();
    const isOwner =
      req.user.bggUsername && req.user.bggUsername.toLowerCase() === lower;
    if (!isOwner && !req.user.isAdmin) {
      throw httpError(403, "No podés editar partidas de otro usuario");
    }
    const play = await BggPlay.findOne({ bggUsername: lower, playId }).lean();
    if (play) return res.json(playToApi(play));

    // Sin espejo en Mongo (el usuario nunca corrió sync): la creamos sin
    // espejar, así que findOne falla. Antes esto era un 404 al refrescar/abrir
    // por deep-link el form de edición. Buscamos la partida directo en BGG; la
    // lista del perfil dispara el reconcile que autosana futuras visitas.
    const fromBgg = await findPlayOnBgg(bggUsername, playId);
    if (!fromBgg) throw httpError(404, "Partida no encontrada");
    res.json(playToApi(fromBgg));
  }),
);

// GET /api/bgg/partida/:bggUsername/:playId/detalle — detalle PÚBLICO de una
// partida (página /bg-watch/:user/partidas/:playId, compartible por short
// link). Misma data que ya expone el listado público de /partidas, con el
// overlay de curación aplicado, más los datos del juego (imagen grande para
// el hero). El preload de edición (sin overlay — el form escribe los valores
// crudos de vuelta a BGG — y owner-only) es la ruta hermana sin sufijo.
router.get(
  "/partida/:bggUsername/:playId/detalle",
  asyncHandler(async (req, res) => {
    const { bggUsername, playId } = req.params;
    const lower = bggUsername.toLowerCase();
    let doc = await BggPlay.findOne({ bggUsername: lower, playId }).lean();
    if (!doc) {
      // Sin espejo en Mongo (usuario que nunca sincronizó): fallback directo
      // a BGG, igual que el preload de edición.
      doc = await findPlayOnBgg(bggUsername, playId);
      if (!doc) throw httpError(404, "Partida no encontrada");
    }

    const overlayIndex = await loadOverlayIndex(lower);
    const play = playToApi(doc);
    play.players = applyOverlayToPlayers(play.players, overlayIndex, {
      ownerLower: lower,
    });

    let game = null;
    if (doc.gameId) {
      try {
        game = await resolveGame(doc.gameId);
      } catch {
        // El hero cae al gameThumbnail de la play.
      }
    }
    res.json({ play, game });
  }),
);

// GET /api/bgg/partida/:bggUsername/:playId/og — OG metadata pública para los
// previews sociales de /bg-watch/:user/partidas/:playId. La imagen es la tapa
// del juego (BggGame.image en alta; fallback thumbnail). Cache 30 min. Solo
// sirve partidas espejadas en Mongo — sin espejo, el crawler cae al OG default
// del SPA (no escaneamos BGG por un preview).
router.get(
  "/partida/:bggUsername/:playId/og",
  asyncHandler(async (req, res) => {
    const { bggUsername, playId } = req.params;
    const lower = bggUsername.toLowerCase();
    const cacheKey = `og:partida:${lower}:${playId}`;
    const cached = getCached(cacheKey, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    // OG: try/catch interno con body vacío en 404/500 (contrato de crawlers,
    // igual que /og/:bggUsername).
    try {
      const doc = await BggPlay.findOne({ bggUsername: lower, playId }).lean();
      if (!doc) return res.status(404).json({});

      const userDoc = await User.findOne({
        bggUsername: new RegExp(`^${escapeRegex(bggUsername)}$`, "i"),
      })
        .select("username displayName")
        .lean();
      const displayName =
        userDoc?.displayName || userDoc?.username || bggUsername;

      let image = doc.gameThumbnail || null;
      if (doc.gameId) {
        try {
          const game = await resolveGame(doc.gameId);
          image = game?.image || game?.thumbnail || image;
        } catch {
          // Swallow — partial data es mejor que 500 para crawlers.
        }
      }

      const overlayIndex = await loadOverlayIndex(lower);
      const players = applyOverlayToPlayers(doc.players || [], overlayIndex, {
        ownerLower: lower,
      });
      const playerNames = players
        .map((p) => (p.name || p.username || "").trim())
        .filter(Boolean);

      const data = {
        gameName: doc.gameName || null,
        image,
        date: doc.date || null,
        location: doc.location || null,
        duration: doc.duration || null,
        playersCount: players.length,
        playerNames: playerNames.slice(0, 6),
        displayName,
        bggUsername,
      };
      setCached(cacheKey, data);
      res.json(data);
    } catch {
      res.status(500).json({});
    }
  }),
);

// GET /api/bgg/partida/:bggUsername/:playId/grupo — partidas del dueño con
// EXACTAMENTE el mismo grupo de jugadores que esta, más stats (victorias por
// integrante, juegos del grupo, primera/última fecha). Público: deriva del
// mismo log que ya es público en /partidas. Paginado (?page).
router.get(
  "/partida/:bggUsername/:playId/grupo",
  asyncHandler(async (req, res) => {
    const { bggUsername, playId } = req.params;
    const lower = bggUsername.toLowerCase();
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 30,
    });

    const overlayIndex = await loadOverlayIndex(lower);
    const result = await computeGroupStats(lower, playId, { overlayIndex });
    if (!result) throw httpError(404, "Partida no encontrada");

    const { stats, roster, matchedPlays } = result;
    const plays = matchedPlays.slice(skip, skip + limit).map((d) => {
      const api = playToApi(d);
      api.players = applyOverlayToPlayers(api.players, overlayIndex, {
        ownerLower: lower,
      });
      return api;
    });

    res.json({
      // Mismo overlay que los players de cada play: nombres/avatares curados
      // ganan, y un alias "sos vos" resuelve al username del dueño.
      roster: applyOverlayToPlayers(roster, overlayIndex, {
        ownerLower: lower,
      }),
      stats,
      plays,
      page,
      total: stats.total,
      pageSize: limit,
    });
  }),
);

// GET /api/bgg/jugado/:bggUsername/:gameId — ¿el usuario jugó este juego antes?
// Alimenta la autodetección del flag "Nuevo" al cargar una partida. Todo desde
// BggPlay (local, sin pegarle a BGG). Devuelve:
//   - played / numPlays: de ESTE juego.
//   - known: si el usuario tiene ALGUNA partida sincronizada. Sirve para no
//     marcar "Nuevo" a invitados desconocidos (sin sync) por falta de datos:
//     solo marcamos "Nuevo" cuando known && !played (conocimiento positivo).
// (La sugerencia de duración salió de acá hacia el tiempo de caja de BGG, que
// viene en /game/:id como `playingTime`.)
router.get(
  "/jugado/:bggUsername/:gameId",
  asyncHandler(async (req, res) => {
    const { bggUsername, gameId } = req.params;
    const lower = bggUsername.toLowerCase();
    const [numPlays, known] = await Promise.all([
      computeGamePlayCount(lower, gameId),
      BggPlay.exists({ bggUsername: lower }),
    ]);
    res.json({ played: numPlays > 0, numPlays, known: !!known });
  }),
);

router.get(
  "/partidas/:bggUsername",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { bggUsername } = req.params;
    const lower = bggUsername.toLowerCase();
    const clientPage = Math.max(1, parseInt(req.query.page) || 1);

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const mindate = dateRe.test(req.query.mindate || "")
      ? req.query.mindate
      : null;
    const maxdate = dateRe.test(req.query.maxdate || "")
      ? req.query.maxdate
      : null;
    const gameId = /^\d+$/.test(req.query.id || "") ? req.query.id : null;
    const forceRefresh = req.query.refresh === "1";

    // Server-side cooldown for the manual "Actualizar" button (60s per panel).
    // Applies regardless of auth — client only shows the button to owner/admin.
    if (forceRefresh) {
      const remaining = await getManualRefreshRemainingMs(
        bggUsername,
        "partidas",
      );
      if (remaining > 0) {
        res.setHeader("X-Refresh-Cooldown-Ms", String(remaining));
        return res.status(429).json({
          message: `Esperá ${Math.ceil(remaining / 1000)}s antes de actualizar.`,
          retryAfterMs: remaining,
        });
      }
      await stampManualRefresh(bggUsername, "partidas");
    }

    // Set the current cooldown header on the response once, here. All
    // res.json(...) paths below inherit it automatically. If we just stamped
    // (forceRefresh path), this returns ~MANUAL_REFRESH_COOLDOWN_MS; otherwise
    // it reflects whatever cooldown was previously active (or 0).
    const cooldownRemaining = await getManualRefreshRemainingMs(
      bggUsername,
      "partidas",
    );
    res.setHeader("X-Refresh-Cooldown-Ms", String(cooldownRemaining));

    // L2: serve from Mongo if this user has been synced.
    const hasMongoData = await BggPlay.exists({ bggUsername: lower });

    if (hasMongoData) {
      // Quién mira: el dueño del perfil (match case-insensitive de bggUsername)
      // o un admin. Solo ellos disparan refrescos; un no-dueño no gatilla nada
      // (la frescura depende de las visitas del dueño + manual + reconcile 30d).
      const viewerIsOwner =
        !!req.user &&
        (req.user.isAdmin ||
          (req.user.bggUsername &&
            req.user.bggUsername.toLowerCase() === lower));

      // Timing fields de bggSync — sirven tanto para decidir la acción de sync
      // como para el bloque `sync` de la respuesta (label "Actualizado hace X").
      // Collation strength 2 porque User.bggUsername es case-preserved.
      const owner = await User.findOne({ bggUsername: lower })
        .collation({ locale: "en", strength: 2 })
        .select(
          "bggSync.lastProbedAt bggSync.lastFullSyncAt bggSync.lastProbeOutcome",
        )
        .lean();

      let syncRan = false;
      let syncOutcome = null;

      if (forceRefresh) {
        // User explicitly asked for fresh data — run the probe synchronously
        // so the response reflects any changes from BGG.
        try {
          const result = await withUserLock(bggUsername, () =>
            probe(bggUsername),
          );
          await stampProbeOutcome(lower, result.outcome);
          syncRan = true;
          syncOutcome = result.outcome;
        } catch (e) {
          logger.warn("[bgg/partidas] sync probe failed", {
            bggUsername: lower,
            error: e.message || String(e),
          });
          await stampProbeOutcome(lower, "failed");
          syncOutcome = "failed";
        }
      } else if (owner) {
        // Decisión por antigüedad del último probe (solo corre para dueño/admin;
        // para no-dueños devuelve nada). A lo sumo un refresco cada 3 h.
        const decision = decidePlaysSyncAction({
          lastProbedAt: owner.bggSync?.lastProbedAt,
          lastFullSyncAt: owner.bggSync?.lastFullSyncAt,
          now: Date.now(),
          viewerIsOwner,
        });
        if (decision.sync) {
          // Dueño/admin con datos viejos (>3 h): probe SINCRÓNICO → datos
          // frescos en esta misma respuesta.
          try {
            const result = await withUserLock(bggUsername, () =>
              probe(bggUsername),
            );
            await stampProbeOutcome(lower, result.outcome);
            syncRan = true;
            syncOutcome = result.outcome;
          } catch (e) {
            logger.warn("[bgg/partidas] auto-sync probe failed", {
              bggUsername: lower,
              error: e.message || String(e),
            });
            await stampProbeOutcome(lower, "failed");
            syncOutcome = "failed";
          }
          // El reconcile completo (>30 d) es pesado: nunca sincrónico, siempre
          // background, para no bloquear la carga de la página.
          if (decision.background === "reconcile") {
            triggerBackgroundReconcile(bggUsername);
          }
        }
      }

      const filter = { bggUsername: lower };
      if (mindate || maxdate) {
        filter.date = {};
        if (mindate) filter.date.$gte = mindate;
        if (maxdate) filter.date.$lte = maxdate;
      }
      if (gameId) filter.gameId = String(gameId);

      const isUnfilteredFirstPage =
        clientPage === 1 && !mindate && !maxdate && !gameId;

      const [total, docs, topGame, gameStats] = await Promise.all([
        BggPlay.countDocuments(filter),
        BggPlay.find(filter)
          .sort({ date: -1, playId: -1 })
          .skip((clientPage - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .lean(),
        isUnfilteredFirstPage
          ? computeTopPlayedGame(lower)
          : Promise.resolve(undefined),
        // Per-game stats over the full history — only when filtered by gameId
        // (the /bg-watch/:user/juego/:gameId view). selfKeys hace que las
        // victorias/partidas cargadas bajo un alias marcado "sos vos" cuenten
        // en el win-rate del dueño (consistente con el roster curado que se
        // muestra en las mismas tarjetas).
        gameId
          ? loadSelfKeys(lower).then((selfKeys) =>
              computeGameStats(lower, gameId, { selfKeys }),
            )
          : Promise.resolve(undefined),
      ]);

      // Reflejar el overlay de curación (nombre/avatar/fusión) en los jugadores
      // de cada partida servida desde Mongo. Una sola lectura de overlays.
      const overlayIndex = await loadOverlayIndex(lower);
      const response = {
        total,
        page: clientPage,
        pageSize: PAGE_SIZE,
        plays: docs.map((d) => {
          const api = playToApi(d);
          api.players = applyOverlayToPlayers(api.players, overlayIndex, {
            ownerLower: lower,
          });
          return api;
        }),
      };
      // Metadata de frescura para el cliente (label "Actualizado hace X"). Si
      // corrió un probe sincrónico recién, lastProbedAt es ahora.
      response.sync = {
        lastProbedAt: syncRan
          ? new Date()
          : owner?.bggSync?.lastProbedAt || null,
        lastFullSyncAt: owner?.bggSync?.lastFullSyncAt || null,
        lastProbeOutcome: syncRan
          ? syncOutcome
          : owner?.bggSync?.lastProbeOutcome || null,
      };
      if (isUnfilteredFirstPage) response.topGame = topGame;
      if (gameId) response.gameStats = gameStats;
      return res.json(response);
    }

    // L1 / L3 fallback: no Mongo data yet — serve from BGG (with in-memory cache).
    //
    // If a Turnocero User owns this bggUsername (case-insensitive match), kick
    // off a background reconcile so they stop falling through this path on
    // future visits. This is the self-healing branch that catches users who
    // connected BGG before the autosync-on-connect was deployed (Phase 5), or
    // whose autosync failed and was never retried manually. The reconcile is
    // fire-and-forget — the current request still serves the L1/L3 cache as
    // before so the user sees data immediately.
    const ownerForBackfill = await User.findOne({ bggUsername: lower })
      .collation({ locale: "en", strength: 2 })
      .select("_id")
      .lean();
    if (ownerForBackfill) triggerBackgroundReconcile(bggUsername);

    const bggPage = Math.ceil(clientPage / PAGES_PER_BGG);
    const offsetWithinBgg = ((clientPage - 1) % PAGES_PER_BGG) * PAGE_SIZE;
    const cacheKey = `partidas:${lower}:bgg:${bggPage}:${mindate || "-"}:${maxdate || "-"}:${gameId || "-"}`;

    if (!forceRefresh) {
      const cachedFull = getCached(cacheKey);
      if (cachedFull) {
        return res.json({
          total: cachedFull.total,
          page: clientPage,
          pageSize: PAGE_SIZE,
          plays: cachedFull.plays.slice(
            offsetWithinBgg,
            offsetWithinBgg + PAGE_SIZE,
          ),
        });
      }
    }

    try {
      const params = new URLSearchParams({
        username: bggUsername,
        page: String(bggPage),
      });
      if (mindate) params.set("mindate", mindate);
      if (maxdate) params.set("maxdate", maxdate);
      if (gameId) params.set("id", gameId);
      const xml = await fetchBgg(`${BGG_API}/plays?${params.toString()}`);
      const parsed = parsePlaysXml(xml);
      if (!parsed) throw httpError(404, "Usuario de BGG no encontrado");
      const { plays: parsedInternal, total } = parsed;

      // Enrich thumbnails via the shared BggGame cache (no per-user data here)
      const uniqueGameIds = [
        ...new Set(parsedInternal.map((p) => p.gameId).filter(Boolean)),
      ];
      const gamesMap = await resolveGamesBatch(uniqueGameIds);
      parsedInternal.forEach((p) => {
        if (p.gameId)
          p.gameThumbnail = gamesMap.get(Number(p.gameId))?.thumbnail || null;
      });

      const apiPlays = parsedInternal.map(playToApi);
      const fullPageData = { total, plays: apiPlays };
      setCached(cacheKey, fullPageData);

      res.json({
        total,
        page: clientPage,
        pageSize: PAGE_SIZE,
        plays: apiPlays.slice(offsetWithinBgg, offsetWithinBgg + PAGE_SIZE),
      });
    } catch (err) {
      if (err.isExplicit) throw err;
      if (err.status === 404) {
        throw httpError(404, "Usuario de BGG no encontrado");
      }
      throw httpError(502, "No se pudo conectar con BGG");
    }
  }),
);

// GET /api/bgg/og/:bggUsername — public OG metadata for /bg-watch/:username crawlers.
// Returns displayName (Turnocero user if connected), play count, collection size,
// and the user's top-played game with thumbnail. Cached 30 min per username.
router.get(
  "/og/:bggUsername",
  asyncHandler(async (req, res) => {
    const { bggUsername } = req.params;
    const cacheKey = `og:${bggUsername.toLowerCase()}`;
    const cached = getCached(cacheKey, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    // OG: mantiene try/catch interno con body vacío en 404/500 (contrato de
    // crawlers, igual que compartidas/og y noticias/og). asyncHandler
    // captura cualquier rejection que escape.
    try {
      // Look up the Turnocero user by bggUsername (case-insensitive) for displayName.
      const userDoc = await User.findOne({
        bggUsername: new RegExp(`^${escapeRegex(bggUsername)}$`, "i"),
      })
        .select("username displayName")
        .lean();
      const displayName =
        userDoc?.displayName || userDoc?.username || bggUsername;

      // Fetch BGG collection (top-played game + total games owned).
      let juegos = null;
      let topGame = null;
      try {
        const collXml = await fetchBgg(
          `${BGG_API}/collection?username=${encodeURIComponent(bggUsername)}&own=1&stats=1`,
        );
        const parsedColl = parser.parse(collXml);
        const root = parsedColl?.items;
        if (root) {
          const rawItems = root.item || [];
          const items = Array.isArray(rawItems) ? rawItems : [rawItems];
          juegos = items.length;
          let maxPlays = 0;
          for (const item of items) {
            const plays = item.numplays ? Number(item.numplays) : 0;
            if (plays > maxPlays) {
              maxPlays = plays;
              topGame = {
                name:
                  typeof item.name === "object"
                    ? item.name["#text"]
                    : item.name,
                thumbnail: item.thumbnail || null,
                numPlays: plays,
              };
            }
          }
        }
      } catch {
        // Swallow — partial data is better than 500 for crawlers.
      }

      // Fetch total play count (BGG plays API returns it as @_total).
      let partidas = null;
      try {
        const playsXml = await fetchBgg(
          `${BGG_API}/plays?username=${encodeURIComponent(bggUsername)}&page=1`,
        );
        const parsedPlays = parser.parse(playsXml);
        const total = parsedPlays?.plays?.["@_total"];
        partidas = total ? Number(total) : null;
      } catch {
        // Swallow.
      }

      if (juegos === null && partidas === null) {
        return res.status(404).json({});
      }

      const data = { displayName, bggUsername, partidas, juegos, topGame };
      setCached(cacheKey, data);
      res.json(data);
    } catch {
      res.status(500).json({});
    }
  }),
);

// POST /api/bgg/sync — full reconciliation of the authenticated user's BGG
// plays. Walks every page, upserting by playId and detecting deletes by
// diffing against local IDs. Non-destructive: if BGG fails mid-walk, what
// was already upserted stays valid and the next run picks up where this
// left off.
//
// Used by the "Reconciliar all con BGG" button as a manual fallback for
// edits to old plays that the lightweight probe misses.
router.post(
  "/sync",
  protect,
  bggSyncLimiter,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user.bggUsername) {
      throw httpError(400, "Configurá tu username de BGG en el perfil");
    }

    let result;
    try {
      result = await withUserLock(user.bggUsername, () =>
        reconcileFull(user.bggUsername, { full: true, background: false }),
      );
    } catch (err) {
      if (err.status === 404) {
        throw httpError(404, "Usuario de BGG no encontrado");
      }
      logger.error("[bgg/sync] full sync failed", {
        error: err.message,
        stack: err.stack,
      });
      throw httpError(502, err.message || "No se pudo sincronizar con BGG");
    }

    // Persist sync metadata on the user — see stampReconcileResult for the
    // shared semantics; same fields are mirrored here for the sync path.
    if (!user.bggSync) user.bggSync = {};
    const now = new Date();
    user.bggSync.lastFullSyncAt = now;
    user.bggSync.lastFullSyncCount = result.total;
    user.bggSync.lastProbedAt = now;
    user.bggSync.lastProbeOutcome = "reconciled";
    await user.save();

    // Invalida los caches derivados del log (L1 + selector "Mis juegos"): un
    // full reconcile puede haber insertado/borrado partidas → el selector debe
    // reconstruirse, no solo dropear el cache L1.
    await invalidateOwnerDerived(user.bggUsername);

    res.json({
      success: true,
      lastFullSyncAt: user.bggSync.lastFullSyncAt,
      inserted: result.inserted,
      updated: result.updated,
      deleted: result.deleted,
      total: result.total,
      pages: result.pages,
    });
  }),
);

// POST /api/bgg/partidas — create a play in BGG. The flow is BGG-first:
// submit to geekplay.php, then verify the play exists on BGG by fetching
// it back, then mirror to Mongo using BGG's canonical representation.
// If any step fails the response is 502 and Mongo is left untouched.
// Persiste (upsert) la variante/tablero usada en una partida, para ofrecerla en
// próximas partidas del mismo juego. Texto libre; falla en silencio.
async function upsertGameVariant(bggUsername, gameId, name) {
  const variant = String(name || "").trim();
  if (!bggUsername || !gameId || !variant) return;
  try {
    await BggGameVariant.updateOne(
      {
        bggUsername: String(bggUsername).toLowerCase(),
        gameId: String(gameId),
        name: variant,
      },
      { $set: { lastUsedAt: new Date() } },
      { upsert: true },
    );
  } catch (e) {
    logger.warn("[bgg] upsert game variant failed", { error: e.message });
  }
}

router.post(
  "/partidas",
  protect,
  bggMutationLimiter,
  asyncHandler(async (req, res) => {
    const user = req.user;
    // El flujo BGG-first (validar → geekplay → verify → mirror → invalidar)
    // vive en `createPlay`, compartido con el endpoint "cargar como aparece".
    const { playid, verified } = await createPlay(user, req.body);

    // Persistir la variante/tablero (texto libre) para autocompletado futuro.
    await upsertGameVariant(
      user.bggUsername,
      req.body.objectid,
      req.body.variant,
    );

    // Si la carga viene de aceptar una partida compartida "con correcciones"
    // (`sharedFromNotifId`), agradecemos al autor original y cerramos su notif,
    // y NO re-notificamos a los participantes (evita cadenas A→B→A). Si es una
    // carga común, notificamos a los co-jugadores que sean usuarios de TurnoCero.
    if (req.body.sharedFromNotifId) {
      await acknowledgeSharedPlay({
        req,
        recipient: user,
        notifId: req.body.sharedFromNotifId,
      });
    } else {
      await notifyPlayParticipants({
        req,
        author: user,
        body: req.body,
        playId: playid,
      });
    }

    res.json({
      success: true,
      playid,
      play: playToApi(verified),
    });
  }),
);

// POST /api/bgg/partidas/compartida/:notifId — "cargar como aparece": carga en
// la cuenta del destinatario la partida de una notif `bgg_play_shared`, tal
// cual el snapshot, y agradece al autor. El snapshot es la fuente (no datos del
// cliente) → el destinatario no puede manipular lo que se carga.
router.post(
  "/partidas/compartida/:notifId",
  protect,
  bggMutationLimiter,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user.bggUsername) {
      throw httpError(400, "Configurá tu username de BGG en el perfil");
    }
    const creds = user.bggCredentials;
    if (!(creds && creds.encryptedPassword)) {
      throw httpError(400, "Conectá tu cuenta de BGG para cargar la partida");
    }
    const { notifId } = req.params;
    if (!/^[a-fA-F0-9]{24}$/.test(String(notifId))) {
      throw httpError(400, "Notificación inválida");
    }
    const notif = await Notification.findOne({
      _id: notifId,
      recipient: user._id,
      type: "bgg_play_shared",
    });
    if (!notif || !notif.playSnapshot) {
      throw httpError(404, "La partida compartida ya no está disponible");
    }

    const snap = notif.playSnapshot;
    const body = {
      objectid: snap.gameId,
      playdate: snap.date,
      length: snap.duration,
      // La ubicación no se replica de una partida compartida (puede venir en
      // snapshots viejos; la ignoramos a propósito).
      location: "",
      quantity: snap.quantity,
      comments: snap.comments,
      incomplete: snap.incomplete,
      nowinstats: snap.nowinstats,
      players: (snap.players || []).map((p) => ({
        name: p.name,
        username: p.username,
        position: p.position,
        color: p.color,
        score: p.score,
        win: p.win,
        new: p.new,
        rating: p.rating,
      })),
    };

    const { playid } = await createPlay(user, body);
    await acknowledgeSharedPlay({ req, recipient: user, notifId });

    res.json({ success: true, playid });
  }),
);

// DELETE /api/bgg/partidas/:playId — delete a play from BGG. Verifies the
// play is actually gone from BGG before removing the Mongo mirror.
router.delete(
  "/partidas/:playId",
  protect,
  bggMutationLimiter,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user.bggUsername) {
      throw httpError(400, "Configurá tu username de BGG en el perfil");
    }
    const { playId } = req.params;
    if (!/^\d+$/.test(String(playId))) {
      throw httpError(400, "ID de partida inválido");
    }

    // We need gameId + date to narrow the verification query. Look up the
    // existing play in our Mongo mirror; if the user hasn't synced yet we
    // skip narrowing and the verify call walks the unfiltered plays list
    // (acceptable fallback — DELETE on a never-synced user is rare).
    const lower = user.bggUsername.toLowerCase();
    const existing = await BggPlay.findOne({
      bggUsername: lower,
      playId: String(playId),
    }).lean();
    const verifyOpts = existing
      ? { gameId: existing.gameId, playdate: existing.date }
      : {};

    const form = new URLSearchParams();
    form.set("ajax", "1");
    form.set("action", "delete");
    form.set("playid", String(playId));
    form.set("finalize", "1");
    form.set("B1", "Yes");

    try {
      await submitToGeekplay(user, form, "DELETE");
    } catch (e) {
      throw httpError(e.status || 500, e.message);
    }

    const stillThere = await verifyPlayOnBgg(
      user.bggUsername,
      playId,
      verifyOpts,
    );
    if (stillThere) {
      throw httpError(
        502,
        "BGG no confirmó el borrado de la partida. Intentá de nuevo.",
      );
    }

    try {
      await BggPlay.deleteOne({
        bggUsername: user.bggUsername.toLowerCase(),
        playId: String(playId),
      });
    } catch (e) {
      logger.warn("[bgg/DELETE] mirror to Mongo failed", { error: e.message });
    }

    await invalidateOwnerDerived(user.bggUsername);

    res.json({ success: true });
  }),
);

// PUT /api/bgg/partidas/:playId — edit an existing play in BGG. Same
// BGG-first verification flow as POST.
router.put(
  "/partidas/:playId",
  protect,
  bggMutationLimiter,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user.bggUsername) {
      throw httpError(400, "Configurá tu username de BGG en el perfil");
    }
    const { playId } = req.params;
    if (!/^\d+$/.test(String(playId))) {
      throw httpError(400, "ID de partida inválido");
    }
    const validationError = validatePlayBody(req.body);
    if (validationError) throw httpError(400, validationError);

    const form = buildPlayForm(req.body, playId);
    try {
      await submitToGeekplay(user, form, "PUT");
    } catch (e) {
      throw httpError(e.status || 500, e.message);
    }

    const verified = await verifyPlayOnBgg(user.bggUsername, playId, {
      gameId: req.body.objectid,
      playdate: req.body.playdate,
    });
    if (!verified) {
      throw httpError(
        502,
        "BGG no confirmó la edición de la partida. Intentá de nuevo.",
      );
    }

    const lower = user.bggUsername.toLowerCase();
    if (await BggPlay.exists({ bggUsername: lower })) {
      try {
        await upsertPlayFromBgg(user.bggUsername, verified);
      } catch (e) {
        logger.warn("[bgg/PUT] mirror to Mongo failed", { error: e.message });
      }
    }

    await invalidateOwnerDerived(user.bggUsername);
    await upsertGameVariant(
      user.bggUsername,
      req.body.objectid,
      req.body.variant,
    );

    res.json({ success: true, playid: playId, play: playToApi(verified) });
  }),
);

// ── Jugadores: curación del roster (overlay local + híbrido a BGG) ─────────
// Pestaña "Jugadores" del perfil de BG Watch. Solo dueño/admin (salvo el
// write-back de @BGG, que es solo dueño porque necesita su cookie de sesión).

function ownerOrAdmin(req, lower) {
  const isOwner =
    req.user?.bggUsername && req.user.bggUsername.toLowerCase() === lower;
  return { isOwner, allowed: isOwner || !!req.user?.isAdmin };
}

// GET /api/bgg/jugadores/:bggUsername — lista curada de jugadores de las
// partidas del dueño, con estado de vínculo a TurnoCero. Paginada (?page,
// ?limit, ?q). Mismo contrato que mis-jugadores + campos de curación.
router.get(
  "/jugadores/:bggUsername",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) {
      throw httpError(403, "No podés ver los jugadores de otro usuario");
    }

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const rawCoPlayers = await computePlayedCoPlayers(lower);
    const overlayIndex = await loadOverlayIndex(lower);
    let items = applyOverlayToCoPlayers(rawCoPlayers, overlayIndex);

    // Resolver vínculos a miembros de TurnoCero por username efectivo.
    const linkedUsers = await resolveUsersByBggUsernames(
      items.map((it) => it.username).filter(Boolean),
      { cap: 500 },
    );
    const linkMap = new Map(
      linkedUsers.map((u) => [u.bggUsername.toLowerCase(), u]),
    );
    items = items.map((it) => {
      const linked = it.username
        ? linkMap.get(it.username.toLowerCase()) || null
        : null;
      return {
        ...it,
        linkedUser: linked,
        isLinked: !!linked,
        canEditNameAvatar: !linked,
      };
    });

    const q = (req.query.q || "").trim();
    if (q) {
      const needle = normalizeForSearch(q);
      items = items.filter(
        (it) =>
          normalizeForSearch(it.name).includes(needle) ||
          normalizeForSearch(it.username).includes(needle),
      );
    }

    items.sort((a, b) => {
      const da = a.lastPlayedDate || "";
      const db = b.lastPlayedDate || "";
      if (da !== db) return db.localeCompare(da);
      if (a.numPlays !== b.numPlays) return b.numPlays - a.numPlays;
      return (a.name || "").localeCompare(b.name || "");
    });

    res.json({
      items: items.slice(skip, skip + limit),
      total: items.length,
      page,
      pages: Math.ceil(items.length / limit),
    });
  }),
);

// GET /api/bgg/jugadores/:bggUsername/:playerKey — detalle de un co-jugador:
// partidas compartidas (paginadas), head-to-head vs el dueño y stats. Owner/admin.
// `playerKey` es la `key` que devuelve la lista (`o:<overlayId>` o `k:<rawKey>`);
// también acepta una rawKey directa (`u:`/`n:`). Express ya decodifica el param.
router.get(
  "/jugadores/:bggUsername/:playerKey",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) {
      throw httpError(403, "No podés ver los jugadores de otro usuario");
    }

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 30,
    });

    const overlayIndex = await loadOverlayIndex(lower);

    // Resolver playerKey → rawKeys (+ overlay si existe).
    const rawParam = req.params.playerKey || "";
    let overlay = null;
    let rawKeys = [];
    if (rawParam.startsWith("o:")) {
      overlay = await BggPlayerOverlay.findOne({
        _id: rawParam.slice(2),
        ownerUsername: lower,
      }).lean();
      if (!overlay) throw httpError(404, "Jugador no encontrado");
      rawKeys = overlay.rawKeys || [];
    } else {
      // "k:<rawKey>" (de la lista) o "u:"/"n:" directo.
      const bare = rawParam.startsWith("k:") ? rawParam.slice(2) : rawParam;
      const keys = sanitizeRawKeys([bare]);
      if (!keys.length) throw httpError(400, "Jugador inválido");
      // Si la clave está reclamada por un overlay (fusión), expandir a TODAS sus
      // identidades para no perder partidas cargadas bajo otros alias.
      const claimed = overlayIndex.byKey.get(keys[0]);
      if (claimed) {
        overlay = claimed;
        rawKeys = claimed.rawKeys || keys;
      } else {
        rawKeys = keys;
      }
    }
    if (!rawKeys.length) throw httpError(404, "Jugador no encontrado");

    const selfKeys = await loadSelfKeys(lower);
    const { stats, matchedPlays } = await computeCoPlayerStats(lower, rawKeys, {
      selfKeys,
    });

    // Header del jugador: nombre/username/avatar efectivos. Con overlay usamos
    // overlayToRow; sin overlay derivamos de la aparición más reciente (los
    // matchedPlays ya vienen date desc).
    let username;
    let name = "";
    let avatar = null;
    let isSelf = false;
    if (overlay) {
      const row = overlayToRow(overlay, null);
      username = row.username;
      name = row.name;
      avatar = row.avatar;
      isSelf = row.isSelf;
    } else {
      username = firstUserKey(rawKeys) || "";
      for (const p of matchedPlays) {
        const pl = (p.players || []).find((x) =>
          rawKeys.includes(rawKeyFor(x)),
        );
        if (pl) {
          name = (pl.name || "").trim();
          if (!username) username = (pl.username || "").trim();
          break;
        }
      }
      if (!name) name = username || nameFromKeys(rawKeys);
    }

    // Vínculo a un miembro de TurnoCero (por username efectivo).
    let linkedUser = null;
    if (username) {
      const linked = await resolveUsersByBggUsernames([username], { cap: 1 });
      linkedUser = linked[0] || null;
    }

    // Partidas paginadas, con la curación (overlay) reflejada en los players.
    const plays = matchedPlays.slice(skip, skip + limit).map((d) => {
      const api = playToApi(d);
      api.players = applyOverlayToPlayers(api.players, overlayIndex, {
        ownerLower: lower,
      });
      return api;
    });

    res.json({
      player: {
        key: overlay ? `o:${overlay._id}` : `k:${rawKeys[0]}`,
        rawKeys,
        name,
        username,
        avatar,
        isSelf,
        isLinked: !!linkedUser,
        linkedUser,
      },
      h2h: {
        ownerWins: stats.ownerWins,
        playerWins: stats.playerWins,
        draws: stats.draws,
      },
      stats: {
        total: stats.total,
        firstPlayedDate: stats.firstPlayedDate,
        lastPlayedDate: stats.lastPlayedDate,
        byGame: stats.byGame,
      },
      plays,
      page,
      total: stats.total,
      pageSize: limit,
    });
  }),
);

// PATCH /api/bgg/jugadores/:bggUsername/nombre — override local del nombre.
router.patch(
  "/jugadores/:bggUsername/nombre",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) throw httpError(403, "No autorizado");

    const rawKeys = sanitizeRawKeys(req.body.rawKeys);
    const name = (req.body.name || "").trim();
    if (!rawKeys.length) throw httpError(400, "Jugador inválido");
    if (!name) throw httpError(400, "El nombre no puede estar vacío");
    if (name.length > 100) throw httpError(400, "Nombre demasiado largo");

    // Override LOCAL: aplica también a jugadores vinculados a un miembro de
    // TurnoCero — el override gana sobre la identidad del perfil, pero solo en
    // la vista de BG Watch del dueño (el cliente avisa con un disclaimer).
    const overlay = await getOrCreateOverlay(lower, rawKeys);
    overlay.nameOverride = name;
    await overlay.save();
    await invalidateOwnerDerived(lower);
    res.json({ player: overlayToRow(overlay, null) });
  }),
);

// PATCH /api/bgg/jugadores/:bggUsername/bgg-username — vincula un jugador a un
// usuario de BGG. Overlay LOCAL: NO reescribe las partidas ya cargadas en BGG
// (sería carísimo en peticiones). Se aplica al leer en TurnoCero (toda la
// historia se ve unificada) y, como el selector de carga ya muestra el @BGG
// curado, las partidas nuevas lo llevan nativamente — "de ahí en adelante".
router.patch(
  "/jugadores/:bggUsername/bgg-username",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) throw httpError(403, "No autorizado");

    const rawKeys = sanitizeRawKeys(req.body.rawKeys);
    if (!rawKeys.length) throw httpError(400, "Jugador inválido");
    const newHandle = (req.body.bggUsername || "").trim().replace(/^@/, "");
    if (
      !newHandle ||
      newHandle.length > 50 ||
      !/^[A-Za-z0-9_\- .]+$/.test(newHandle)
    ) {
      throw httpError(400, "Usuario de BGG inválido");
    }
    if (newHandle.toLowerCase() === lower) {
      throw httpError(400, "Ese es tu propio usuario de BGG");
    }

    // El overlay CONSERVA sus keys (incl. las n: por-nombre) y SUMA u:<newHandle>.
    // Así el vínculo aplica a toda la historia en TurnoCero (partidas viejas
    // cargadas por nombre y nuevas cargadas ya con el @BGG), sin tocar BGG.
    const newKey = `u:${newHandle.toLowerCase()}`;
    let overlay = await getOrCreateOverlay(lower, rawKeys);
    overlay.rawKeys = [...new Set([...overlay.rawKeys, newKey])];
    overlay.bggUsername = newHandle;
    await overlay.save();

    // Auto-merge si otro overlay ya reclama u:<newHandle> (el existente gana).
    let merged = false;
    const existing = await BggPlayerOverlay.findOne({
      ownerUsername: lower,
      _id: { $ne: overlay._id },
      rawKeys: newKey,
    });
    if (existing) {
      const set = new Set(existing.rawKeys);
      for (const k of overlay.rawKeys) set.add(k);
      existing.rawKeys = [...set];
      if (!existing.bggUsername) existing.bggUsername = newHandle;
      if (!existing.nameOverride && overlay.nameOverride) {
        existing.nameOverride = overlay.nameOverride;
      }
      if (!existing.avatar?.url && overlay.avatar?.url) {
        existing.avatar = overlay.avatar;
      }
      await existing.save();
      await BggPlayerOverlay.deleteOne({ _id: overlay._id });
      overlay = existing;
      merged = true;
    }

    const linked = await resolveUsersByBggUsernames([newHandle], { cap: 1 });
    await invalidateOwnerDerived(lower);
    res.json({
      merged,
      player: overlayToRow(overlay, linked[0] || null),
    });
  }),
);

// PUT /api/bgg/jugadores/:bggUsername/avatar — avatar local (multipart).
router.put(
  "/jugadores/:bggUsername/avatar",
  protect,
  multer.single("avatar"),
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) throw httpError(403, "No autorizado");
    if (!req.file) throw httpError(400, "Imagen requerida");

    let rawKeys;
    try {
      rawKeys = sanitizeRawKeys(JSON.parse(req.body.rawKeys || "[]"));
    } catch {
      rawKeys = [];
    }
    if (!rawKeys.length) throw httpError(400, "Jugador inválido");

    // Override LOCAL: aplica también a vinculados (gana sobre su avatar de
    // TurnoCero, solo en la vista de BG Watch del dueño — el cliente avisa).
    const overlay = await getOrCreateOverlay(lower, rawKeys);

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/bgg-players/${req.user._id}`,
      public_id: String(overlay._id),
      overwrite: true,
      format: "webp",
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto" },
      ],
    });
    overlay.avatar = { url: result.secure_url, publicId: result.public_id };
    await overlay.save();
    await invalidateOwnerDerived(lower);
    res.json({ player: overlayToRow(overlay, null) });
  }),
);

// DELETE /api/bgg/jugadores/:bggUsername/avatar — quitar avatar local.
router.delete(
  "/jugadores/:bggUsername/avatar",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) throw httpError(403, "No autorizado");
    const rawKeys = sanitizeRawKeys(req.body.rawKeys);
    if (!rawKeys.length) throw httpError(400, "Jugador inválido");

    const overlay = await BggPlayerOverlay.findOne({
      ownerUsername: lower,
      rawKeys: { $in: rawKeys },
    });
    if (overlay?.avatar?.publicId) {
      await cloudinary.uploader
        .destroy(overlay.avatar.publicId)
        .catch(() => {});
    }
    if (overlay) {
      overlay.avatar = { url: "", publicId: "" };
      await overlay.save();
    }
    await invalidateOwnerDerived(lower);
    res.json({ player: overlay ? overlayToRow(overlay, null) : null });
  }),
);

// POST /api/bgg/jugadores/:bggUsername/merge — fusionar source dentro de target.
router.post(
  "/jugadores/:bggUsername/merge",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) throw httpError(403, "No autorizado");

    const targetKeys = sanitizeRawKeys(req.body.targetRawKeys);
    const sourceKeys = sanitizeRawKeys(req.body.sourceRawKeys);
    if (!targetKeys.length || !sourceKeys.length) {
      throw httpError(400, "Jugadores inválidos");
    }
    if (targetKeys.some((k) => sourceKeys.includes(k))) {
      throw httpError(400, "No podés fusionar un jugador consigo mismo");
    }

    const target = await getOrCreateOverlay(lower, targetKeys);
    const source = await BggPlayerOverlay.findOne({
      ownerUsername: lower,
      rawKeys: { $in: sourceKeys },
    });

    const set = new Set(target.rawKeys);
    for (const k of sourceKeys) set.add(k);
    if (source) for (const k of source.rawKeys) set.add(k);
    target.rawKeys = [...set];
    if (source) {
      if (!target.nameOverride && source.nameOverride) {
        target.nameOverride = source.nameOverride;
      }
      if (!target.bggUsername && source.bggUsername) {
        target.bggUsername = source.bggUsername;
      }
      if (!target.avatar?.url && source.avatar?.url) {
        target.avatar = source.avatar;
      }
    }
    await target.save();
    if (source && String(source._id) !== String(target._id)) {
      await BggPlayerOverlay.deleteOne({ _id: source._id });
    }

    const linked = (await isLinkedToMember(target.rawKeys, target.bggUsername))
      ? (
          await resolveUsersByBggUsernames(
            [
              target.bggUsername,
              ...target.rawKeys
                .filter((k) => k.startsWith("u:"))
                .map((k) => k.slice(2)),
            ].filter(Boolean),
            { cap: 50 },
          )
        )[0]
      : null;
    await invalidateOwnerDerived(lower);
    res.json({ player: overlayToRow(target, linked || null) });
  }),
);

// POST /api/bgg/jugadores/:bggUsername/yo-mismo — marca (o desmarca) a un
// jugador como el propio dueño del perfil (registrado con otro nombre). Overlay
// local: lo saca de los rankings de compañeros y lo muestra como el dueño en
// las partidas. No toca BGG.
router.post(
  "/jugadores/:bggUsername/yo-mismo",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) throw httpError(403, "No autorizado");

    const rawKeys = sanitizeRawKeys(req.body.rawKeys);
    if (!rawKeys.length) throw httpError(400, "Jugador inválido");
    const value = req.body.value !== false; // default: marcar

    const overlay = await getOrCreateOverlay(lower, rawKeys);
    overlay.isSelf = value;
    await overlay.save();
    await invalidateOwnerDerived(lower);
    res.json({ player: overlayToRow(overlay, null) });
  }),
);

// ── Ubicaciones: curación de las ubicaciones de las partidas ────────────────
// Pestaña "Ubicaciones" del perfil de BG Watch. Solo dueño/admin. Las
// ubicaciones son strings libres en BggPlay.location; el overlay (local) sólo
// guarda un nombre curado y fusiona grafías duplicadas. No toca BGG.

// GET /api/bgg/ubicaciones/:bggUsername — lista curada de ubicaciones de las
// partidas del dueño. Paginada (?page, ?limit, ?q). Mismo contrato de orden que
// mis-ubicaciones (recencia desc → más partidas → alfabético).
router.get(
  "/ubicaciones/:bggUsername",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) {
      throw httpError(403, "No podés ver las ubicaciones de otro usuario");
    }

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const roster = await computeLocationRoster(lower);
    const overlayIndex = await loadLocationOverlayIndex(lower);
    let items = applyOverlayToLocations(roster, overlayIndex);

    const q = (req.query.q || "").trim();
    if (q) {
      const needle = normalizeForSearch(q);
      items = items.filter((it) =>
        normalizeForSearch(it.name).includes(needle),
      );
    }

    items.sort((a, b) => {
      const da = a.lastPlayedDate || "";
      const db = b.lastPlayedDate || "";
      if (da !== db) return db.localeCompare(da);
      if (a.numPlays !== b.numPlays) return b.numPlays - a.numPlays;
      return (a.name || "").localeCompare(b.name || "");
    });

    res.json({
      items: items.slice(skip, skip + limit),
      total: items.length,
      page,
      pages: Math.ceil(items.length / limit),
    });
  }),
);

// GET /api/bgg/ubicaciones/:bggUsername/:locationKey — detalle de una ubicación:
// stats (partidas, juegos únicos, primera/última fecha, por juego) + las
// partidas paginadas. locationKey: `o:<overlayId>`, `k:l:<lower>` o `l:<lower>`.
router.get(
  "/ubicaciones/:bggUsername/:locationKey",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) {
      throw httpError(403, "No podés ver las ubicaciones de otro usuario");
    }

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 30,
    });

    const overlayIndex = await loadLocationOverlayIndex(lower);

    // Resolver locationKey → rawKeys (+ overlay si existe).
    const rawParam = req.params.locationKey || "";
    let overlay = null;
    let rawKeys;
    if (rawParam.startsWith("o:")) {
      overlay = await BggLocationOverlay.findOne({
        _id: rawParam.slice(2),
        ownerUsername: lower,
      }).lean();
      if (!overlay) throw httpError(404, "Ubicación no encontrada");
      rawKeys = overlay.rawKeys || [];
    } else {
      const bare = rawParam.startsWith("k:") ? rawParam.slice(2) : rawParam;
      const keys = sanitizeLocationKeys([bare]);
      if (!keys.length) throw httpError(400, "Ubicación inválida");
      // Si la clave está reclamada por un overlay (fusión), expandir a TODAS sus
      // grafías para no perder partidas cargadas bajo otra grafía.
      const claimed = overlayIndex.byKey.get(keys[0]);
      if (claimed) {
        overlay = claimed;
        rawKeys = claimed.rawKeys || keys;
      } else {
        rawKeys = keys;
      }
    }
    if (!rawKeys.length) throw httpError(404, "Ubicación no encontrada");

    const { stats, matchedPlays } = await computeLocationStats(lower, rawKeys);

    // Nombre efectivo: override del overlay, si no la grafía más reciente.
    let name = overlay?.nameOverride || "";
    if (!name) {
      name = (matchedPlays[0]?.location || "").trim();
    }
    if (!name) name = locationNameFromKey(rawKeys[0]);

    // Las partidas salen crudas: el overlay de ubicaciones cura el nombre del
    // lugar, no a los jugadores de cada partida.
    const plays = matchedPlays.slice(skip, skip + limit).map(playToApi);

    res.json({
      location: {
        key: overlay ? `o:${overlay._id}` : `k:${rawKeys[0]}`,
        rawKeys,
        name,
      },
      stats: {
        total: stats.total,
        uniqueGames: stats.uniqueGames,
        firstPlayedDate: stats.firstPlayedDate,
        lastPlayedDate: stats.lastPlayedDate,
        byGame: stats.byGame,
      },
      plays,
      page,
      total: stats.total,
      pageSize: limit,
    });
  }),
);

// PATCH /api/bgg/ubicaciones/:bggUsername/nombre — override local del nombre.
router.patch(
  "/ubicaciones/:bggUsername/nombre",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) throw httpError(403, "No autorizado");

    const rawKeys = sanitizeLocationKeys(req.body.rawKeys);
    const name = (req.body.name || "").trim();
    if (!rawKeys.length) throw httpError(400, "Ubicación inválida");
    if (!name) throw httpError(400, "El nombre no puede estar vacío");
    if (name.length > 100) throw httpError(400, "Nombre demasiado largo");

    const overlay = await getOrCreateLocationOverlay(lower, rawKeys);
    overlay.nameOverride = name;
    await overlay.save();
    res.json({ location: overlayToLocationRow(overlay) });
  }),
);

// POST /api/bgg/ubicaciones/:bggUsername/merge — fusionar source dentro de
// target (consolida grafías duplicadas en una sola ubicación curada).
router.post(
  "/ubicaciones/:bggUsername/merge",
  protect,
  asyncHandler(async (req, res) => {
    const lower = req.params.bggUsername.toLowerCase();
    const { allowed } = ownerOrAdmin(req, lower);
    if (!allowed) throw httpError(403, "No autorizado");

    const targetKeys = sanitizeLocationKeys(req.body.targetRawKeys);
    const sourceKeys = sanitizeLocationKeys(req.body.sourceRawKeys);
    if (!targetKeys.length || !sourceKeys.length) {
      throw httpError(400, "Ubicaciones inválidas");
    }
    if (targetKeys.some((k) => sourceKeys.includes(k))) {
      throw httpError(400, "No podés fusionar una ubicación consigo misma");
    }

    const target = await getOrCreateLocationOverlay(lower, targetKeys);
    const source = await BggLocationOverlay.findOne({
      ownerUsername: lower,
      rawKeys: { $in: sourceKeys },
    });

    const set = new Set(target.rawKeys);
    for (const k of sourceKeys) set.add(k);
    if (source) for (const k of source.rawKeys) set.add(k);
    target.rawKeys = [...set];
    if (source && !target.nameOverride && source.nameOverride) {
      target.nameOverride = source.nameOverride;
    }
    await target.save();
    if (source && String(source._id) !== String(target._id)) {
      await BggLocationOverlay.deleteOne({ _id: source._id });
    }

    res.json({ location: overlayToLocationRow(target) });
  }),
);

module.exports = router;
// Exposed for other routes (e.g. auth's bgg-connect handler) that need to
// invalidate the per-user in-memory cache after relevant mutations.
module.exports.clearUserCache = clearUserCache;
// Exposed so other routes can kick off an initial / periodic full reconcile
// in the background after a relevant event (BGG connect, scheduled refresh).
module.exports.triggerBackgroundReconcile = triggerBackgroundReconcile;
// Exposed for routes that necesitan hidratar metadata de un juego BGG
// (e.g. POST /api/eventos/:id/ludoteca, que recibe solo bggGameId del cliente
// y completa name/thumbnail/year server-side).
module.exports.resolveGame = resolveGame;
// Internal: clear the in-memory L1 cache. Tests use this to isolate runs.
module.exports.__resetCache = () => cache.clear();
