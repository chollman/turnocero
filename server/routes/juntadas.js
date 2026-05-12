const express = require('express');
const router = express.Router();
const multer = require('../config/multer');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');
const Juntada = require('../models/Juntada');
const JuntadaComment = require('../models/JuntadaComment');
const User = require('../models/User');
const Table = require('../models/Table');
const { protect } = require('../middleware/auth');

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

const populateJuntada = (query) =>
  query
    .populate('author', 'username avatar displayName')
    .populate('linkedTable', 'boardGame date maxPlayers players host status location');

// ── Privacy filter helper ──────────────────────────────────────────────────
const visibilityFilter = (user) => ({
  $or: [
    { privacy: 'public' },
    { privacy: 'friends', author: { $in: user.friends } },
    { author: user._id },
  ],
});

// ── GET /api/juntadas — paginated feed ────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = visibilityFilter(req.user);

    // "Juntada del día" — most-liked post in the last 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [juntadas, total, allRecent] = await Promise.all([
      populateJuntada(Juntada.find(filter))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Juntada.countDocuments(filter),
      Juntada.find({ ...filter, createdAt: { $gte: since24h } })
        .sort({ 'likes.length': -1 })
        .limit(10)
        .select('_id likes'),
    ]);

    // Pick the one with most likes from the last 24h
    const featuredId = allRecent.length
      ? allRecent.reduce((best, j) =>
          j.likes.length > best.likes.length ? j : best
        )._id
      : null;

    const featured = featuredId
      ? await populateJuntada(Juntada.findById(featuredId))
      : null;

    res.json({
      juntadas,
      featured: featured ? featured.toObject() : null,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al cargar el feed' });
  }
});

// ── POST /api/juntadas — create ───────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { title, body, linkedTable, privacy } = req.body;

    if (!title?.trim() && !body?.trim()) {
      return res.status(400).json({ message: 'La juntada necesita al menos un título o texto' });
    }

    // Validate linkedTable belongs to the user (host or player)
    if (linkedTable) {
      const table = await Table.findById(linkedTable);
      if (!table) return res.status(404).json({ message: 'Mesa no encontrada' });
      const uid = req.user._id.toString();
      const isMember =
        table.host.toString() === uid ||
        table.players.some((p) => p.toString() === uid);
      if (!isMember) {
        return res.status(403).json({ message: 'Solo podés vincular mesas en las que participaste' });
      }
    }

    const juntada = await Juntada.create({
      author: req.user._id,
      title: title?.trim() || '',
      body: body?.trim() || '',
      linkedTable: linkedTable || null,
      privacy: privacy || 'public',
    });

    await juntada.populate('author', 'username avatar displayName');
    if (juntada.linkedTable) {
      await juntada.populate('linkedTable', 'boardGame date maxPlayers players host status location');
    }

    res.status(201).json(juntada);
  } catch (err) {
    res.status(500).json({ message: 'Error al crear la juntada' });
  }
});

// ── PUT /api/juntadas/:id — edit (author only) ───────────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const juntada = await Juntada.findById(req.params.id);
    if (!juntada) return res.status(404).json({ message: 'Juntada no encontrada' });
    if (juntada.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Solo el autor puede editar esta juntada' });
    }

    const { title, body, privacy, linkedTable } = req.body;
    if (title !== undefined) juntada.title = title.trim();
    if (body !== undefined) juntada.body = body.trim();
    if (privacy !== undefined) juntada.privacy = privacy;
    if (linkedTable !== undefined) juntada.linkedTable = linkedTable || null;

    await juntada.save();
    await populateJuntada(Promise.resolve(juntada));
    res.json(juntada);
  } catch (err) {
    res.status(500).json({ message: 'Error al editar la juntada' });
  }
});

// ── DELETE /api/juntadas/:id — delete (author only) ──────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const juntada = await Juntada.findById(req.params.id);
    if (!juntada) return res.status(404).json({ message: 'Juntada no encontrada' });
    if (juntada.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Solo el autor puede eliminar esta juntada' });
    }

    // Delete images from Cloudinary
    await Promise.allSettled(
      juntada.images.map((img) => cloudinary.uploader.destroy(img.publicId))
    );

    await JuntadaComment.deleteMany({ juntada: juntada._id });
    await juntada.deleteOne();

    res.json({ message: 'Juntada eliminada' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar la juntada' });
  }
});

// ── POST /api/juntadas/:id/like — toggle like ────────────────────────────
router.post('/:id/like', protect, async (req, res) => {
  try {
    const juntada = await Juntada.findById(req.params.id);
    if (!juntada) return res.status(404).json({ message: 'Juntada no encontrada' });

    // Enforce visibility
    const uid = req.user._id;
    const isVisible =
      juntada.privacy === 'public' ||
      juntada.author.toString() === uid.toString() ||
      (juntada.privacy === 'friends' &&
        req.user.friends.some((f) => f.toString() === juntada.author.toString()));
    if (!isVisible) return res.status(403).json({ message: 'No tenés acceso a esta juntada' });

    const idx = juntada.likes.findIndex((l) => l.toString() === uid.toString());
    if (idx === -1) {
      juntada.likes.push(uid);
    } else {
      juntada.likes.splice(idx, 1);
    }
    await juntada.save();
    res.json({ likes: juntada.likes.length, liked: idx === -1 });
  } catch (err) {
    res.status(500).json({ message: 'Error al procesar el like' });
  }
});

// ── POST /api/juntadas/:id/images — upload (author only, max 3) ──────────
router.post('/:id/images', protect, multer.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No se recibió ninguna imagen' });

  try {
    const juntada = await Juntada.findById(req.params.id);
    if (!juntada) return res.status(404).json({ message: 'Juntada no encontrada' });
    if (juntada.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Solo el autor puede subir imágenes' });
    }
    if (juntada.images.length >= 3) {
      return res.status(400).json({ message: 'Máximo 3 imágenes por juntada' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/juntadas/${req.params.id}`,
      transformation: [{ width: 1200, crop: 'limit' }],
    });

    juntada.images.push({ url: result.secure_url, publicId: result.public_id });
    await juntada.save();

    res.status(201).json(juntada.images);
  } catch (err) {
    res.status(500).json({ message: 'Error al subir la imagen' });
  }
});

// ── DELETE /api/juntadas/:id/images/:imgId ───────────────────────────────
router.delete('/:id/images/:imgId', protect, async (req, res) => {
  try {
    const juntada = await Juntada.findById(req.params.id);
    if (!juntada) return res.status(404).json({ message: 'Juntada no encontrada' });

    const image = juntada.images.id(req.params.imgId);
    if (!image) return res.status(404).json({ message: 'Imagen no encontrada' });

    const isAuthor = juntada.author.toString() === req.user._id.toString();
    if (!isAuthor && !req.user.isAdmin) {
      return res.status(403).json({ message: 'No tenés permiso para eliminar esta imagen' });
    }

    await cloudinary.uploader.destroy(image.publicId);
    image.deleteOne();
    await juntada.save();

    res.json({ message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar la imagen' });
  }
});

// ── GET /api/juntadas/:id/comments ───────────────────────────────────────
router.get('/:id/comments', protect, async (req, res) => {
  try {
    const comments = await JuntadaComment.find({ juntada: req.params.id })
      .populate('author', 'username avatar displayName')
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: 'Error al cargar los comentarios' });
  }
});

// ── POST /api/juntadas/:id/comments ──────────────────────────────────────
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const juntada = await Juntada.findById(req.params.id);
    if (!juntada) return res.status(404).json({ message: 'Juntada no encontrada' });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'El comentario no puede estar vacío' });

    const comment = await JuntadaComment.create({
      juntada: juntada._id,
      author: req.user._id,
      content: content.trim(),
    });
    await comment.populate('author', 'username avatar displayName');

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: 'Error al agregar el comentario' });
  }
});

// ── PUT /api/juntadas/:id/comments/:cid ──────────────────────────────────
router.put('/:id/comments/:cid', protect, async (req, res) => {
  try {
    const comment = await JuntadaComment.findById(req.params.cid);
    if (!comment) return res.status(404).json({ message: 'Comentario no encontrado' });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Solo el autor puede editar este comentario' });
    }

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'El comentario no puede estar vacío' });

    comment.content = content.trim();
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate('author', 'username avatar displayName');

    res.json(comment);
  } catch (err) {
    res.status(500).json({ message: 'Error al editar el comentario' });
  }
});

// ── DELETE /api/juntadas/:id/comments/:cid ───────────────────────────────
router.delete('/:id/comments/:cid', protect, async (req, res) => {
  try {
    const comment = await JuntadaComment.findById(req.params.cid);
    if (!comment) return res.status(404).json({ message: 'Comentario no encontrado' });

    const juntada = await Juntada.findById(req.params.id).select('author');
    const uid = req.user._id.toString();
    const isCommentAuthor = comment.author.toString() === uid;
    const isPostAuthor = juntada?.author.toString() === uid;

    if (!isCommentAuthor && !isPostAuthor && !req.user.isAdmin) {
      return res.status(403).json({ message: 'No tenés permiso para eliminar este comentario' });
    }

    await comment.deleteOne();
    res.json({ message: 'Comentario eliminado' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar el comentario' });
  }
});

module.exports = router;
