const express = require('express');
const router = express.Router();
const multer = require('../config/multer');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');
const Noticia = require('../models/Noticia');
const { protect, requireAdmin, optionalAuth } = require('../middleware/auth');

// GET /api/noticias — public, newest first, paginated
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
    const skip  = (page - 1) * limit;

    const [noticias, total] = await Promise.all([
      Noticia.find()
        .populate('author', 'username displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Noticia.countDocuments(),
    ]);

    res.json({ noticias, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener noticias' });
  }
});

// POST /api/noticias — admin only, multipart/form-data with image
router.post('/', protect, requireAdmin, multer.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'La imagen es obligatoria' });

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'turnocero/noticias',
      transformation: [{ width: 1200, crop: 'limit' }],
    });

    const noticia = await Noticia.create({
      title:  req.body.title?.trim() || undefined,
      body:   req.body.body?.trim()  || undefined,
      link:   req.body.link?.trim()  || undefined,
      image:  { url: result.secure_url, publicId: result.public_id },
      author: req.user._id,
    });

    const populated = await noticia.populate('author', 'username displayName');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error al crear la noticia' });
  }
});

// PUT /api/noticias/:id — admin only, image replacement is optional
router.put('/:id', protect, requireAdmin, multer.single('image'), async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) return res.status(404).json({ message: 'Noticia no encontrada' });

    noticia.title = req.body.title?.trim() || undefined;
    noticia.body  = req.body.body?.trim()  || undefined;
    noticia.link  = req.body.link?.trim()  || undefined;

    if (req.file) {
      await cloudinary.uploader.destroy(noticia.image.publicId);
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'turnocero/noticias',
        transformation: [{ width: 1200, crop: 'limit' }],
      });
      noticia.image = { url: result.secure_url, publicId: result.public_id };
    }

    await noticia.save();
    const populated = await noticia.populate('author', 'username displayName');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error al editar la noticia' });
  }
});

// DELETE /api/noticias/:id — admin only
router.delete('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) return res.status(404).json({ message: 'Noticia no encontrada' });

    await cloudinary.uploader.destroy(noticia.image.publicId);
    await noticia.deleteOne();

    res.json({ message: 'Noticia eliminada' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar la noticia' });
  }
});

module.exports = router;
