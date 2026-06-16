const express = require("express");
const router = express.Router();
const multer = require("../config/multer");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");
const Noticia = require("../models/Noticia");
const { protect, requireAdmin, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const {
  resolveCommunities,
  communityFilter,
} = require("../middleware/resolveCommunities");
const communityService = require("../services/communityService");
const validateObjectId = require("../middleware/validateObjectId");
const { parsePagination } = require("../utils/paginate");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { escapeRegex } = require("../utils/regex");
const {
  sanitizeNoticiaHtml,
  stripHtml,
  firstHtmlImage,
} = require("../utils/sanitizeHtml");

router.use(requireSection("noticias"));

router.param("id", validateObjectId("id"));

const POPULATE_AUTHOR = "username displayName avatar";

function isAdmin(req) {
  return !!req.user?.isAdmin;
}

// ── Parsers de campos del form (multipart → flat strings) ──────────────────
function parseBool(v) {
  return v === true || v === "true" || v === "1";
}

function parseTags(raw) {
  if (raw == null) return undefined;
  let arr = raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : raw.split(",");
    } catch {
      arr = raw.split(",");
    }
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const tag = String(t).trim().toLowerCase().slice(0, 32);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
    if (out.length >= 6) break;
  }
  return out;
}

function parseQuote(raw) {
  if (raw == null) return undefined;
  let q = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return null; // limpiar la cita
    try {
      q = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!q || typeof q !== "object") return null;
  const text = (q.text || "").trim();
  if (!text) return null;
  return {
    text: text.slice(0, 400),
    author: (q.author || "").trim().slice(0, 80) || undefined,
    context: (q.context || "").trim().slice(0, 80) || undefined,
  };
}

function validCategory(c) {
  return Noticia.CATEGORIES.includes(c) ? c : undefined;
}

// Aplica al doc los campos editoriales presentes en el body (partial update).
function applyEditorialFields(noticia, body, { isCreate } = {}) {
  if ("title" in body) noticia.title = body.title?.trim() || undefined;
  if ("body" in body)
    noticia.body = sanitizeNoticiaHtml(body.body) || undefined;
  if ("dek" in body) noticia.dek = body.dek?.trim().slice(0, 320) || undefined;
  if ("kicker" in body)
    noticia.kicker = body.kicker?.trim().slice(0, 60) || undefined;
  if ("category" in body) {
    const cat = validCategory(body.category);
    if (cat) noticia.category = cat;
  } else if (isCreate) {
    noticia.category = "general";
  }
  if ("tags" in body) {
    const tags = parseTags(body.tags);
    if (tags !== undefined) noticia.tags = tags;
  }
  if ("link" in body) noticia.link = body.link?.trim() || undefined;
  if ("linkLabel" in body)
    noticia.linkLabel = body.linkLabel?.trim() || undefined;
  if ("quote" in body) {
    const q = parseQuote(body.quote);
    if (q !== undefined) noticia.quote = q || undefined;
  }
  if ("featured" in body) noticia.featured = parseBool(body.featured);
  if ("isBrief" in body) noticia.isBrief = parseBool(body.isBrief);
}

// GET /api/noticias — newest first, paginated. Soporta ?category & ?search.
// Drafts ocultos a no-admins.
router.get(
  "/",
  optionalAuth,
  resolveCommunities,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 20,
    });

    const filter = { ...communityFilter(req) };
    if (!isAdmin(req)) filter.status = { $ne: "draft" };

    if (req.query.category && req.query.category !== "all") {
      const cat = validCategory(String(req.query.category));
      if (cat) filter.category = cat;
    }

    if (req.query.search && String(req.query.search).trim()) {
      const rx = new RegExp(escapeRegex(String(req.query.search).trim()), "i");
      filter.$or = [{ title: rx }, { dek: rx }, { tags: rx }];
    }

    const [noticias, total] = await Promise.all([
      Noticia.find(filter)
        .populate("author", POPULATE_AUTHOR)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Noticia.countDocuments(filter),
    ]);

    res.json({ noticias, total, page, pages: Math.ceil(total / limit) });
  }),
);

// ── POST /api/noticias/inline-image — imagen para el editor del cuerpo ──────
// La imagen se sube ANTES de que la noticia exista (durante la composición).
router.post(
  "/inline-image",
  protect,
  requireAdmin,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, "No se recibió ninguna imagen");
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/noticias/inline/${req.user._id}`,
      transformation: [{ width: 1200, crop: "limit" }],
    });
    res
      .status(201)
      .json({ url: result.secure_url, publicId: result.public_id });
  }),
);

// POST /api/noticias — admin only, multipart/form-data with optional image
router.post(
  "/",
  protect,
  requireAdmin,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    let image;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "turnocero/noticias",
        transformation: [{ width: 1200, crop: "limit" }],
      });
      image = { url: result.secure_url, publicId: result.public_id };
    }
    if (image && "imageCaption" in req.body) {
      image.caption = req.body.imageCaption?.trim().slice(0, 200) || undefined;
    }

    const status = req.body.status === "draft" ? "draft" : "published";

    const noticia = new Noticia({
      image,
      status,
      publishedAt: status === "published" ? new Date() : undefined,
      author: req.user._id,
      community: await communityService.resolveCreateCommunity(
        req.user,
        req.body.community,
        req.tenant,
      ),
    });
    applyEditorialFields(noticia, req.body, { isCreate: true });
    await noticia.save();

    const populated = await noticia.populate("author", POPULATE_AUTHOR);

    // Toast en tiempo real SOLO a miembros de la comunidad (no broadcast) y
    // SOLO si se publica (los borradores no notifican). El autor se excluye.
    if (status === "published") {
      const io = req.app.get("io");
      if (io) {
        const recipientIds = await communityService.memberIds(
          noticia.community,
          { exclude: req.user._id },
        );
        const rooms = recipientIds.map((id) => `user:${id}`);
        if (rooms.length) {
          io.to(rooms).emit("noticia:published", {
            noticiaId: noticia._id.toString(),
            title: noticia.title || "",
            community: noticia.community ? noticia.community.toString() : null,
            timestamp: new Date(),
          });
        }
      }
    }

    res.status(201).json(populated);
  }),
);

// ── GET /api/noticias/:id/og — public OG data for crawlers (no auth) ───────
// Responde 404 con body vacío (no { message }) — OG es defensivo, no info-leak.
router.get(
  "/:id/og",
  asyncHandler(async (req, res) => {
    try {
      const noticia = await Noticia.findById(req.params.id)
        .populate("author", "username displayName")
        .select("title body dek image author category status");
      if (!noticia || noticia.status === "draft") {
        return res.status(404).json({});
      }
      const desc = (noticia.dek || stripHtml(noticia.body) || "").slice(0, 200);
      res.json({
        title: noticia.title || null,
        body: desc || null,
        // Foto de portada; si la nota no tiene, la primera imagen del cuerpo.
        image: noticia.image?.url || firstHtmlImage(noticia.body) || null,
        category: noticia.category || null,
        author: noticia.author
          ? noticia.author.displayName || noticia.author.username
          : null,
      });
    } catch {
      res.status(500).json({});
    }
  }),
);

// GET /api/noticias/:id — public (drafts hidden from non-admins)
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const noticia = await Noticia.findById(req.params.id).populate(
      "author",
      POPULATE_AUTHOR,
    );
    if (!noticia) throw httpError(404, "Noticia no encontrada");
    if (noticia.status === "draft" && !isAdmin(req))
      throw httpError(404, "Noticia no encontrada");
    res.json(noticia);
  }),
);

// PUT /api/noticias/:id — admin only, partial update; image replacement optional
router.put(
  "/:id",
  protect,
  requireAdmin,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) throw httpError(404, "Noticia no encontrada");

    const wasPublished = noticia.status === "published";

    applyEditorialFields(noticia, req.body, { isCreate: false });

    if (req.file) {
      if (noticia.image?.publicId)
        await cloudinary.uploader.destroy(noticia.image.publicId);
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "turnocero/noticias",
        transformation: [{ width: 1200, crop: "limit" }],
      });
      noticia.image = { url: result.secure_url, publicId: result.public_id };
    } else if (parseBool(req.body.removeImage)) {
      if (noticia.image?.publicId)
        await cloudinary.uploader.destroy(noticia.image.publicId);
      noticia.image = undefined;
    }
    if (noticia.image && "imageCaption" in req.body) {
      noticia.image.caption =
        req.body.imageCaption?.trim().slice(0, 200) || undefined;
    }

    if ("status" in req.body) {
      noticia.status = req.body.status === "draft" ? "draft" : "published";
    }
    // Setear publishedAt la primera vez que pasa a published.
    if (noticia.status === "published" && !noticia.publishedAt) {
      noticia.publishedAt = new Date();
    }

    await noticia.save();
    const populated = await noticia.populate("author", POPULATE_AUTHOR);

    // Si pasó de draft → published recién ahora, notificar a la comunidad.
    if (!wasPublished && noticia.status === "published") {
      const io = req.app.get("io");
      if (io) {
        const recipientIds = await communityService.memberIds(
          noticia.community,
          { exclude: req.user._id },
        );
        const rooms = recipientIds.map((id) => `user:${id}`);
        if (rooms.length) {
          io.to(rooms).emit("noticia:published", {
            noticiaId: noticia._id.toString(),
            title: noticia.title || "",
            community: noticia.community ? noticia.community.toString() : null,
            timestamp: new Date(),
          });
        }
      }
    }

    res.json(populated);
  }),
);

// DELETE /api/noticias/:id — admin only
router.delete(
  "/:id",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) throw httpError(404, "Noticia no encontrada");

    if (noticia.image?.publicId)
      await cloudinary.uploader.destroy(noticia.image.publicId);
    await noticia.deleteOne();

    res.json({ message: "Noticia eliminada" });
  }),
);

module.exports = router;
