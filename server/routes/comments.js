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
const serializeComment = require("../utils/serializeComment");
const { assertCanComment } = require("../utils/tablePrivacy");

router.use(requireSection("mesas"));

// `:id` viene del parent mount (`/api/tables/:id/comments`); `:commentId` es propio.
router.use(validateObjectId("id"));
router.param("commentId", validateObjectId("commentId"));

const checkValidation = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, errors.array()[0].msg);
};

// GET /api/tables/:id/comments — any logged-in user
// Devuelve los comentarios de NIVEL SUPERIOR (más viejos primero, como
// siempre), cada uno con sus `replies` (respuestas) anidadas de 1 nivel
// (estilo Facebook), también ordenadas de más viejas a más nuevas.
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    const base = { table: req.params.id };
    const all = await Comment.find(base)
      .populate("author", "username displayName avatar")
      .sort({ createdAt: 1, _id: 1 });

    const uid = req.user?._id;
    const byParent = new Map(); // parentId → [replies]
    const topLevel = [];
    for (const c of all) {
      if (c.parent) {
        const k = c.parent.toString();
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(serializeComment(c, uid));
      } else {
        topLevel.push(c);
      }
    }

    const comments = topLevel.map((c) => ({
      ...serializeComment(c, uid),
      replies: byParent.get(c._id.toString()) || [],
    }));

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
    // Los comentarios son públicos en la página de la mesa. Solo tienen
    // sentido en mesas públicas; en privadas/amigos se bloquea POST pero
    // GET sigue funcionando (preserva historial si la mesa cambió de
    // privacidad después de comentarios existentes).
    assertCanComment(table);

    // Respuesta: validar que el padre exista y sea de esta mesa. Aplanar a
    // 1 nivel — si el padre ya es una respuesta, colgamos del raíz.
    let parentId = null;
    if (req.body.parent) {
      const parentComment = await Comment.findById(req.body.parent).select(
        "table parent",
      );
      if (!parentComment || !isSameId(parentComment.table, table._id)) {
        throw httpError(400, "Comentario padre inválido");
      }
      parentId = parentComment.parent || parentComment._id;
    }

    const comment = await Comment.create({
      table: req.params.id,
      author: req.user._id,
      content: req.body.content,
      parent: parentId,
    });

    await comment.populate("author", "username displayName avatar");

    // Destinatarios: host + jugadores + seguidores de la mesa Y quienes ya
    // comentaron el hilo (para que una respuesta llegue al autor del
    // comentario respondido) — igual que en compartidas. Se dedupea por id y
    // se excluye al autor del comentario actual.
    const uid = req.user._id.toString();
    const commenterIds = await Comment.distinct("author", {
      table: table._id,
    });
    const recipients = new Set([
      table.host.toString(),
      ...table.players.map((p) => p.toString()),
      ...table.followers.map((f) => f.toString()),
      ...commenterIds.map((c) => c.toString()),
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
            actor: {
              userId: req.user._id.toString(),
              username: req.user.username,
            },
          },
          "table:comment",
          { commenterUsername: req.user.username, commentPreview },
        ).catch(() => {}),
      ),
    );

    res.status(201).json(serializeComment(comment, req.user._id));
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

    res.json(serializeComment(comment, req.user._id));
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
    // Si era un comentario raíz, borrar en cascada sus respuestas.
    if (!comment.parent) {
      await Comment.deleteMany({
        table: req.params.id,
        parent: comment._id,
      });
    }
    res.json({ message: "Comment deleted" });
  }),
);

// POST /api/tables/:id/comments/:commentId/like — toggle like de comentario
router.post(
  "/:commentId/like",
  protect,
  asyncHandler(async (req, res) => {
    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");
    // Likes deshabilitados donde los comentarios lo están (mesas no públicas).
    assertCanComment(table);

    const comment = await Comment.findById(req.params.commentId);
    if (!comment || !isSameId(comment.table, table._id)) {
      throw httpError(404, "Comment not found");
    }

    const uid = req.user._id;
    const idx = comment.likes.findIndex((l) => isSameId(l, uid));
    const adding = idx === -1;
    if (adding) comment.likes.push(uid);
    else comment.likes.splice(idx, 1);
    await comment.save();

    if (adding && !isSameId(comment.author, uid)) {
      await emitNotificationReq(
        req,
        comment.author,
        "comment_like",
        {
          tableId: table._id.toString(),
          tableName: table.boardGame,
          commentId: comment._id.toString(),
          lastSenderUsername: req.user.username,
          actor: {
            userId: req.user._id.toString(),
            username: req.user.username,
          },
        },
        "table:comment-like",
        { fromUsername: req.user.username },
      ).catch(() => {});
    }

    res.json({ likes: comment.likes.length, liked: adding });
  }),
);

// GET /api/tables/:id/comments/:commentId/likes — quién likeó el comentario
router.get(
  "/:commentId/likes",
  protect,
  asyncHandler(async (req, res) => {
    const table = await Table.findById(req.params.id).select("privacy");
    if (!table) throw httpError(404, "Table not found");
    assertCanComment(table);

    const comment = await Comment.findById(req.params.commentId)
      .select("table likes")
      .populate("likes", "username displayName avatar");
    if (!comment || !isSameId(comment.table, table._id)) {
      throw httpError(404, "Comment not found");
    }
    res.json({ users: [...comment.likes].reverse() });
  }),
);

module.exports = router;
