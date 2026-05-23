const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { emitNotificationReq } = require("../utils/emitNotification");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");

router.use(requireSection("amigos"));

router.param("id", validateObjectId("id"));

// POST /api/friends/:id/request — send friend request
router.post(
  "/:id/request",
  protect,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const myId = req.user._id.toString();

    if (isSameId(targetId, myId)) {
      throw httpError(400, "No podés enviarte una solicitud a vos mismo");
    }

    const [me, target] = await Promise.all([
      User.findById(myId).select("username friends"),
      User.findById(targetId).select("friendRequests friends"),
    ]);

    if (!target) throw httpError(404, "Usuario no encontrado");

    if (me.friends.some((f) => isSameId(f, targetId))) {
      throw httpError(400, "Ya son amigos");
    }
    if (target.friendRequests.some((r) => isSameId(r.from, myId))) {
      throw httpError(400, "Ya enviaste una solicitud");
    }

    target.friendRequests.push({ from: me._id });
    await target.save();

    await emitNotificationReq(
      req,
      targetId,
      "friend_request",
      { fromUserId: myId, fromUsername: me.username },
      "friend:request",
    ).catch(() => {});

    res.json({ message: "Solicitud enviada" });
  }),
);

// POST /api/friends/:id/accept — accept request from :id
router.post(
  "/:id/accept",
  protect,
  asyncHandler(async (req, res) => {
    const fromId = req.params.id;
    const myId = req.user._id.toString();

    const [me, fromUser] = await Promise.all([
      User.findById(myId).select("username friends friendRequests"),
      User.findById(fromId).select("username friends"),
    ]);

    if (!fromUser) throw httpError(404, "Usuario no encontrado");

    const reqIndex = me.friendRequests.findIndex((r) =>
      isSameId(r.from, fromId),
    );
    if (reqIndex === -1) {
      throw httpError(400, "No hay solicitud de este usuario");
    }

    me.friendRequests.splice(reqIndex, 1);
    me.friends.push(fromUser._id);
    fromUser.friends.push(me._id);

    await Promise.all([me.save(), fromUser.save()]);

    await emitNotificationReq(
      req,
      fromId,
      "friend_accepted",
      { fromUserId: myId, fromUsername: me.username },
      "friend:accepted",
    ).catch(() => {});

    res.json({ message: "Solicitud aceptada" });
  }),
);

// POST /api/friends/:id/reject — reject request from :id (silent)
router.post(
  "/:id/reject",
  protect,
  asyncHandler(async (req, res) => {
    const fromId = req.params.id;
    const me = await User.findById(req.user._id).select("friendRequests");

    const reqIndex = me.friendRequests.findIndex((r) =>
      isSameId(r.from, fromId),
    );
    if (reqIndex === -1) {
      throw httpError(400, "No hay solicitud de este usuario");
    }

    me.friendRequests.splice(reqIndex, 1);
    await me.save();

    res.json({ message: "Solicitud rechazada" });
  }),
);

// DELETE /api/friends/:id/request — cancel sent request
router.delete(
  "/:id/request",
  protect,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const myId = req.user._id.toString();

    const target = await User.findById(targetId).select("friendRequests");
    if (!target) throw httpError(404, "Usuario no encontrado");

    const reqIndex = target.friendRequests.findIndex((r) =>
      isSameId(r.from, myId),
    );
    if (reqIndex === -1) {
      throw httpError(400, "No hay solicitud pendiente");
    }

    target.friendRequests.splice(reqIndex, 1);
    await target.save();

    Notification.deleteOne({
      recipient: targetId,
      type: "friend_request",
      fromUserId: myId,
    }).catch(() => {});

    res.json({ message: "Solicitud cancelada" });
  }),
);

// DELETE /api/friends/:id — unfriend
router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const otherId = req.params.id;
    const myId = req.user._id.toString();

    const [me, other] = await Promise.all([
      User.findById(myId).select("friends"),
      User.findById(otherId).select("friends"),
    ]);

    if (!other) throw httpError(404, "Usuario no encontrado");

    me.friends = me.friends.filter((f) => !isSameId(f, otherId));
    other.friends = other.friends.filter((f) => !isSameId(f, myId));

    await Promise.all([me.save(), other.save()]);

    res.json({ message: "Amistad eliminada" });
  }),
);

module.exports = router;
