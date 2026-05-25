const express = require("express");
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require("express-validator");
const Rating = require("../models/Rating");
const Table = require("../models/Table");
const { protect } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");

router.use(requireSection("mesas"));

// `:id` viene del parent mount (`/api/tables/:id/ratings`).
router.use(validateObjectId("id"));

const isParticipant = (table, userId) => {
  return (
    isSameId(table.host, userId) ||
    table.players.some((p) => isSameId(p, userId))
  );
};

// GET /api/tables/:id/ratings
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    const ratings = await Rating.find({ table: req.params.id })
      .populate("rater", "username displayName avatar")
      .sort({ createdAt: -1 });

    const avg = ratings.length
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : null;

    res.json({ ratings, avg, count: ratings.length });
  }),
);

// POST /api/tables/:id/ratings — participants only, after table date
router.post(
  "/",
  protect,
  [
    body("score")
      .isInt({ min: 1, max: 5 })
      .withMessage("La puntuación debe ser entre 1 y 5"),
    body("comment")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 300 })
      .withMessage("El comentario no puede superar los 300 caracteres"),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw httpError(400, errors.array()[0].msg);

    const table = await Table.findById(req.params.id);
    if (!table) throw httpError(404, "Table not found");

    if (new Date(table.date) > new Date()) {
      throw httpError(
        400,
        "Solo se puede valorar una mesa después de que se jugó",
      );
    }

    if (!isParticipant(table, req.user._id)) {
      throw httpError(
        403,
        "Solo los participantes de la mesa pueden valorarla",
      );
    }

    const existing = await Rating.findOne({
      table: req.params.id,
      rater: req.user._id,
    });

    let rating;
    if (existing) {
      existing.score = req.body.score;
      existing.comment = req.body.comment || "";
      rating = await existing.save();
    } else {
      rating = await Rating.create({
        table: req.params.id,
        rater: req.user._id,
        score: req.body.score,
        comment: req.body.comment || "",
      });
    }

    await rating.populate("rater", "username displayName avatar");

    const allRatings = await Rating.find({ table: req.params.id });
    const avg =
      allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;

    res.status(201).json({ rating, avg, count: allRatings.length });
  }),
);

module.exports = router;
