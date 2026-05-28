const express = require("express");
const router = express.Router();
const multer = require("../config/multer");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");
const Compartida = require("../models/Compartida");
const CompartidaComment = require("../models/CompartidaComment");
const Table = require("../models/Table");
const Evento = require("../models/Evento");
const { protect, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { parsePagination } = require("../utils/paginate");
const { emitNotificationReq } = require("../utils/emitNotification");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");
const { assertLinkable } = require("../utils/tablePrivacy");

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
      "boardGame date maxPlayers players host status location",
    )
    .populate("linkedEvento", "title eventDate location image status");

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

// ── Attach real comment counts to an array of compartida objects ─────────────
const withCommentCounts = async (compartidas) => {
  const ids = compartidas.map((j) => j._id);
  const counts = await CompartidaComment.aggregate([
    { $match: { compartida: { $in: ids } } },
    { $group: { _id: "$compartida", count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(
    counts.map((c) => [c._id.toString(), c.count]),
  );
  return compartidas.map((j) => ({
    ...j.toObject(),
    commentCount: map[j._id.toString()] ?? 0,
  }));
};

// ── GET /api/compartidas — paginated feed (public compartidas visible without auth) ─
router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = visibilityFilter(req.user);

    // "Compartida del día" — most-liked post in the last 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [compartidas, total, allRecent] = await Promise.all([
      populateCompartida(Compartida.find(filter))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Compartida.countDocuments(filter),
      Compartida.find({ ...filter, createdAt: { $gte: since24h } })
        .sort({ "likes.length": -1 })
        .limit(10)
        .select("_id likes"),
    ]);

    // Pick the one with most likes from the last 24h
    const featuredId = allRecent.length
      ? allRecent.reduce((best, j) =>
          j.likes.length > best.likes.length ? j : best,
        )._id
      : null;

    const featured = featuredId
      ? await populateCompartida(Compartida.findById(featuredId))
      : null;

    const allForCounts = [...compartidas, ...(featured ? [featured] : [])];
    const withCounts = await withCommentCounts(allForCounts);
    const featuredWithCount = featured
      ? withCounts.find((j) => isSameId(j._id, featured._id))
      : null;
    const compartidasWithCounts = withCounts.filter(
      (j) => !featured || !isSameId(j._id, featured._id),
    );

    res.json({
      compartidas: compartidasWithCounts,
      featured: featuredWithCount ?? null,
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
        .select("title body images privacy author");
      if (!compartida || compartida.privacy !== "public") {
        return res.status(404).json({});
      }
      res.json({
        title: compartida.title || null,
        body: compartida.body?.slice(0, 160) || null,
        image: compartida.images?.[0]?.url || null,
        author: compartida.author.displayName || compartida.author.username,
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
    const { title, body, linkedTable, linkedEvento, privacy } = req.body;

    if (!title?.trim() && !body?.trim()) {
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
      title: title?.trim() || "",
      body: body?.trim() || "",
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

    const { title, body, privacy, linkedTable, linkedEvento } = req.body;
    if (title !== undefined) compartida.title = title.trim();
    if (body !== undefined) compartida.body = body.trim();
    if (privacy !== undefined) compartida.privacy = privacy;
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
    if (!isSameId(compartida.author, req.user._id) && !req.user.isAdmin) {
      throw httpError(403, "Solo el autor puede eliminar esta compartida");
    }

    // Delete images from Cloudinary
    await Promise.allSettled(
      compartida.images.map((img) => cloudinary.uploader.destroy(img.publicId)),
    );

    await CompartidaComment.deleteMany({ compartida: compartida._id });
    await compartida.deleteOne();

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
    const isVisible =
      compartida.privacy === "public" ||
      isSameId(compartida.author, uid) ||
      (compartida.privacy === "friends" &&
        req.user.friends.some((f) => isSameId(f, compartida.author)));
    if (!isVisible) {
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
        },
        "compartida:like",
        { fromUsername: req.user.username },
      ).catch(() => {});
    }

    res.json({ likes: compartida.likes.length, liked: adding });
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
router.get(
  "/:id/comments",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const comments = await CompartidaComment.find({
      compartida: req.params.id,
    })
      .populate("author", "username avatar displayName")
      .sort({ createdAt: 1 });
    res.json(comments);
  }),
);

// ── POST /api/compartidas/:id/comments ──────────────────────────────────────
router.post(
  "/:id/comments",
  protect,
  asyncHandler(async (req, res) => {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida) throw httpError(404, "Compartida no encontrada");

    const { content } = req.body;
    if (!content?.trim()) {
      throw httpError(400, "El comentario no puede estar vacío");
    }

    const comment = await CompartidaComment.create({
      compartida: compartida._id,
      author: req.user._id,
      content: content.trim(),
    });
    await comment.populate("author", "username avatar displayName");

    if (!isSameId(compartida.author, req.user._id)) {
      const preview = content.trim().slice(0, 60);
      await emitNotificationReq(
        req,
        compartida.author,
        "compartida_comment",
        {
          compartidaId: compartida._id.toString(),
          compartidaTitle: compartida.title || "",
          lastCommenterUsername: req.user.username,
          lastCommentPreview: preview,
        },
        "compartida:comment",
        { commenterUsername: req.user.username, commentPreview: preview },
      ).catch(() => {});
    }

    res.status(201).json(comment);
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

    res.json(comment);
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
    res.json({ message: "Comentario eliminado" });
  }),
);

module.exports = router;
