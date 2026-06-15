const express = require("express");
const router = express.Router();
const multer = require("../config/multer");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");
const Compartida = require("../models/Compartida");
const CompartidaComment = require("../models/CompartidaComment");
const User = require("../models/User");
const Table = require("../models/Table");
const Evento = require("../models/Evento");
const Community = require("../models/Community");
const { protect, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const {
  resolveCommunities,
  communityFilter,
} = require("../middleware/resolveCommunities");
const communityService = require("../services/communityService");
const validateObjectId = require("../middleware/validateObjectId");
const { parsePagination } = require("../utils/paginate");
const { emitNotificationReq } = require("../utils/emitNotification");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");
const serializeComment = require("../utils/serializeComment");
const { assertLinkable } = require("../utils/tablePrivacy");
const { sanitizeRichHtml, stripHtml } = require("../utils/sanitizeHtml");
const { escapeRegex } = require("../utils/regex");
const { resolveGame } = require("../services/bgg/bggResolve");

router.use(requireSection("compartidas"));

router.param("id", validateObjectId("id"));
router.param("imgId", validateObjectId("imgId"));
router.param("cid", validateObjectId("cid"));

const POPULATE_AUTHOR_FIELDS = "username avatar displayName bggUsername";

const populateCompartida = (query) =>
  query
    .populate("author", POPULATE_AUTHOR_FIELDS)
    .populate(
      "linkedTable",
      "boardGame date maxPlayers players host status location bggThumbnail",
    )
    .populate("linkedEvento", "title eventDate location image status")
    // Identidad EN VIVO de los jugadores del scorecard que son usuarios de
    // TurnoCero — nombre/avatar se resuelven desde el perfil actual. Select
    // acotado a campos públicos (el feed serializa vía toObject, no toJSON, así
    // que la proyección es la que garantiza que no se filtre nada sensible).
    .populate("playResult.players.userId", "username displayName avatar");

// ── Privacy filter helper ──────────────────────────────────────────────────
const visibilityFilter = (user) => {
  if (!user) return { privacy: "public" };
  return {
    $or: [
      { privacy: "public" },
      { privacy: "friends", author: { $in: user.friends } },
      { author: user._id },
    ],
  };
};

// Chequeo de visibilidad por-documento (espejo de `visibilityFilter`, pero
// para un doc ya cargado). Usado por el toggle de like de comentario y los
// endpoints "¿quién likeó?".
const isCompartidaVisible = (compartida, user) => {
  if (compartida.privacy === "public") return true;
  if (!user) return false;
  if (isSameId(compartida.author, user._id)) return true;
  return (
    compartida.privacy === "friends" &&
    (user.friends || []).some((f) => isSameId(f, compartida.author))
  );
};

// ── Resolve a board-game snapshot from a client-sent { bggId } ───────────────
// Nunca confiamos en el name/thumbnail/image que manda el cliente: el endpoint
// de búsqueda de BGG devuelve thumbnails null, así que re-resolvemos el arte
// server-side vía `resolveGame`. Devuelve null si no hay bggId; tira 400 si el
// juego no existe en BGG.
const resolveBoardGameSnapshot = async (input) => {
  const bggId = Number(input?.bggId ?? input?.id ?? input);
  if (!Number.isFinite(bggId) || bggId <= 0) return null;
  const game = await resolveGame(bggId);
  if (!game) throw httpError(400, "Juego no encontrado en BGG");
  return {
    bggId: game.id,
    name: game.name,
    thumbnail: game.thumbnail || "",
    image: game.image || "",
    year: game.year ?? null,
  };
};

// Máximo de juegos por juntada (evita listas absurdas).
const MAX_JUNTADA_GAMES = 12;

// Resuelve una lista de juegos (juntada), deduplicando por bggId y respetando
// el tope. Cada item se re-resuelve server-side (igual que el snapshot único).
const resolveBoardGameList = async (input) => {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const item of input.slice(0, MAX_JUNTADA_GAMES)) {
    const snap = await resolveBoardGameSnapshot(item);
    if (snap && !seen.has(snap.bggId)) {
      seen.add(snap.bggId);
      out.push(snap);
    }
  }
  return out;
};

// Sanitiza el snapshot de resultados (`playResult`) de una juntada compartida
// desde BG Watch. Es data render-only del propio autor (sus jugadores/scores):
// se coerciona y acota, NO se re-resuelve contra BGG (salvo el thumbnail del
// juego, igual que boardGames). Devuelve null si no hay jugadores.
const MAX_SNAPSHOT_PLAYERS = 24;
const PLAY_MODES = ["versus", "coop", "equipos"];
const clampStr = (v, max) => String(v ?? "").slice(0, max);
const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const sanitizePlayResult = async (input) => {
  if (!input || typeof input !== "object") return null;
  const players = Array.isArray(input.players) ? input.players : [];
  if (players.length === 0) return null;

  const gameId = numOrNull(input.gameId);
  let game = {
    name: clampStr(input.game?.name, 120),
    thumbnail: clampStr(input.game?.thumbnail, 500),
  };
  // Re-resolver el arte del juego desde el bggId (best-effort; nunca 400).
  if (gameId && gameId > 0) {
    try {
      const resolved = await resolveGame(gameId);
      if (resolved) {
        game = {
          name: resolved.name || game.name,
          thumbnail: resolved.thumbnail || game.thumbnail,
        };
      }
    } catch {
      /* ignore — usamos lo que mandó el cliente */
    }
  }

  const capped = players.slice(0, MAX_SNAPSHOT_PLAYERS);

  // Vincular cada jugador a su cuenta de TurnoCero por @BGG. Lo derivamos
  // server-side (no se confía en un userId del cliente — sería spoofeable), un
  // único query batcheado por la lista de @BGG. Match case-insensitive porque
  // `bggUsername` se guarda con la capitalización original.
  const handles = [
    ...new Set(
      capped
        .filter((p) => !p?.anonymous && p?.username)
        .map((p) => String(p.username).trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const userIdByHandle = new Map();
  if (handles.length) {
    const users = await User.find({ bggUsername: { $in: handles } })
      .collation({ locale: "en", strength: 2 })
      .select("_id bggUsername");
    for (const u of users)
      if (u.bggUsername) userIdByHandle.set(u.bggUsername.toLowerCase(), u._id);
  }

  return {
    mode: PLAY_MODES.includes(input.mode) ? input.mode : "versus",
    game,
    gameId,
    date: clampStr(input.date, 10),
    duration: numOrNull(input.duration),
    players: capped.map((p) => {
      const handle =
        !p?.anonymous && p?.username
          ? String(p.username).trim().toLowerCase()
          : "";
      return {
        name: clampStr(p?.name, 100),
        username: clampStr(p?.username, 50),
        userId: handle ? userIdByHandle.get(handle) || null : null,
        anonymous: !!p?.anonymous,
        score: clampStr(p?.score, 30),
        win: !!p?.win,
        new: !!p?.new,
        team: /^[A-D]$/.test(String(p?.team || "")) ? String(p.team) : "",
        position: numOrNull(p?.position),
      };
    }),
  };
};

// ── Build a { compartidaId → commentCount } map for a set of docs ────────────
const commentCountMap = async (docs) => {
  const ids = docs.map((j) => j._id);
  const counts = await CompartidaComment.aggregate([
    { $match: { compartida: { $in: ids } } },
    { $group: { _id: "$compartida", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
};

// Apply a comment-count map to a list of compartida docs (→ plain objects).
const attachCounts = (docs, map) =>
  docs.map((j) => ({
    ...j.toObject(),
    commentCount: map[j._id.toString()] ?? 0,
  }));

// ── GET /api/compartidas — paginated feed (public compartidas visible without auth) ─
router.get(
  "/",
  optionalAuth,
  resolveCommunities,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);

    // Filtros de pestaña (category) y búsqueda (q). El filtro de visibilidad
    // siempre se respeta — se combina con $and para que `q` no lo bypassee.
    const visibility = visibilityFilter(req.user);
    const scope = communityFilter(req);
    const category = ["resena", "juntada"].includes(req.query.category)
      ? req.query.category
      : null;
    const q = (req.query.q || "").trim();

    const clauses = [visibility, scope];
    if (category) clauses.push({ category });
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      clauses.push({
        $or: [
          { title: rx },
          { "boardGame.name": rx },
          { "boardGames.name": rx },
        ],
      });
    }
    const filter = clauses.length > 1 ? { $and: clauses } : clauses[0];

    // El featured ("Compartida del día") solo tiene sentido en la vista sin
    // filtros — al filtrar por tab o buscar, devolvemos una lista plana.
    const isFiltered = Boolean(category) || Boolean(q);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [compartidas, total, topEngaged] = await Promise.all([
      populateCompartida(Compartida.find(filter))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Compartida.countDocuments(filter),
      // Post con más "engagement" (likes + comentarios) en las últimas 24h.
      // Los comentarios viven en otra colección → $lookup para contarlos.
      // Empate → el más reciente. Se usa aggregation porque Mongo no puede
      // ordenar por el tamaño de un array vía sort() de un find().
      isFiltered
        ? Promise.resolve([])
        : Compartida.aggregate([
            {
              $match: {
                ...visibility,
                ...scope,
                createdAt: { $gte: since24h },
              },
            },
            {
              $lookup: {
                from: CompartidaComment.collection.name,
                localField: "_id",
                foreignField: "compartida",
                as: "_comments",
              },
            },
            {
              $addFields: {
                engagement: {
                  $add: [
                    { $size: { $ifNull: ["$likes", []] } },
                    { $size: "$_comments" },
                  ],
                },
              },
            },
            // Umbral mínimo: sin engagement no hay destacado (no destacamos un
            // post solo por ser reciente).
            { $match: { engagement: { $gte: 1 } } },
            { $sort: { engagement: -1, createdAt: -1 } },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ]),
    ]);

    const featuredId = topEngaged.length ? topEngaged[0]._id : null;

    const featured = featuredId
      ? await populateCompartida(Compartida.findById(featuredId))
      : null;

    // Un solo mapa de conteos para todas las listas (dedup por id implícito).
    const countMap = await commentCountMap([
      ...compartidas,
      ...(featured ? [featured] : []),
    ]);

    // El featured se excluye de la lista principal para no duplicarlo.
    const listDocs = featured
      ? compartidas.filter((c) => !isSameId(c._id, featured._id))
      : compartidas;

    res.json({
      compartidas: attachCounts(listDocs, countMap),
      featured: featured ? attachCounts([featured], countMap)[0] : null,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }),
);

// ── GET /api/compartidas/:id/og — public OG data for crawlers (no auth) ────
// Responde 404 con body vacío (no { message }) para crawlers — la convención
// general del errorHandler aplica { message } a 4xx, así que este endpoint
// usa un return explícito con res.status().json() para preservar el contrato
// específico que esperan los crawlers (OG es defensivo, no info-leak).
router.get(
  "/:id/og",
  asyncHandler(async (req, res) => {
    try {
      const compartida = await Compartida.findById(req.params.id)
        .populate("author", "username displayName")
        .select("title body images privacy author category rating boardGame");
      if (!compartida || compartida.privacy !== "public") {
        return res.status(404).json({});
      }
      // Para reseñas el body es HTML → recortar texto plano. Para juntadas es
      // texto plano directo.
      const preview =
        compartida.category === "resena"
          ? stripHtml(compartida.body)
          : compartida.body || "";
      res.json({
        title: compartida.title || null,
        body: preview.slice(0, 160) || null,
        image:
          compartida.images?.[0]?.url ||
          compartida.boardGame?.image ||
          compartida.boardGame?.thumbnail ||
          null,
        author: compartida.author.displayName || compartida.author.username,
        category: compartida.category,
        rating: compartida.rating ?? null,
        game: compartida.boardGame?.name || null,
      });
    } catch {
      res.status(500).json({});
    }
  }),
);

// ── GET /api/compartidas/:id — single post (public compartidas visible without auth) ─
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const compartida = await populateCompartida(
      Compartida.findById(req.params.id),
    );
    if (!compartida) throw httpError(404, "Compartida no encontrada");

    if (!req.user) {
      if (compartida.privacy !== "public") {
        throw httpError(403, "No tenés acceso a esta compartida");
      }
    } else {
      const isAuthor = isSameId(compartida.author._id, req.user._id);
      const isFriend = req.user.friends.some((f) =>
        isSameId(f, compartida.author._id),
      );
      if (
        (compartida.privacy === "private" && !isAuthor) ||
        (compartida.privacy === "friends" && !isAuthor && !isFriend)
      ) {
        throw httpError(403, "No tenés acceso a esta compartida");
      }
    }

    const commentCount = await CompartidaComment.countDocuments({
      compartida: compartida._id,
    });
    res.json({ ...compartida.toObject(), commentCount });
  }),
);

// ── POST /api/compartidas — create ───────────────────────────────────────────
router.post(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const {
      title,
      body,
      linkedTable,
      linkedEvento,
      privacy,
      boardGame,
      boardGames,
    } = req.body;
    const category = req.body.category === "resena" ? "resena" : "juntada";
    const rating = req.body.rating;

    // Reseña: 1 juego + rating obligatorios; body HTML sanitizado.
    // Juntada: lista de juegos opcional (0..N); body plano.
    let boardGameSnapshot = null;
    let boardGameList = [];
    let finalBody = body?.trim() || "";
    let finalRating = null;

    if (category === "resena") {
      if (!boardGame?.bggId && !boardGame?.id) {
        throw httpError(400, "La reseña necesita un juego");
      }
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 10) {
        throw httpError(400, "Elegí una puntuación de 1 a 10");
      }
      boardGameSnapshot = await resolveBoardGameSnapshot(boardGame);
      finalRating = r;
      finalBody = sanitizeRichHtml(body || "");
    } else {
      // Juntada: aceptar lista `boardGames`, o un `boardGame` único (compat).
      boardGameList = await resolveBoardGameList(
        boardGames || (boardGame ? [boardGame] : []),
      );
    }

    // Snapshot de resultados (solo juntadas; el cliente lo arma del scorecard).
    const playResultSnapshot =
      category === "juntada"
        ? await sanitizePlayResult(req.body.playResult)
        : null;

    const hasBody =
      category === "resena" ? stripHtml(finalBody).length > 0 : !!finalBody;
    // El widget de resultados cuenta como contenido: una juntada con solo el
    // scorecard (sin título/texto/foto) es válida.
    if (!title?.trim() && !hasBody && !playResultSnapshot) {
      throw httpError(400, "La compartida necesita al menos un título o texto");
    }

    // Validate linkedTable belongs to the user (host or player) y que sea
    // pública — privadas/amigos no se exponen vía Compartidas (la UI ya esconde
    // el botón "Compartir", pero acá blindamos contra POST directo a la API).
    if (linkedTable) {
      const table = await Table.findById(linkedTable);
      if (!table) throw httpError(404, "Mesa no encontrada");
      const isMember =
        isSameId(table.host, req.user._id) ||
        table.players.some((p) => isSameId(p, req.user._id));
      if (!isMember) {
        throw httpError(
          403,
          "Solo podés vincular mesas en las que participaste",
        );
      }
      assertLinkable(table);
    }

    // Validate linkedEvento: el user fue parte (author o inscripción confirmed/pending).
    // Rechazados quedan fuera — no participaron.
    if (linkedEvento) {
      const evento = await Evento.findById(linkedEvento);
      if (!evento) throw httpError(404, "Evento no encontrado");
      const isAuthor = isSameId(evento.author, req.user._id);
      const isActive = (evento.registrations || []).some(
        (r) =>
          r.user &&
          isSameId(r.user, req.user._id) &&
          (r.status === "confirmed" || r.status === "pending"),
      );
      if (!isAuthor && !isActive) {
        throw httpError(
          403,
          "Solo podés vincular eventos en los que participaste",
        );
      }
    }

    const compartida = await Compartida.create({
      author: req.user._id,
      community: await communityService.resolveCreateCommunity(
        req.user,
        req.body.community,
        req.tenant,
      ),
      category,
      title: title?.trim() || "",
      body: finalBody,
      boardGame: boardGameSnapshot,
      boardGames: boardGameList,
      rating: finalRating,
      playResult: playResultSnapshot,
      linkedTable: linkedTable || null,
      linkedEvento: linkedEvento || null,
      privacy: privacy || "public",
    });

    const populated = await populateCompartida(
      Compartida.findById(compartida._id),
    );
    res.status(201).json(populated);
  }),
);

// ── PUT /api/compartidas/:id — edit (author only) ───────────────────────────
router.put(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida) throw httpError(404, "Compartida no encontrada");
    if (!isSameId(compartida.author, req.user._id)) {
      throw httpError(403, "Solo el autor puede editar esta compartida");
    }

    const {
      title,
      body,
      privacy,
      linkedTable,
      linkedEvento,
      boardGame,
      boardGames,
    } = req.body;
    const isResena = compartida.category === "resena";

    // category es inmutable tras crear (cambiar de tipo = borrar y recrear).
    if (
      req.body.category !== undefined &&
      req.body.category !== compartida.category
    ) {
      throw httpError(400, "No se puede cambiar el tipo de una compartida");
    }

    if (title !== undefined) compartida.title = title.trim();
    if (body !== undefined) {
      compartida.body = isResena ? sanitizeRichHtml(body) : body.trim();
    }
    if (privacy !== undefined) compartida.privacy = privacy;

    // Solo las reseñas tienen rating/juego editables.
    if (isResena) {
      if (req.body.rating !== undefined) {
        const r = Number(req.body.rating);
        if (!Number.isInteger(r) || r < 1 || r > 10) {
          throw httpError(400, "Elegí una puntuación de 1 a 10");
        }
        compartida.rating = r;
      }
      if (boardGame !== undefined) {
        if (!boardGame?.bggId && !boardGame?.id) {
          throw httpError(400, "La reseña necesita un juego");
        }
        compartida.boardGame = await resolveBoardGameSnapshot(boardGame);
      }
    } else if (boardGames !== undefined || boardGame !== undefined) {
      // Juntada: editar la lista de juegos (acepta `boardGames` o un
      // `boardGame` único por compat).
      compartida.boardGames = await resolveBoardGameList(
        boardGames || (boardGame ? [boardGame] : []),
      );
    }
    if (linkedTable !== undefined) {
      // Mismo check que POST: si se está seteando una mesa, debe ser pública
      // y el autor debe haber participado.
      if (linkedTable) {
        const table = await Table.findById(linkedTable);
        if (!table) throw httpError(404, "Mesa no encontrada");
        const isMember =
          isSameId(table.host, req.user._id) ||
          table.players.some((p) => isSameId(p, req.user._id));
        if (!isMember) {
          throw httpError(
            403,
            "Solo podés vincular mesas en las que participaste",
          );
        }
        assertLinkable(table);
      }
      compartida.linkedTable = linkedTable || null;
    }
    if (linkedEvento !== undefined) {
      // Validar participación si se está seteando (no si se está limpiando).
      if (linkedEvento) {
        const evento = await Evento.findById(linkedEvento);
        if (!evento) throw httpError(404, "Evento no encontrado");
        const isAuthor = isSameId(evento.author, req.user._id);
        const isActive = (evento.registrations || []).some(
          (r) =>
            r.user &&
            isSameId(r.user, req.user._id) &&
            (r.status === "confirmed" || r.status === "pending"),
        );
        if (!isAuthor && !isActive) {
          throw httpError(
            403,
            "Solo podés vincular eventos en los que participaste",
          );
        }
      }
      compartida.linkedEvento = linkedEvento || null;
    }

    await compartida.save();
    const populated = await populateCompartida(
      Compartida.findById(compartida._id),
    );
    res.json(populated);
  }),
);

// ── DELETE /api/compartidas/:id — delete (author only) ──────────────────────
router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida) throw httpError(404, "Compartida no encontrada");
    // Autor, admin global, o subadmin de la comunidad del post.
    if (!communityService.canModerate(req.user, compartida)) {
      throw httpError(403, "No tenés permiso para eliminar esta compartida");
    }
    const moderatedByOther = !isSameId(compartida.author, req.user._id);
    const authorId = compartida.author;
    const communityId = compartida.community;

    // Delete images from Cloudinary
    await Promise.allSettled(
      compartida.images.map((img) => cloudinary.uploader.destroy(img.publicId)),
    );

    await CompartidaComment.deleteMany({ compartida: compartida._id });
    await compartida.deleteOne();

    // Si lo bajó un moderador (no el autor), avisamos al autor.
    if (moderatedByOther && communityId) {
      const community =
        await Community.findById(communityId).select("name slug");
      await emitNotificationReq(
        req,
        authorId,
        "community_content_removed",
        {
          communityId: String(communityId),
          communityName: community?.name || "",
          communitySlug: community?.slug || "",
        },
        "community:content-removed",
      );
    }

    res.json({ message: "Compartida eliminada" });
  }),
);

// ── POST /api/compartidas/:id/like — toggle like ────────────────────────────
router.post(
  "/:id/like",
  protect,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida) throw httpError(404, "Compartida no encontrada");

    // Enforce visibility
    const uid = req.user._id;
    if (!isCompartidaVisible(compartida, req.user)) {
      throw httpError(403, "No tenés acceso a esta compartida");
    }

    const idx = compartida.likes.findIndex((l) => isSameId(l, uid));
    const adding = idx === -1;
    if (adding) {
      compartida.likes.push(uid);
    } else {
      compartida.likes.splice(idx, 1);
    }
    await compartida.save();

    if (adding && !isSameId(compartida.author, uid)) {
      await emitNotificationReq(
        req,
        compartida.author,
        "compartida_like",
        {
          compartidaId: compartida._id.toString(),
          compartidaTitle: compartida.title || "",
          lastSenderUsername: req.user.username,
          actor: {
            userId: req.user._id.toString(),
            username: req.user.username,
          },
        },
        "compartida:like",
        { fromUsername: req.user.username },
      ).catch(() => {});
    }

    res.json({ likes: compartida.likes.length, liked: adding });
  }),
);

// ── GET /api/compartidas/:id/likes — lista de quién likeó el post ───────────
// Devuelve los users poblados (más reciente primero). Respeta visibilidad.
router.get(
  "/:id/likes",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id).populate(
      "likes",
      "username displayName avatar",
    );
    if (!compartida) throw httpError(404, "Compartida no encontrada");
    if (!isCompartidaVisible(compartida, req.user)) {
      throw httpError(403, "No tenés acceso a esta compartida");
    }
    // El array se llena por orden de like (push); lo invertimos para mostrar
    // el like más reciente primero.
    res.json({ users: [...compartida.likes].reverse() });
  }),
);

// ── POST /api/compartidas/inline-image — sube una imagen para el editor ─────
// Usado por el RichTextEditor de las reseñas: la imagen se sube ANTES de que
// la compartida exista (durante la composición), así que no se vincula a un
// doc. Devuelve la URL de Cloudinary para insertarla inline en el HTML.
router.post(
  "/inline-image",
  protect,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, "No se recibió ninguna imagen");
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/compartidas/inline/${req.user._id}`,
      transformation: [{ width: 1200, crop: "limit" }],
    });
    res
      .status(201)
      .json({ url: result.secure_url, publicId: result.public_id });
  }),
);

// ── POST /api/compartidas/:id/images — upload (author only, max 3) ──────────
router.post(
  "/:id/images",
  protect,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, "No se recibió ninguna imagen");

    const compartida = await Compartida.findById(req.params.id);
    if (!compartida) throw httpError(404, "Compartida no encontrada");
    if (!isSameId(compartida.author, req.user._id)) {
      throw httpError(403, "Solo el autor puede subir imágenes");
    }
    if (compartida.images.length >= 3) {
      throw httpError(400, "Máximo 3 imágenes por compartida");
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/compartidas/${req.params.id}`,
      transformation: [{ width: 1200, crop: "limit" }],
    });

    compartida.images.push({
      url: result.secure_url,
      publicId: result.public_id,
    });
    await compartida.save();

    res.status(201).json(compartida.images);
  }),
);

// ── DELETE /api/compartidas/:id/images/:imgId ───────────────────────────────
router.delete(
  "/:id/images/:imgId",
  protect,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida) throw httpError(404, "Compartida no encontrada");

    const image = compartida.images.id(req.params.imgId);
    if (!image) throw httpError(404, "Imagen no encontrada");

    const isAuthor = isSameId(compartida.author, req.user._id);
    if (!isAuthor && !req.user.isAdmin) {
      throw httpError(403, "No tenés permiso para eliminar esta imagen");
    }

    await cloudinary.uploader.destroy(image.publicId);
    image.deleteOne();
    await compartida.save();

    res.json({ message: "Imagen eliminada" });
  }),
);

// ── GET /api/compartidas/:id/comments ───────────────────────────────────────
// Paginado por comentarios de NIVEL SUPERIOR (más nuevos primero). Cada uno
// trae sus `replies` (respuestas) anidadas, ordenadas de más viejas a más
// nuevas (como en FB). `total` cuenta TODOS los comentarios (top-level +
// respuestas) para que el contador del footer sea exacto; `pages` pagina solo
// los de nivel superior.
router.get(
  "/:id/comments",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 50,
    });
    const base = { compartida: req.params.id };
    const [topLevel, topTotal, total] = await Promise.all([
      CompartidaComment.find({ ...base, parent: null })
        .populate("author", "username avatar displayName")
        // `_id` como desempate: orden estable cuando comparten `createdAt`.
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      CompartidaComment.countDocuments({ ...base, parent: null }),
      CompartidaComment.countDocuments(base),
    ]);

    // Respuestas de los top-level de esta página (ascendente: viejas primero).
    const parentIds = topLevel.map((c) => c._id);
    const replies = parentIds.length
      ? await CompartidaComment.find({ ...base, parent: { $in: parentIds } })
          .populate("author", "username avatar displayName")
          .sort({ createdAt: 1, _id: 1 })
      : [];
    const uid = req.user?._id;
    const byParent = new Map();
    for (const r of replies) {
      const k = r.parent.toString();
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(serializeComment(r, uid));
    }

    const comments = topLevel.map((c) => ({
      ...serializeComment(c, uid),
      replies: byParent.get(c._id.toString()) || [],
    }));

    res.json({ comments, total, page, pages: Math.ceil(topTotal / limit) });
  }),
);

// ── POST /api/compartidas/:id/comments ──────────────────────────────────────
router.post(
  "/:id/comments",
  protect,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida) throw httpError(404, "Compartida no encontrada");

    const { content, parent } = req.body;
    if (!content?.trim()) {
      throw httpError(400, "El comentario no puede estar vacío");
    }

    // Respuesta: validar que el padre exista y sea de esta compartida.
    // Aplanar a 1 nivel — si el padre ya es una respuesta, colgamos del raíz.
    let parentId = null;
    if (parent) {
      const parentComment =
        await CompartidaComment.findById(parent).select("compartida parent");
      if (
        !parentComment ||
        !isSameId(parentComment.compartida, compartida._id)
      ) {
        throw httpError(400, "Comentario padre inválido");
      }
      parentId = parentComment.parent || parentComment._id;
    }

    const comment = await CompartidaComment.create({
      compartida: compartida._id,
      author: req.user._id,
      content: content.trim(),
      parent: parentId,
    });
    await comment.populate("author", "username avatar displayName");

    const preview = content.trim().slice(0, 60);
    const notifyComment = (recipientId) =>
      emitNotificationReq(
        req,
        recipientId,
        "compartida_comment",
        {
          compartidaId: compartida._id.toString(),
          compartidaTitle: compartida.title || "",
          lastCommenterUsername: req.user.username,
          lastCommentPreview: preview,
          actor: {
            userId: req.user._id.toString(),
            username: req.user.username,
          },
        },
        "compartida:comment",
        { commenterUsername: req.user.username, commentPreview: preview },
      ).catch(() => {});

    // Destinatarios: el autor del post + los demás usuarios que ya comentaron
    // el hilo (incluye al autor del comentario respondido). Se excluye a quien
    // acaba de comentar y se dedupea por id.
    const commenterIds = await CompartidaComment.distinct("author", {
      compartida: compartida._id,
    });
    const recipients = new Map(); // id → ObjectId (dedupe)
    if (!isSameId(compartida.author, req.user._id)) {
      recipients.set(compartida.author.toString(), compartida.author);
    }
    for (const uid of commenterIds) {
      if (!isSameId(uid, req.user._id)) recipients.set(uid.toString(), uid);
    }
    await Promise.all([...recipients.values()].map(notifyComment));

    res.status(201).json(serializeComment(comment, req.user._id));
  }),
);

// ── PUT /api/compartidas/:id/comments/:cid ──────────────────────────────────
router.put(
  "/:id/comments/:cid",
  protect,
  asyncHandler(async (req, res) => {
    const comment = await CompartidaComment.findById(req.params.cid);
    if (!comment) throw httpError(404, "Comentario no encontrado");
    if (!isSameId(comment.author, req.user._id)) {
      throw httpError(403, "Solo el autor puede editar este comentario");
    }

    const { content } = req.body;
    if (!content?.trim()) {
      throw httpError(400, "El comentario no puede estar vacío");
    }

    comment.content = content.trim();
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate("author", "username avatar displayName");

    res.json(serializeComment(comment, req.user._id));
  }),
);

// ── DELETE /api/compartidas/:id/comments/:cid ───────────────────────────────
router.delete(
  "/:id/comments/:cid",
  protect,
  asyncHandler(async (req, res) => {
    const comment = await CompartidaComment.findById(req.params.cid);
    if (!comment) throw httpError(404, "Comentario no encontrado");

    const compartida = await Compartida.findById(req.params.id).select(
      "author",
    );
    const isCommentAuthor = isSameId(comment.author, req.user._id);
    const isPostAuthor =
      compartida && isSameId(compartida.author, req.user._id);

    if (!isCommentAuthor && !isPostAuthor && !req.user.isAdmin) {
      throw httpError(403, "No tenés permiso para eliminar este comentario");
    }

    await comment.deleteOne();
    // Si era un comentario raíz, borrar en cascada sus respuestas.
    if (!comment.parent) {
      await CompartidaComment.deleteMany({
        compartida: req.params.id,
        parent: comment._id,
      });
    }
    res.json({ message: "Comentario eliminado" });
  }),
);

// ── POST /api/compartidas/:id/comments/:cid/like — toggle like de comentario ─
router.post(
  "/:id/comments/:cid/like",
  protect,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id).select(
      "author privacy title",
    );
    if (!compartida) throw httpError(404, "Compartida no encontrada");
    if (!isCompartidaVisible(compartida, req.user)) {
      throw httpError(403, "No tenés acceso a esta compartida");
    }

    const comment = await CompartidaComment.findById(req.params.cid);
    if (!comment || !isSameId(comment.compartida, compartida._id)) {
      throw httpError(404, "Comentario no encontrado");
    }

    const uid = req.user._id;
    const idx = comment.likes.findIndex((l) => isSameId(l, uid));
    const adding = idx === -1;
    if (adding) comment.likes.push(uid);
    else comment.likes.splice(idx, 1);
    await comment.save();

    if (adding && !isSameId(comment.author, uid)) {
      await emitNotificationReq(
        req,
        comment.author,
        "compartida_comment_like",
        {
          compartidaId: compartida._id.toString(),
          compartidaTitle: compartida.title || "",
          commentId: comment._id.toString(),
          lastSenderUsername: req.user.username,
          actor: {
            userId: req.user._id.toString(),
            username: req.user.username,
          },
        },
        "compartida:comment-like",
        { fromUsername: req.user.username },
      ).catch(() => {});
    }

    res.json({ likes: comment.likes.length, liked: adding });
  }),
);

// ── GET /api/compartidas/:id/comments/:cid/likes — quién likeó el comentario ─
router.get(
  "/:id/comments/:cid/likes",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id).select(
      "author privacy",
    );
    if (!compartida) throw httpError(404, "Compartida no encontrada");
    if (!isCompartidaVisible(compartida, req.user)) {
      throw httpError(403, "No tenés acceso a esta compartida");
    }
    const comment = await CompartidaComment.findById(req.params.cid)
      .select("compartida likes")
      .populate("likes", "username displayName avatar");
    if (!comment || !isSameId(comment.compartida, compartida._id)) {
      throw httpError(404, "Comentario no encontrado");
    }
    res.json({ users: [...comment.likes].reverse() });
  }),
);

module.exports = router;
