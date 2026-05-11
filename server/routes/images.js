const express = require('express');
const router = express.Router({ mergeParams: true });
const { param, validationResult } = require('express-validator');
const multer = require('../config/multer');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');
const Table = require('../models/Table');
const { protect } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

const isMember = (table, userId) => {
  const uid = userId.toString();
  return (
    table.host.toString() === uid ||
    table.players.some((p) => p.toString() === uid)
  );
};

// POST /api/tables/:id/images — members only; max 10 images per table
router.post(
  '/',
  protect,
  multer.single('image'),
  async (req, res) => {
    // multer errors (file size, type)
    if (!req.file) {
      return res.status(400).json({ message: 'No se recibió ninguna imagen' });
    }

    try {
      const table = await Table.findById(req.params.id);
      if (!table) return res.status(404).json({ message: 'Table not found' });
      if (table.status === 'cancelled') {
        return res.status(400).json({ message: 'No se pueden subir imágenes a una mesa cancelada' });
      }
      if (!isMember(table, req.user._id)) {
        return res.status(403).json({ message: 'Solo los miembros de la mesa pueden subir imágenes' });
      }
      if (table.images.length >= 10) {
        return res.status(400).json({ message: 'La mesa ya tiene el máximo de 10 imágenes' });
      }

      const result = await uploadToCloudinary(req.file.buffer, {
        folder: `turnocero/tables/${req.params.id}`,
        transformation: [{ width: 1200, crop: 'limit' }],
      });

      table.images.push({
        url:      result.secure_url,
        publicId: result.public_id,
        uploader: req.user._id,
      });

      await table.save();
      await table.populate('images.uploader', 'username');

      res.status(201).json(table.images);
    } catch (err) {
      res.status(500).json({ message: 'Error al subir la imagen' });
    }
  }
);

// DELETE /api/tables/:id/images/:imageId — uploader or host
router.delete('/:imageId', protect, [
  param('imageId').isMongoId().withMessage('Invalid image ID'),
], validate, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    const image = table.images.id(req.params.imageId);
    if (!image) return res.status(404).json({ message: 'Imagen no encontrada' });

    const uid = req.user._id.toString();
    const isUploader = image.uploader.toString() === uid;
    const isHost = table.host.toString() === uid;

    if (!isUploader && !isHost && !req.user.isAdmin) {
      return res.status(403).json({ message: 'No tenés permiso para eliminar esta imagen' });
    }

    await cloudinary.uploader.destroy(image.publicId);
    image.deleteOne();
    await table.save();

    res.json({ message: 'Imagen eliminada' });
  } catch {
    res.status(500).json({ message: 'Error al eliminar la imagen' });
  }
});

module.exports = router;
