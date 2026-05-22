const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const { emitNotificationReq } = require("../utils/emitNotification");

router.use(requireSection("amigos"));

router.param("id", validateObjectId("id"));

// POST /api/friends/:id/request — send friend request
router.post("/:id/request", protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    const myId = req.user._id.toString();

    if (targetId === myId) {
      return res
        .status(400)
        .json({ message: "No podés enviarte una solicitud a vos mismo" });
    }

    const [me, target] = await Promise.all([
      User.findById(myId).select("username friends"),
      User.findById(targetId).select("friendRequests friends"),
    ]);

    if (!target)
      return res.status(404).json({ message: "Usuario no encontrado" });

    if (me.friends.some((f) => f.toString() === targetId)) {
      return res.status(400).json({ message: "Ya son amigos" });
    }
    if (target.friendRequests.some((r) => r.from.toString() === myId)) {
      return res.status(400).json({ message: "Ya enviaste una solicitud" });
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
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/friends/:id/accept — accept request from :id
router.post("/:id/accept", protect, async (req, res) => {
  try {
    const fromId = req.params.id;
    const myId = req.user._id.toString();

    const [me, fromUser] = await Promise.all([
      User.findById(myId).select("username friends friendRequests"),
      User.findById(fromId).select("username friends"),
    ]);

    if (!fromUser)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const reqIndex = me.friendRequests.findIndex(
      (r) => r.from.toString() === fromId,
    );
    if (reqIndex === -1) {
      return res
        .status(400)
        .json({ message: "No hay solicitud de este usuario" });
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
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/friends/:id/reject — reject request from :id (silent)
router.post("/:id/reject", protect, async (req, res) => {
  try {
    const fromId = req.params.id;
    const me = await User.findById(req.user._id).select("friendRequests");

    const reqIndex = me.friendRequests.findIndex(
      (r) => r.from.toString() === fromId,
    );
    if (reqIndex === -1) {
      return res
        .status(400)
        .json({ message: "No hay solicitud de este usuario" });
    }

    me.friendRequests.splice(reqIndex, 1);
    await me.save();

    res.json({ message: "Solicitud rechazada" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/friends/:id/request — cancel sent request
router.delete("/:id/request", protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    const myId = req.user._id.toString();

    const target = await User.findById(targetId).select("friendRequests");
    if (!target)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const reqIndex = target.friendRequests.findIndex(
      (r) => r.from.toString() === myId,
    );
    if (reqIndex === -1) {
      return res.status(400).json({ message: "No hay solicitud pendiente" });
    }

    target.friendRequests.splice(reqIndex, 1);
    await target.save();

    Notification.deleteOne({
      recipient: targetId,
      type: "friend_request",
      fromUserId: myId,
    }).catch(() => {});

    res.json({ message: "Solicitud cancelada" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/friends/:id — unfriend
router.delete("/:id", protect, async (req, res) => {
  try {
    const otherId = req.params.id;
    const myId = req.user._id.toString();

    const [me, other] = await Promise.all([
      User.findById(myId).select("friends"),
      User.findById(otherId).select("friends"),
    ]);

    if (!other)
      return res.status(404).json({ message: "Usuario no encontrado" });

    me.friends = me.friends.filter((f) => f.toString() !== otherId);
    other.friends = other.friends.filter((f) => f.toString() !== myId);

    await Promise.all([me.save(), other.save()]);

    res.json({ message: "Amistad eliminada" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
