const express = require("express");
const router = express.Router();
const { protect, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
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
  computePlayedGames,
  computeTopPlayedGame,
  computePlayedLocations,
  computeGamePlayCount,
  computePlayedCoPlayers,
} = require("../services/bgg/bggAggregations");
const { parsePagination } = require("../utils/paginate");
const BggUserGame = require("../models/BggUserGame");
const {
  ensureFreshUserGames,
  normalizeForSearch,
  markUserGamesDirty,
} = require("../services/bgg/bggUserGames");
// `stripLeadingArticle` no se usa directamente acá pero vive en
// bggSearch junto a scoreSearchMatch para que el ranking de búsqueda
// quede en un solo módulo testeable.
const { scoreSearchMatch } = require("../services/bgg/bggSearch");
const {
  cache,
  getCached,
  setCached,
  clearPartidasCache,
} = require("../services/bgg/bggCache");
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
} = require("../services/bgg/bggMutations");

router.use(requireSection("bgwatch"));

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

    let items = await computePlayedCoPlayers(lower);

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
    if (!play) throw httpError(404, "Partida no encontrada");
    res.json({
      id: play.playId,
      gameId: play.gameId,
      gameName: play.gameName,
      gameThumbnail: play.gameThumbnail,
      date: play.date,
      duration: play.duration,
      location: play.location,
      quantity: play.quantity,
      comments: play.comments,
      incomplete: play.incomplete,
      nowinstats: play.nowinstats,
      players: play.players || [],
    });
  }),
);

// GET /api/bgg/jugado/:bggUsername/:gameId — ¿el usuario jugó este juego antes?
// Alimenta la autodetección del flag "Nuevo" al cargar una partida (sugerencia
// editable para el dueño). Devuelve { played, numPlays } desde BggPlay.
router.get(
  "/jugado/:bggUsername/:gameId",
  asyncHandler(async (req, res) => {
    const { bggUsername, gameId } = req.params;
    const lower = bggUsername.toLowerCase();
    const numPlays = await computeGamePlayCount(lower, gameId);
    res.json({ played: numPlays > 0, numPlays });
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
        // (the /bg-watch/:user/juego/:gameId view).
        gameId ? computeGameStats(lower, gameId) : Promise.resolve(undefined),
      ]);

      const response = {
        total,
        page: clientPage,
        pageSize: PAGE_SIZE,
        plays: docs.map(playToApi),
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

    // Drop the in-memory plays cache so subsequent reads come from Mongo
    clearPartidasCache(user.bggUsername);

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
router.post(
  "/partidas",
  protect,
  bggMutationLimiter,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user.bggUsername) {
      throw httpError(400, "Configurá tu username de BGG en el perfil");
    }
    const validationError = validatePlayBody(req.body);
    if (validationError) throw httpError(400, validationError);

    const form = buildPlayForm(req.body, null);
    let payload;
    try {
      payload = await submitToGeekplay(user, form, "POST");
    } catch (e) {
      throw httpError(e.status || 500, e.message);
    }

    const newPlayId = payload.playid || payload.numplays || null;
    if (!newPlayId) {
      logger.warn("[bgg/POST] geekplay returned no playid", { payload });
      throw httpError(
        502,
        "BGG no devolvió un ID de partida. La partida no se guardó.",
      );
    }

    const verified = await verifyPlayOnBgg(user.bggUsername, newPlayId, {
      gameId: req.body.objectid,
      playdate: req.body.playdate,
    });
    if (!verified) {
      throw httpError(
        502,
        "BGG no confirmó la partida después de guardarla. Intentá de nuevo.",
      );
    }

    clearPartidasCache(user.bggUsername);

    // Only mirror to Mongo if this user is already in Mongo-served mode
    // (i.e. has done a full sync). Otherwise the GET fallback to BGG will
    // pick up the new play on its next call.
    const lower = user.bggUsername.toLowerCase();
    if (await BggPlay.exists({ bggUsername: lower })) {
      try {
        await upsertPlayFromBgg(user.bggUsername, verified);
      } catch (e) {
        logger.warn("[bgg/POST] mirror to Mongo failed", { error: e.message });
      }
    }

    // Invalida el cache "Mis juegos" → la próxima apertura del selector lo
    // reconstruye con el juego/partida recién agregado.
    await markUserGamesDirty(user.bggUsername);

    res.json({
      success: true,
      playid: String(newPlayId),
      play: playToApi(verified),
    });
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

    clearPartidasCache(user.bggUsername);
    try {
      await BggPlay.deleteOne({
        bggUsername: user.bggUsername.toLowerCase(),
        playId: String(playId),
      });
    } catch (e) {
      logger.warn("[bgg/DELETE] mirror to Mongo failed", { error: e.message });
    }

    await markUserGamesDirty(user.bggUsername);

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

    clearPartidasCache(user.bggUsername);
    const lower = user.bggUsername.toLowerCase();
    if (await BggPlay.exists({ bggUsername: lower })) {
      try {
        await upsertPlayFromBgg(user.bggUsername, verified);
      } catch (e) {
        logger.warn("[bgg/PUT] mirror to Mongo failed", { error: e.message });
      }
    }

    await markUserGamesDirty(user.bggUsername);

    res.json({ success: true, playid: playId, play: playToApi(verified) });
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
