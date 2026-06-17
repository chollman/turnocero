const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { protect, requireAdmin } = require("../middleware/auth");
const validateObjectId = require("../middleware/validateObjectId");
const User = require("../models/User");
const Table = require("../models/Table");
const BggUsageDaily = require("../models/BggUsageDaily");
const BggUsageEvent = require("../models/BggUsageEvent");
const BggGame = require("../models/BggGame");
const { dayKeyAR, dayRangeToUtc, subtractDays } = require("../utils/dayKey");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

router.param("id", validateObjectId("id"));

// Resuelve el rango de días [from, to] (YYYY-MM-DD, hora AR) de la query.
// Default: últimos 7 días terminando hoy. Valida formato y ordena.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function resolveRange(query) {
  let to = DAY_RE.test(query.to || "") ? query.to : dayKeyAR();
  let from = DAY_RE.test(query.from || "") ? query.from : subtractDays(to, 6);
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

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

// GET /api/admin/bgg-usage?from&to — reporte de uso de BGG por usuario en el
// rango. Devuelve totales, fila por usuario (lecturas + desglose por endpoint
// + syncs + mutaciones) y serie diaria para el gráfico de tendencia.
router.get(
  "/bgg-usage",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { from, to } = resolveRange(req.query);

    const rows = await BggUsageDaily.aggregate([
      { $match: { day: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$userId",
          reads: { $sum: "$reads" },
          syncs: { $sum: "$syncs" },
          created: { $sum: "$mutations.created" },
          edited: { $sum: "$mutations.edited" },
          deleted: { $sum: "$mutations.deleted" },
          search: { $sum: "$readsByEndpoint.search" },
          thing: { $sum: "$readsByEndpoint.thing" },
          plays: { $sum: "$readsByEndpoint.plays" },
          collection: { $sum: "$readsByEndpoint.collection" },
          other: { $sum: "$readsByEndpoint.other" },
        },
      },
    ]);

    const userIds = rows.map((r) => r._id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } })
      .select("username displayName avatar bggUsername")
      .lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const perUser = rows
      .map((r) => {
        const u = r._id ? byId.get(String(r._id)) : null;
        return {
          userId: r._id || null,
          user: u
            ? {
                _id: u._id,
                username: u.username,
                displayName: u.displayName,
                avatar: u.avatar,
              }
            : null,
          bggUsername: u?.bggUsername || null,
          reads: r.reads,
          syncs: r.syncs,
          mutations: { created: r.created, edited: r.edited, deleted: r.deleted },
          byEndpoint: {
            search: r.search,
            thing: r.thing,
            plays: r.plays,
            collection: r.collection,
            other: r.other,
          },
        };
      })
      .sort((a, b) => b.reads + b.syncs - (a.reads + a.syncs));

    const totals = perUser.reduce(
      (acc, r) => {
        acc.reads += r.reads;
        acc.syncs += r.syncs;
        acc.created += r.mutations.created;
        acc.edited += r.mutations.edited;
        acc.deleted += r.mutations.deleted;
        return acc;
      },
      { reads: 0, syncs: 0, created: 0, edited: 0, deleted: 0 },
    );

    const byDayAgg = await BggUsageDaily.aggregate([
      { $match: { day: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$day",
          reads: { $sum: "$reads" },
          syncs: { $sum: "$syncs" },
          mutations: {
            $sum: {
              $add: [
                "$mutations.created",
                "$mutations.edited",
                "$mutations.deleted",
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      from,
      to,
      totals,
      perUser,
      byDay: byDayAgg.map((d) => ({
        day: d._id,
        reads: d.reads,
        syncs: d.syncs,
        mutations: d.mutations,
      })),
    });
  }),
);

// GET /api/admin/bgg-usage/events?from&to&page&action&userId — log itemizado
// de mutaciones (qué partida cargó/editó/borró cada usuario). Paginado.
router.get(
  "/bgg-usage/events",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { from, to } = resolveRange(req.query);
    const { start, end } = dayRangeToUtc(from, to);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const match = { createdAt: { $gte: start, $lt: end } };
    if (["create", "edit", "delete"].includes(req.query.action)) {
      match.action = req.query.action;
    }
    if (/^[0-9a-f]{24}$/i.test(req.query.userId || "")) {
      match.userId = new mongoose.Types.ObjectId(req.query.userId);
    }

    const [events, total] = await Promise.all([
      BggUsageEvent.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "username displayName avatar bggUsername")
        .lean(),
      BggUsageEvent.countDocuments(match),
    ]);

    // Resolvemos nombres de juego faltantes desde el cache local BggGame (sin
    // pegarle a BGG): muchos eventos guardan solo gameId.
    const missing = [
      ...new Set(
        events
          .filter((e) => !e.gameName && e.gameId)
          .map((e) => Number(e.gameId))
          .filter((n) => !Number.isNaN(n)),
      ),
    ];
    let nameById = new Map();
    if (missing.length) {
      const games = await BggGame.find({ gameId: { $in: missing } })
        .select("gameId name")
        .lean();
      nameById = new Map(games.map((g) => [String(g.gameId), g.name]));
    }

    res.json({
      from,
      to,
      page,
      total,
      pages: Math.ceil(total / limit) || 1,
      events: events.map((e) => ({
        _id: e._id,
        action: e.action,
        playId: e.playId,
        gameId: e.gameId,
        gameName: e.gameName || nameById.get(String(e.gameId)) || null,
        bggUsername: e.bggUsername,
        user: e.userId
          ? {
              _id: e.userId._id,
              username: e.userId.username,
              displayName: e.userId.displayName,
              avatar: e.userId.avatar,
            }
          : null,
        createdAt: e.createdAt,
      })),
    });
  }),
);

module.exports = router;
