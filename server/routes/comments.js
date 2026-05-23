const express = require("express");
const router = express.Router({ mergeParams: true });
const { body, param, validationResult } = require("express-validator");
const Comment = require("../models/Comment");
const Table = require("../models/Table");
const { protect } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { emitNotificationReq } = require("../utils/emitNotification");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");

router.use(requireSection("mesas"));

// `:id` viene del parent mount (`/api/tables/:id/comments`); `:commentId` es propio.
router.use(validateObjectId("id"));
router.param("commentId", validateObjectId("commentId"));

const checkValidation = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, errors.array()[0].msg);
};

// GET /api/tables/:id/comments — any logged-in user
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    const comments = await Comment.find({ table: req.params.id })
      .populate("author", "username displayName avatar")
      .sort({ createdAt: 1 });

    res.json(comments);
  }),
);

// POST /api/tables/:id/comments — any logged-in user
router.post(
  "/",
  protect,
  [
    body("content")
      .trim()
      .notEmpty()
      .withMessage("El comentario no puede estar vacío")
      .isLength({ max: 500 })
      .withMessage("El comentario no puede superar los 500 caracteres"),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");
    if (table.status === "cancelled") {
      throw httpError(
        400,
        "No se pueden agregar comentarios a una mesa cancelada",
      );
    }

    const comment = await Comment.create({
      table: req.params.id,
      author: req.user._id,
      content: req.body.content,
    });

    await comment.populate("author", "username displayName avatar");

    // Notify members and followers (except the author)
    const uid = req.user._id.toString();
    const recipients = new Set([
      table.host.toString(),
      ...table.players.map((p) => p.toString()),
      ...table.followers.map((f) => f.toString()),
    ]);
    recipients.delete(uid);
    const commentPreview = req.body.content.slice(0, 60);
    await Promise.all(
      [...recipients].map((userId) =>
        emitNotificationReq(
          req,
          userId,
          "comment",
          {
            tableId: table._id.toString(),
            tableName: table.boardGame,
            lastCommenterUsername: req.user.username,
            lastCommentPreview: commentPreview,
          },
          "table:comment",
          { commenterUsername: req.user.username, commentPreview },
        ).catch(() => {}),
      ),
    );

    res.status(201).json(comment);
  }),
);

// PUT /api/tables/:id/comments/:commentId — author only
router.put(
  "/:commentId",
  protect,
  [
    param("commentId").isMongoId().withMessage("Invalid comment ID"),
    body("content")
      .trim()
      .notEmpty()
      .withMessage("El comentario no puede estar vacío")
      .isLength({ max: 500 })
      .withMessage("El comentario no puede superar los 500 caracteres"),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) throw httpError(404, "Comment not found");

    if (!isSameId(comment.author, req.user._id)) {
      throw httpError(403, "Solo el autor puede editar este comentario");
    }

    comment.content = req.body.content;
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate("author", "username displayName avatar");

    res.json(comment);
  }),
);

// DELETE /api/tables/:id/comments/:commentId — author, host, or admin
router.delete(
  "/:commentId",
  protect,
  [param("commentId").isMongoId().withMessage("Invalid comment ID")],
  asyncHandler(async (req, res) => {
    checkValidation(req);

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) throw httpError(404, "Comment not found");

    const table = await Table.findById(req.params.id);
    const isAuthor = isSameId(comment.author, req.user._id);
    const isHost = table && isSameId(table.host, req.user._id);

    if (!isAuthor && !isHost && !req.user.isAdmin) {
      throw httpError(403, "No tenés permiso para eliminar este comentario");
    }

    await comment.deleteOne();
    res.json({ message: "Comment deleted" });
  }),
);

module.exports = router;
