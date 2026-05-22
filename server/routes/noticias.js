const express = require('express');
const router = express.Router();
const multer = require('../config/multer');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');
const Noticia = require('../models/Noticia');
const { protect, requireAdmin, optionalAuth } = require('../middleware/auth');
const { requireSection } = require('../middleware/sectionGate');
const validateObjectId = require('../middleware/validateObjectId');

router.use(requireSection('noticias'));

router.param('id', validateObjectId('id'));

// GET /api/noticias — public, newest first, paginated
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
    const skip  = (page - 1) * limit;

    const [noticias, total] = await Promise.all([
      Noticia.find()
        .populate('author', 'username displayName avatar')
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

// POST /api/noticias — admin only, multipart/form-data with optional image
router.post('/', protect, requireAdmin, multer.single('image'), async (req, res) => {
  try {
    let image;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'turnocero/noticias',
        transformation: [{ width: 1200, crop: 'limit' }],
      });
      image = { url: result.secure_url, publicId: result.public_id };
    }

    const noticia = await Noticia.create({
      title:  req.body.title?.trim() || undefined,
      body:   req.body.body?.trim()  || undefined,
      link:      req.body.link?.trim()      || undefined,
      linkLabel: req.body.linkLabel?.trim() || undefined,
      image,
      author: req.user._id,
    });

    const populated = await noticia.populate('author', 'username displayName avatar');

    const io = req.app.get('io');
    if (io) {
      io.emit('noticia:published', {
        noticiaId: noticia._id.toString(),
        title: noticia.title || '',
        timestamp: new Date(),
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Error al crear la noticia' });
  }
});

// GET /api/noticias/:id — public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id).populate('author', 'username displayName avatar');
    if (!noticia) return res.status(404).json({ message: 'Noticia no encontrada' });
    res.json(noticia);
  } catch {
    res.status(500).json({ message: 'Error al obtener la noticia' });
  }
});

// PUT /api/noticias/:id — admin only, image replacement is optional
router.put('/:id', protect, requireAdmin, multer.single('image'), async (req, res) => {
  try {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia) return res.status(404).json({ message: 'Noticia no encontrada' });

    noticia.title = req.body.title?.trim() || undefined;
    noticia.body  = req.body.body?.trim()  || undefined;
    noticia.link      = req.body.link?.trim()      || undefined;
    noticia.linkLabel = req.body.linkLabel?.trim() || undefined;

    if (req.file) {
      await cloudinary.uploader.destroy(noticia.image.publicId);
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'turnocero/noticias',
        transformation: [{ width: 1200, crop: 'limit' }],
      });
      noticia.image = { url: result.secure_url, publicId: result.public_id };
    }

    await noticia.save();
    const populated = await noticia.populate('author', 'username displayName avatar');
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

    if (noticia.image?.publicId) await cloudinary.uploader.destroy(noticia.image.publicId);
    await noticia.deleteOne();

    res.json({ message: 'Noticia eliminada' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar la noticia' });
  }
});

module.exports = router;
