const express = require("express");
const router = express.Router();
const multer = require("../config/multer");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");
const Noticia = require("../models/Noticia");
const { protect, requireAdmin, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { parsePagination } = require("../utils/paginate");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

router.use(requireSection("noticias"));

router.param("id", validateObjectId("id"));

// GET /api/noticias — public, newest first, paginated
router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 20,
    });

    const [noticias, total] = await Promise.all([
      Noticia.find()
        .populate("author", "username displayName avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Noticia.countDocuments(),
    ]);

    res.json({ noticias, total, page, pages: Math.ceil(total / limit) });
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

    const noticia = await Noticia.create({
      title: req.body.title?.trim() || undefined,
      body: req.body.body?.trim() || undefined,
      link: req.body.link?.trim() || undefined,
      linkLabel: req.body.linkLabel?.trim() || undefined,
      image,
      author: req.user._id,
    });

    const populated = await noticia.populate(
      "author",
      "username displayName avatar",
    );

    const io = req.app.get("io");
    if (io) {
      io.emit("noticia:published", {
        noticiaId: noticia._id.toString(),
        title: noticia.title || "",
        timestamp: new Date(),
      });
    }

    res.status(201).json(populated);
  }),
);

// GET /api/noticias/:id — public
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const noticia = await Noticia.findById(req.params.id).populate(
      "author",
      "username displayName avatar",
    );
    if (!noticia) throw httpError(404, "Noticia no encontrada");
    res.json(noticia);
  }),
);

// PUT /api/noticias/:id — admin only, image replacement is optional
router.put(
  "/:id",
  protect,
  requireAdmin,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) throw httpError(404, "Noticia no encontrada");

    noticia.title = req.body.title?.trim() || undefined;
    noticia.body = req.body.body?.trim() || undefined;
    noticia.link = req.body.link?.trim() || undefined;
    noticia.linkLabel = req.body.linkLabel?.trim() || undefined;

    if (req.file) {
      await cloudinary.uploader.destroy(noticia.image.publicId);
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "turnocero/noticias",
        transformation: [{ width: 1200, crop: "limit" }],
      });
      noticia.image = { url: result.secure_url, publicId: result.public_id };
    }

    await noticia.save();
    const populated = await noticia.populate(
      "author",
      "username displayName avatar",
    );
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
