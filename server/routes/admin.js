const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { protect, requireAdmin } = require("../middleware/auth");
const validateObjectId = require("../middleware/validateObjectId");
const User = require("../models/User");
const Table = require("../models/Table");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

router.param("id", validateObjectId("id"));

// GET /api/admin/collections
router.get(
  "/collections",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const cols = await mongoose.connection.db.listCollections().toArray();
    const names = cols
      .map((c) => c.name)
      .filter((n) => !n.startsWith("system."))
      .sort();
    res.json(names);
  }),
);

// GET /api/admin/collections/:name
router.get(
  "/collections/:name",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    const searchTerm = (req.query.search || "").trim();

    const col = mongoose.connection.db.collection(name);

    let query = {};
    if (searchTerm) {
      if (/^[0-9a-f]{24}$/i.test(searchTerm)) {
        try {
          query = { _id: new mongoose.Types.ObjectId(searchTerm) };
        } catch {
          /* invalid ObjectId, keep empty query */
        }
      } else {
        const sample = await col.findOne({});
        if (sample) {
          const stringFields = Object.entries(sample)
            .filter(([, v]) => typeof v === "string")
            .map(([k]) => k);
          if (stringFields.length > 0) {
            query = {
              $or: stringFields.map((f) => ({
                [f]: { $regex: searchTerm, $options: "i" },
              })),
            };
          }
        }
      }
    }

    const [docs, total] = await Promise.all([
      col.find(query).skip(skip).limit(limit).toArray(),
      col.countDocuments(query),
    ]);

    res.json({ docs, total, page, pages: Math.ceil(total / limit) || 1 });
  }),
);

// PATCH /api/admin/users/:id/admin — toggle isAdmin
router.patch(
  "/users/:id/admin",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const target = await User.findById(req.params.id);
    if (!target) throw httpError(404, "User not found");
    target.isAdmin = !target.isAdmin;
    await target.save({ validateModifiedOnly: true });
    res.json({
      _id: target._id,
      username: target.username,
      isAdmin: target.isAdmin,
    });
  }),
);

// PATCH /api/admin/users/:id/ban — toggle ban
router.patch(
  "/users/:id/ban",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { banned, reason } = req.body;
    if (typeof banned !== "boolean") {
      throw httpError(400, 'El campo "banned" debe ser booleano');
    }
    if (req.params.id === req.user._id.toString()) {
      throw httpError(400, "No podés banearte a vos mismo");
    }
    const target = await User.findById(req.params.id);
    if (!target) throw httpError(404, "Usuario no encontrado");
    if (target.isAdmin) {
      throw httpError(400, "No podés banear a otro admin");
    }

    target.isBanned = banned;
    target.bannedAt = banned ? new Date() : null;
    target.bannedReason = banned ? (reason || "").toString().slice(0, 500) : "";
    await target.save({ validateModifiedOnly: true });

    res.json({
      _id: target._id,
      username: target.username,
      isBanned: target.isBanned,
      bannedAt: target.bannedAt,
      bannedReason: target.bannedReason,
    });
  }),
);

// DELETE /api/admin/users/:id — hard delete user
router.delete(
  "/users/:id",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user._id.toString()) {
      throw httpError(400, "No podés eliminarte a vos mismo");
    }
    const target = await User.findById(req.params.id);
    if (!target) throw httpError(404, "Usuario no encontrado");
    if (target.isAdmin) {
      throw httpError(400, "No podés eliminar a otro admin");
    }

    const id = target._id;

    // Cleanup: remove user from array references so UX doesn't break.
    // References in scalar fields (host, sender, author, etc.) are left orphaned
    // and will render as "Usuario eliminado" in the UI.
    await Promise.all([
      Table.updateMany(
        {},
        {
          $pull: {
            players: id,
            pendingRequests: id,
            followers: id,
          },
        },
      ),
      User.updateMany(
        {},
        {
          $pull: {
            friends: id,
            friendRequests: { from: id },
          },
        },
      ),
    ]);

    await User.findByIdAndDelete(id);

    res.json({ _id: id, deleted: true });
  }),
);

module.exports = router;
