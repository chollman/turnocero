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
const { emitNotificationReq } = require("../utils/emitNotification");

router.use(requireSection("compartidas"));

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

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
router.get("/", optionalAuth, async (req, res) => {
  try {
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
      ? withCounts.find((j) => j._id.toString() === featured._id.toString())
      : null;
    const compartidasWithCounts = withCounts.filter(
      (j) => !featured || j._id.toString() !== featured._id.toString(),
    );

    res.json({
      compartidas: compartidasWithCounts,
      featured: featuredWithCount ?? null,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: "Error al cargar el feed" });
  }
});

// ── GET /api/compartidas/:id/og — public OG data for crawlers (no auth) ────
router.get("/:id/og", async (req, res) => {
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
});

// ── GET /api/compartidas/:id — single post (public compartidas visible without auth) ─
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const compartida = await populateCompartida(
      Compartida.findById(req.params.id),
    );
    if (!compartida)
      return res.status(404).json({ message: "Compartida no encontrada" });

    if (!req.user) {
      if (compartida.privacy !== "public") {
        return res
          .status(403)
          .json({ message: "No tenés acceso a esta compartida" });
      }
    } else {
      const uid = req.user._id.toString();
      const isAuthor = compartida.author._id.toString() === uid;
      const isFriend = req.user.friends.some(
        (f) => f.toString() === compartida.author._id.toString(),
      );
      if (
        (compartida.privacy === "private" && !isAuthor) ||
        (compartida.privacy === "friends" && !isAuthor && !isFriend)
      ) {
        return res
          .status(403)
          .json({ message: "No tenés acceso a esta compartida" });
      }
    }

    const commentCount = await CompartidaComment.countDocuments({
      compartida: compartida._id,
    });
    res.json({ ...compartida.toObject(), commentCount });
  } catch (err) {
    res.status(500).json({ message: "Error al cargar la compartida" });
  }
});

// ── POST /api/compartidas — create ───────────────────────────────────────────
router.post("/", protect, async (req, res) => {
  try {
    const { title, body, linkedTable, linkedEvento, privacy } = req.body;

    if (!title?.trim() && !body?.trim()) {
      return res
        .status(400)
        .json({ message: "La compartida necesita al menos un título o texto" });
    }

    // Validate linkedTable belongs to the user (host or player)
    if (linkedTable) {
      const table = await Table.findById(linkedTable);
      if (!table)
        return res.status(404).json({ message: "Mesa no encontrada" });
      const uid = req.user._id.toString();
      const isMember =
        table.host.toString() === uid ||
        table.players.some((p) => p.toString() === uid);
      if (!isMember) {
        return res
          .status(403)
          .json({
            message: "Solo podés vincular mesas en las que participaste",
          });
      }
    }

    // Validate linkedEvento: el user fue parte (author o inscripción confirmed/pending).
    // Rechazados quedan fuera — no participaron.
    if (linkedEvento) {
      const evento = await Evento.findById(linkedEvento);
      if (!evento)
        return res.status(404).json({ message: "Evento no encontrado" });
      const uid = req.user._id.toString();
      const isAuthor = evento.author.toString() === uid;
      const isActive = (evento.registrations || []).some(
        (r) =>
          r.user?.toString() === uid &&
          (r.status === "confirmed" || r.status === "pending"),
      );
      if (!isAuthor && !isActive) {
        return res.status(403).json({
          message: "Solo podés vincular eventos en los que participaste",
        });
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
  } catch (err) {
    res.status(500).json({ message: "Error al crear la compartida" });
  }
});

// ── PUT /api/compartidas/:id — edit (author only) ───────────────────────────
router.put("/:id", protect, async (req, res) => {
  try {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida)
      return res.status(404).json({ message: "Compartida no encontrada" });
    if (compartida.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Solo el autor puede editar esta compartida" });
    }

    const { title, body, privacy, linkedTable, linkedEvento } = req.body;
    if (title !== undefined) compartida.title = title.trim();
    if (body !== undefined) compartida.body = body.trim();
    if (privacy !== undefined) compartida.privacy = privacy;
    if (linkedTable !== undefined) compartida.linkedTable = linkedTable || null;
    if (linkedEvento !== undefined) {
      // Validar participación si se está seteando (no si se está limpiando).
      if (linkedEvento) {
        const evento = await Evento.findById(linkedEvento);
        if (!evento)
          return res.status(404).json({ message: "Evento no encontrado" });
        const uid = req.user._id.toString();
        const isAuthor = evento.author.toString() === uid;
        const isActive = (evento.registrations || []).some(
          (r) =>
            r.user?.toString() === uid &&
            (r.status === "confirmed" || r.status === "pending"),
        );
        if (!isAuthor && !isActive) {
          return res.status(403).json({
            message: "Solo podés vincular eventos en los que participaste",
          });
        }
      }
      compartida.linkedEvento = linkedEvento || null;
    }

    await compartida.save();
    const populated = await populateCompartida(
      Compartida.findById(compartida._id),
    );
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Error al editar la compartida" });
  }
});

// ── DELETE /api/compartidas/:id — delete (author only) ──────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida)
      return res.status(404).json({ message: "Compartida no encontrada" });
    if (
      compartida.author.toString() !== req.user._id.toString() &&
      !req.user.isAdmin
    ) {
      return res
        .status(403)
        .json({ message: "Solo el autor puede eliminar esta compartida" });
    }

    // Delete images from Cloudinary
    await Promise.allSettled(
      compartida.images.map((img) => cloudinary.uploader.destroy(img.publicId)),
    );

    await CompartidaComment.deleteMany({ compartida: compartida._id });
    await compartida.deleteOne();

    res.json({ message: "Compartida eliminada" });
  } catch (err) {
    res.status(500).json({ message: "Error al eliminar la compartida" });
  }
});

// ── POST /api/compartidas/:id/like — toggle like ────────────────────────────
router.post("/:id/like", protect, async (req, res) => {
  try {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida)
      return res.status(404).json({ message: "Compartida no encontrada" });

    // Enforce visibility
    const uid = req.user._id;
    const isVisible =
      compartida.privacy === "public" ||
      compartida.author.toString() === uid.toString() ||
      (compartida.privacy === "friends" &&
        req.user.friends.some(
          (f) => f.toString() === compartida.author.toString(),
        ));
    if (!isVisible)
      return res
        .status(403)
        .json({ message: "No tenés acceso a esta compartida" });

    const idx = compartida.likes.findIndex(
      (l) => l.toString() === uid.toString(),
    );
    const adding = idx === -1;
    if (adding) {
      compartida.likes.push(uid);
    } else {
      compartida.likes.splice(idx, 1);
    }
    await compartida.save();

    if (adding && compartida.author.toString() !== uid.toString()) {
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
  } catch (err) {
    res.status(500).json({ message: "Error al procesar el like" });
  }
});

// ── POST /api/compartidas/:id/images — upload (author only, max 3) ──────────
router.post(
  "/:id/images",
  protect,
  multer.single("image"),
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: "No se recibió ninguna imagen" });

    try {
      const compartida = await Compartida.findById(req.params.id);
      if (!compartida)
        return res.status(404).json({ message: "Compartida no encontrada" });
      if (compartida.author.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Solo el autor puede subir imágenes" });
      }
      if (compartida.images.length >= 3) {
        return res
          .status(400)
          .json({ message: "Máximo 3 imágenes por compartida" });
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
    } catch (err) {
      res.status(500).json({ message: "Error al subir la imagen" });
    }
  },
);

// ── DELETE /api/compartidas/:id/images/:imgId ───────────────────────────────
router.delete("/:id/images/:imgId", protect, async (req, res) => {
  try {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida)
      return res.status(404).json({ message: "Compartida no encontrada" });

    const image = compartida.images.id(req.params.imgId);
    if (!image)
      return res.status(404).json({ message: "Imagen no encontrada" });

    const isAuthor = compartida.author.toString() === req.user._id.toString();
    if (!isAuthor && !req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: "No tenés permiso para eliminar esta imagen" });
    }

    await cloudinary.uploader.destroy(image.publicId);
    image.deleteOne();
    await compartida.save();

    res.json({ message: "Imagen eliminada" });
  } catch (err) {
    res.status(500).json({ message: "Error al eliminar la imagen" });
  }
});

// ── GET /api/compartidas/:id/comments ───────────────────────────────────────
router.get("/:id/comments", optionalAuth, async (req, res) => {
  try {
    const comments = await CompartidaComment.find({ compartida: req.params.id })
      .populate("author", "username avatar displayName")
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Error al cargar los comentarios" });
  }
});

// ── POST /api/compartidas/:id/comments ──────────────────────────────────────
router.post("/:id/comments", protect, async (req, res) => {
  try {
    const compartida = await Compartida.findById(req.params.id);
    if (!compartida)
      return res.status(404).json({ message: "Compartida no encontrada" });

    const { content } = req.body;
    if (!content?.trim())
      return res
        .status(400)
        .json({ message: "El comentario no puede estar vacío" });

    const comment = await CompartidaComment.create({
      compartida: compartida._id,
      author: req.user._id,
      content: content.trim(),
    });
    await comment.populate("author", "username avatar displayName");

    if (compartida.author.toString() !== req.user._id.toString()) {
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
  } catch (err) {
    res.status(500).json({ message: "Error al agregar el comentario" });
  }
});

// ── PUT /api/compartidas/:id/comments/:cid ──────────────────────────────────
router.put("/:id/comments/:cid", protect, async (req, res) => {
  try {
    const comment = await CompartidaComment.findById(req.params.cid);
    if (!comment)
      return res.status(404).json({ message: "Comentario no encontrado" });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Solo el autor puede editar este comentario" });
    }

    const { content } = req.body;
    if (!content?.trim())
      return res
        .status(400)
        .json({ message: "El comentario no puede estar vacío" });

    comment.content = content.trim();
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate("author", "username avatar displayName");

    res.json(comment);
  } catch (err) {
    res.status(500).json({ message: "Error al editar el comentario" });
  }
});

// ── DELETE /api/compartidas/:id/comments/:cid ───────────────────────────────
router.delete("/:id/comments/:cid", protect, async (req, res) => {
  try {
    const comment = await CompartidaComment.findById(req.params.cid);
    if (!comment)
      return res.status(404).json({ message: "Comentario no encontrado" });

    const compartida = await Compartida.findById(req.params.id).select(
      "author",
    );
    const uid = req.user._id.toString();
    const isCommentAuthor = comment.author.toString() === uid;
    const isPostAuthor = compartida?.author.toString() === uid;

    if (!isCommentAuthor && !isPostAuthor && !req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: "No tenés permiso para eliminar este comentario" });
    }

    await comment.deleteOne();
    res.json({ message: "Comentario eliminado" });
  } catch (err) {
    res.status(500).json({ message: "Error al eliminar el comentario" });
  }
});

module.exports = router;
