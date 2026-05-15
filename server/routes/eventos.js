const express = require('express');
const router = express.Router();
const multerLib = require('multer');
const multer = require('../config/multer');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');
const Evento = require('../models/Evento');
const { protect, requireAdmin, optionalAuth } = require('../middleware/auth');

// Multer instance that also accepts PDF for comprobante uploads
const COMPROBANTE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const comprobanteUpload = multerLib({
  storage: multerLib.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB for PDFs
  fileFilter: (_req, file, cb) => {
    if (COMPROBANTE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (JPG, PNG) o PDF'));
  },
});

// GET /api/eventos — public, paginated
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.user?.isAdmin) {
      if (req.query.status) filter.status = req.query.status;
    } else {
      filter.status = { $in: ['open', 'closed'] };
    }

    const [eventos, total] = await Promise.all([
      Evento.find(filter)
        .select('-registrations')
        .populate('author', 'username displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Evento.countDocuments(filter),
    ]);

    res.json({ eventos, total, page, pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ message: 'Error al obtener eventos' });
  }
});

// POST /api/eventos — admin only
router.post('/', protect, requireAdmin, multer.single('image'), async (req, res) => {
  try {
    let image;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'turnocero/eventos',
        transformation: [{ width: 1200, crop: 'limit' }],
      });
      image = { url: result.secure_url, publicId: result.public_id };
    }

    const evento = await Evento.create({
      title:           req.body.title?.trim(),
      description:     req.body.description?.trim()     || undefined,
      conditions:      req.body.conditions?.trim()      || undefined,
      fee:             parseFloat(req.body.fee)         || 0,
      transferDetails: req.body.transferDetails?.trim() || undefined,
      eventDate:       req.body.eventDate               || undefined,
      location:        req.body.location?.trim()        || undefined,
      maxParticipants: req.body.maxParticipants ? parseInt(req.body.maxParticipants) : undefined,
      status:          req.body.status                  || 'open',
      image,
      author: req.user._id,
    });

    const populated = await evento.populate('author', 'username displayName');
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ message: 'Error al crear el evento' });
  }
});

// GET /api/eventos/:id — public (draft only visible to admins)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id)
      .populate('author', 'username displayName')
      .populate('registrations.user', 'username displayName');

    if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });
    if (evento.status === 'draft' && !req.user?.isAdmin) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const registrationCount = {
      total:     evento.registrations.length,
      pending:   evento.registrations.filter(r => r.status === 'pending').length,
      confirmed: evento.registrations.filter(r => r.status === 'confirmed').length,
    };

    const confirmedRegistrations = evento.registrations
      .filter(r => r.status === 'confirmed')
      .map(r => ({
        _id:  r._id,
        user: r.user ? { username: r.user.username, displayName: r.user.displayName } : null,
      }));

    let userRegistration = null;
    if (req.user) {
      const reg = evento.registrations.find(
        r => r.user?._id?.toString() === req.user._id.toString()
      );
      if (reg) {
        userRegistration = {
          _id:         reg._id,
          status:      reg.status,
          submittedAt: reg.submittedAt,
          comprobante: reg.comprobante
            ? { url: reg.comprobante.url, resourceType: reg.comprobante.resourceType }
            : null,
        };
      }
    }

    const eventoObj = evento.toObject();
    delete eventoObj.registrations;
    res.json({ ...eventoObj, registrationCount, userRegistration, confirmedRegistrations });
  } catch {
    res.status(500).json({ message: 'Error al obtener el evento' });
  }
});

// PUT /api/eventos/:id — admin only
router.put('/:id', protect, requireAdmin, multer.single('image'), async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });

    if (req.body.title?.trim())           evento.title           = req.body.title.trim();
    evento.description     = req.body.description?.trim()      || undefined;
    evento.conditions      = req.body.conditions?.trim()       || undefined;
    if (req.body.fee !== undefined)        evento.fee             = parseFloat(req.body.fee) || 0;
    evento.transferDetails = req.body.transferDetails?.trim()  || undefined;
    evento.eventDate       = req.body.eventDate                || undefined;
    evento.location        = req.body.location?.trim()         || undefined;
    evento.maxParticipants = req.body.maxParticipants ? parseInt(req.body.maxParticipants) : undefined;
    if (req.body.status)                   evento.status          = req.body.status;

    if (req.file) {
      if (evento.image?.publicId) await cloudinary.uploader.destroy(evento.image.publicId);
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'turnocero/eventos',
        transformation: [{ width: 1200, crop: 'limit' }],
      });
      evento.image = { url: result.secure_url, publicId: result.public_id };
    }

    await evento.save();
    const populated = await evento.populate('author', 'username displayName');

    const registrationCount = {
      total:     evento.registrations.length,
      pending:   evento.registrations.filter(r => r.status === 'pending').length,
      confirmed: evento.registrations.filter(r => r.status === 'confirmed').length,
    };

    const eventoObj = populated.toObject();
    delete eventoObj.registrations;
    res.json({ ...eventoObj, registrationCount, userRegistration: null });
  } catch {
    res.status(500).json({ message: 'Error al editar el evento' });
  }
});

// DELETE /api/eventos/:id — admin only
router.delete('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });

    if (evento.image?.publicId) await cloudinary.uploader.destroy(evento.image.publicId);
    await evento.deleteOne();

    res.json({ message: 'Evento eliminado' });
  } catch {
    res.status(500).json({ message: 'Error al eliminar el evento' });
  }
});

// POST /api/eventos/:id/inscribirse — auth required, multipart (comprobante opcional si fee=0)
router.post('/:id/inscribirse', protect, comprobanteUpload.single('comprobante'), async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });
    if (evento.status !== 'open') return res.status(400).json({ message: 'Las inscripciones están cerradas' });

    const existing = evento.registrations.find(
      r => r.user.toString() === req.user._id.toString()
    );
    if (existing) return res.status(400).json({ message: 'Ya estás inscripto en este evento' });

    if (evento.maxParticipants) {
      const confirmed = evento.registrations.filter(r => r.status === 'confirmed').length;
      if (confirmed >= evento.maxParticipants) {
        return res.status(400).json({ message: 'El evento ya alcanzó el cupo máximo' });
      }
    }

    // Comprobante required for paid events
    if (evento.fee > 0 && !req.file) {
      return res.status(400).json({ message: 'Debés adjuntar el comprobante de transferencia' });
    }

    let comprobante;
    if (req.file) {
      const isPdf        = req.file.mimetype === 'application/pdf';
      const resourceType = isPdf ? 'raw' : 'image';
      const result = await uploadToCloudinary(req.file.buffer, {
        folder:        `turnocero/eventos/${req.params.id}/comprobantes`,
        resource_type: resourceType,
      });
      comprobante = {
        url:          result.secure_url,
        publicId:     result.public_id,
        resourceType,
        uploadedAt:   new Date(),
      };
    }

    evento.registrations.push({ user: req.user._id, status: 'pending', comprobante });
    await evento.save();

    const reg = evento.registrations[evento.registrations.length - 1];
    res.status(201).json({
      _id:         reg._id,
      status:      reg.status,
      submittedAt: reg.submittedAt,
      comprobante: reg.comprobante ? { url: reg.comprobante.url, resourceType: reg.comprobante.resourceType } : null,
    });
  } catch {
    res.status(500).json({ message: 'Error al procesar la inscripción' });
  }
});

// DELETE /api/eventos/:id/inscribirse — cancel own pending registration
router.delete('/:id/inscribirse', protect, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });

    const idx = evento.registrations.findIndex(
      r => r.user.toString() === req.user._id.toString()
    );
    if (idx === -1) return res.status(404).json({ message: 'No estás inscripto en este evento' });
    if (evento.registrations[idx].status !== 'pending') {
      return res.status(400).json({ message: 'Solo podés cancelar inscripciones pendientes' });
    }

    const reg = evento.registrations[idx];
    if (reg.comprobante?.publicId) {
      await cloudinary.uploader.destroy(reg.comprobante.publicId, {
        resource_type: reg.comprobante.resourceType || 'image',
      }).catch(() => {});
    }

    evento.registrations.splice(idx, 1);
    await evento.save();

    res.json({ message: 'Inscripción cancelada' });
  } catch {
    res.status(500).json({ message: 'Error al cancelar la inscripción' });
  }
});

// GET /api/eventos/:id/inscripciones — admin only
router.get('/:id/inscripciones', protect, requireAdmin, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id)
      .populate('registrations.user', 'username displayName email');
    if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });

    let registrations = evento.registrations.toObject ? evento.registrations.toObject() : [...evento.registrations];
    const statusFilter = req.query.status;
    if (statusFilter && ['pending', 'confirmed', 'rejected'].includes(statusFilter)) {
      registrations = registrations.filter(r => r.status === statusFilter);
    }

    res.json({
      evento:        { _id: evento._id, title: evento.title, status: evento.status },
      registrations,
      counts: {
        total:     evento.registrations.length,
        pending:   evento.registrations.filter(r => r.status === 'pending').length,
        confirmed: evento.registrations.filter(r => r.status === 'confirmed').length,
        rejected:  evento.registrations.filter(r => r.status === 'rejected').length,
      },
    });
  } catch {
    res.status(500).json({ message: 'Error al obtener inscripciones' });
  }
});

// PATCH /api/eventos/:id/inscripciones/:userId/confirmar — admin only
router.patch('/:id/inscripciones/:userId/confirmar', protect, requireAdmin, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });

    const reg = evento.registrations.find(r => r.user.toString() === req.params.userId);
    if (!reg) return res.status(404).json({ message: 'Inscripción no encontrada' });

    reg.status     = 'confirmed';
    reg.reviewedAt = new Date();
    reg.reviewedBy = req.user._id;
    if (req.body.adminNotes?.trim()) reg.adminNotes = req.body.adminNotes.trim();

    await evento.save();
    res.json({ message: 'Inscripción confirmada', status: reg.status });
  } catch {
    res.status(500).json({ message: 'Error al confirmar la inscripción' });
  }
});

// PATCH /api/eventos/:id/inscripciones/:userId/rechazar — admin only
router.patch('/:id/inscripciones/:userId/rechazar', protect, requireAdmin, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento) return res.status(404).json({ message: 'Evento no encontrado' });

    const reg = evento.registrations.find(r => r.user.toString() === req.params.userId);
    if (!reg) return res.status(404).json({ message: 'Inscripción no encontrada' });

    reg.status     = 'rejected';
    reg.reviewedAt = new Date();
    reg.reviewedBy = req.user._id;
    if (req.body.adminNotes?.trim()) reg.adminNotes = req.body.adminNotes.trim();

    await evento.save();
    res.json({ message: 'Inscripción rechazada', status: reg.status });
  } catch {
    res.status(500).json({ message: 'Error al rechazar la inscripción' });
  }
});

module.exports = router;
