const express = require("express");
const router = express.Router({ mergeParams: true });
const { param, validationResult } = require("express-validator");
const multer = require("../config/multer");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");
const Table = require("../models/Table");
const { protect } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { emitNotificationReq } = require("../utils/emitNotification");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");

router.use(requireSection("mesas"));

// `:id` viene del parent mount (`/api/tables/:id/images`); `:imageId` es propio.
router.use(validateObjectId("id"));
router.param("imageId", validateObjectId("imageId"));

const isMember = (table, userId) => {
  return (
    isSameId(table.host, userId) ||
    table.players.some((p) => isSameId(p, userId))
  );
};

// POST /api/tables/:id/images — members only; max 10 images per table
router.post(
  "/",
  protect,
  multer.single("image"),
  asyncHandler(async (req, res) => {
    // multer errors (file size, type)
    if (!req.file) {
      throw httpError(400, "No se recibió ninguna imagen");
    }

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");
    if (table.status === "cancelled") {
      throw httpError(400, "No se pueden subir imágenes a una mesa cancelada");
    }
    if (!isMember(table, req.user._id)) {
      throw httpError(
        403,
        "Solo los miembros de la mesa pueden subir imágenes",
      );
    }
    if (table.images.length >= 10) {
      throw httpError(400, "La mesa ya tiene el máximo de 10 imágenes");
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/tables/${req.params.id}`,
      transformation: [{ width: 1200, crop: "limit" }],
    });

    table.images.push({
      url: result.secure_url,
      publicId: result.public_id,
      uploader: req.user._id,
    });

    await table.save();
    await table.populate("images.uploader", "username displayName avatar");

    // Notify members and followers (except the uploader).
    //
    // Players + host siempre. Followers solo en mesas públicas — los legacy de
    // privadas/friends quedan "inertes" (no reciben más eventos de stream).
    // Ver feedback de privacy "Amigos" 2026-05.
    const uid = req.user._id.toString();
    const followerIds =
      table.privacy === "public"
        ? table.followers.map((f) => f.toString())
        : [];
    const recipients = new Set([
      table.host.toString(),
      ...table.players.map((p) => p.toString()),
      ...followerIds,
    ]);
    recipients.delete(uid);
    await Promise.all(
      [...recipients].map((userId) =>
        emitNotificationReq(
          req,
          userId,
          "image",
          {
            tableId: table._id.toString(),
            tableName: table.boardGame,
            lastUploaderUsername: req.user.username,
            actor: {
              userId: req.user._id.toString(),
              username: req.user.username,
            },
          },
          "table:image",
          { uploaderUsername: req.user.username },
        ).catch(() => {}),
      ),
    );

    res.status(201).json(table.images);
  }),
);

// DELETE /api/tables/:id/images/:imageId — uploader or host
router.delete(
  "/:imageId",
  protect,
  [param("imageId").isMongoId().withMessage("Invalid image ID")],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw httpError(400, errors.array()[0].msg);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    const image = table.images.id(req.params.imageId);
    if (!image) throw httpError(404, "Imagen no encontrada");

    const isUploader = isSameId(image.uploader, req.user._id);
    const isHost = isSameId(table.host, req.user._id);

    if (!isUploader && !isHost && !req.user.isAdmin) {
      throw httpError(403, "No tenés permiso para eliminar esta imagen");
    }

    await cloudinary.uploader.destroy(image.publicId);
    image.deleteOne();
    await table.save();

    res.json({ message: "Imagen eliminada" });
  }),
);

module.exports = router;
