const express = require("express");
const router = express.Router();
const multer = require("../config/multer");
const { uploadToCloudinary } = require("../config/cloudinary");
const Community = require("../models/Community");
const User = require("../models/User");
const SiteConfig = require("../models/SiteConfig");
const { protect, requireAdmin, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const requireCommunityRole = require("../middleware/communityRole");
const validateObjectId = require("../middleware/validateObjectId");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { isSameId } = require("../utils/idCompare");
const { emitNotificationReq } = require("../utils/emitNotification");
const communityService = require("../services/communityService");

router.use(requireSection("comunidades"));
router.param("userId", validateObjectId("userId"));

const USER_FIELDS = "username displayName avatar";
const JOIN_POLICIES = ["open", "approval", "code"];

// Serializa una comunidad para directorio/detalle: agrega memberCount + el
// estado del usuario que consulta (member / pending / none) y oculta la lista
// cruda de pendingMembers.
function publicView(community, { memberCount = 0, user = null } = {}) {
  const obj = community.toJSON();
  obj.memberCount = memberCount;
  obj.viewerStatus = "none";
  if (user) {
    if (communityService.isMember(user, community._id)) {
      obj.viewerStatus = "member";
    } else if (
      (community.pendingMembers || []).some((p) => isSameId(p.user, user._id))
    ) {
      obj.viewerStatus = "pending";
    }
  }
  delete obj.pendingMembers;
  return obj;
}

// ── Rutas de path fijo (declaradas antes de /:slug) ────────────────────────

// GET /api/comunidades — directorio público (base primero).
router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const communities = await Community.find().sort({ isBase: -1, name: 1 });
    const counts = await communityService.memberCounts();
    res.json({
      comunidades: communities.map((c) =>
        publicView(c, {
          memberCount: counts.get(String(c._id)) || 0,
          user: req.user,
        }),
      ),
    });
  }),
);

// GET /api/comunidades/mias — memberships (con datos ricos) + prefs.
router.get(
  "/mias",
  protect,
  asyncHandler(async (req, res) => {
    const ids = (req.user.communityMemberships || []).map((m) => m.community);
    const communities = await Community.find({ _id: { $in: ids } });
    const byId = new Map(communities.map((c) => [String(c._id), c]));
    const memberships = (req.user.communityMemberships || [])
      .map((m) => {
        const c = byId.get(String(m.community));
        if (!c) return null;
        return { community: c.toJSON(), role: m.role, joinedAt: m.joinedAt };
      })
      .filter(Boolean);
    res.json({
      memberships,
      viewing: req.user.communityPrefs?.viewing || [],
      skin: req.user.communityPrefs?.skin || null,
    });
  }),
);

// PUT /api/comunidades/preferencias — set viewing[] + skin (validados ⊆ memberships).
router.put(
  "/preferencias",
  protect,
  asyncHandler(async (req, res) => {
    const memberIds = new Set(
      (req.user.communityMemberships || []).map((m) => String(m.community)),
    );
    if (!req.user.communityPrefs) req.user.communityPrefs = {};

    if (Array.isArray(req.body.viewing)) {
      req.user.communityPrefs.viewing = req.body.viewing.filter((v) =>
        memberIds.has(String(v)),
      );
    }
    if (req.body.skin !== undefined) {
      if (req.body.skin && !memberIds.has(String(req.body.skin))) {
        throw httpError(
          400,
          "El skin debe ser una comunidad a la que pertenecés",
        );
      }
      if (req.body.skin) req.user.communityPrefs.skin = req.body.skin;
    }
    await req.user.save({ validateModifiedOnly: true });
    res.json({
      viewing: req.user.communityPrefs.viewing || [],
      skin: req.user.communityPrefs.skin || null,
    });
  }),
);

// POST /api/comunidades — admin: crear.
router.post(
  "/",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) throw httpError(400, "El nombre es obligatorio");
    const joinPolicy = JOIN_POLICIES.includes(req.body.joinPolicy)
      ? req.body.joinPolicy
      : "open";
    const community = await Community.create({
      name,
      slug: await Community.generateSlug(name),
      description: String(req.body.description || "").trim(),
      joinPolicy,
      inviteCode:
        joinPolicy === "code" ? String(req.body.inviteCode || "").trim() : "",
      createdBy: req.user._id,
    });
    res.status(201).json(community.toJSON());
  }),
);

// ── Rutas /:slug ───────────────────────────────────────────────────────────

// PUT /api/comunidades/:slug — admin: editar (parcial; slug INMUTABLE, skin aparte).
router.put(
  "/:slug",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const community = await Community.findOne({
      slug: req.params.slug,
    }).select("+inviteCode");
    if (!community) throw httpError(404, "Comunidad no encontrada");

    if (req.body.name !== undefined) community.name = String(req.body.name).trim();
    if (req.body.description !== undefined) {
      community.description = String(req.body.description).trim();
    }
    if (JOIN_POLICIES.includes(req.body.joinPolicy)) {
      community.joinPolicy = req.body.joinPolicy;
    }
    if (req.body.inviteCode !== undefined) {
      community.inviteCode = String(req.body.inviteCode).trim();
    }
    if (req.body.sections && typeof req.body.sections === "object") {
      for (const [key, val] of Object.entries(req.body.sections)) {
        if (SiteConfig.SECTION_KEYS.includes(key)) {
          community.sections.set(key, val !== false);
        }
      }
    }
    await community.save();
    res.json(community.toJSON());
  }),
);

// PUT /api/comunidades/:slug/skin — admin: editar el skin (tokens + brand).
// Los tokens de color se sanitizan (allowlist hex/rgb) antes de guardar.
router.put(
  "/:slug/skin",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const community = await Community.findOne({ slug: req.params.slug });
    if (!community) throw httpError(404, "Comunidad no encontrada");

    if (req.body.accents) {
      community.set("skin.accents", Community.sanitizeSkinTokens(req.body.accents));
    }
    if (req.body.neutralsDark) {
      community.set(
        "skin.neutralsDark",
        Community.sanitizeSkinTokens(req.body.neutralsDark),
      );
    }
    if (req.body.neutralsLight) {
      community.set(
        "skin.neutralsLight",
        Community.sanitizeSkinTokens(req.body.neutralsLight),
      );
    }
    if (req.body.brandName !== undefined) {
      community.skin.brandName = String(req.body.brandName).slice(0, 60);
    }
    if (req.body.tagline !== undefined) {
      community.skin.tagline = String(req.body.tagline).slice(0, 140);
    }
    if (req.body.font !== undefined) {
      community.skin.font = String(req.body.font).slice(0, 80);
    }
    await community.save();
    res.json(community.toJSON());
  }),
);

// POST /api/comunidades/:slug/logo — admin: sube el logo (variant light|dark).
router.post(
  "/:slug/logo",
  protect,
  requireAdmin,
  multer.single("logo"),
  asyncHandler(async (req, res) => {
    const community = await Community.findOne({ slug: req.params.slug });
    if (!community) throw httpError(404, "Comunidad no encontrada");
    if (!req.file) throw httpError(400, "Falta el archivo del logo");
    const variant = req.body.variant === "dark" ? "dark" : "light";
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: `turnocero/communities/${community._id}`,
      transformation: [{ width: 400, crop: "limit" }],
    });
    const asset = { url: result.secure_url, publicId: result.public_id };
    community.set(variant === "dark" ? "skin.logoDark" : "skin.logoLight", asset);
    await community.save();
    res.json(community.toJSON());
  }),
);

// DELETE /api/comunidades/:slug — admin (409 si tiene contenido, 403 si isBase).
router.delete(
  "/:slug",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const community = await Community.findOne({ slug: req.params.slug });
    if (!community) throw httpError(404, "Comunidad no encontrada");
    await communityService.deleteCommunity(community);
    res.json({ message: "Comunidad eliminada" });
  }),
);

// POST /api/comunidades/:slug/reasignar-a-base — admin (vaciar antes de borrar).
router.post(
  "/:slug/reasignar-a-base",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const community = await Community.findOne({ slug: req.params.slug });
    if (!community) throw httpError(404, "Comunidad no encontrada");
    await communityService.reassignContentToBase(community);
    res.json({ message: "Contenido reasignado a la base" });
  }),
);

// POST /api/comunidades/:slug/join — open: une; approval: pending; code: valida.
router.post(
  "/:slug/join",
  protect,
  asyncHandler(async (req, res) => {
    const community = await communityService.resolveBySlug(req.params.slug, {
      withCode: true,
    });
    if (!community) throw httpError(404, "Comunidad no encontrada");
    const result = await communityService.joinCommunity(req.user, community, {
      code: req.body.code,
    });
    if (result.status === "pending") {
      const recipients = await communityService.joinRequestRecipientIds(
        community,
      );
      await Promise.all(
        recipients
          .filter((rid) => !isSameId(rid, req.user._id))
          .map((rid) =>
            emitNotificationReq(
              req,
              rid,
              "community_join_request",
              {
                communityId: String(community._id),
                communityName: community.name,
                communitySlug: community.slug,
                actor: {
                  userId: String(req.user._id),
                  username: req.user.username,
                },
              },
              "community:join-request",
            ),
          ),
      );
    }
    res.json(result);
  }),
);

// DELETE /api/comunidades/:slug/leave — salir (403 si isBase).
router.delete(
  "/:slug/leave",
  protect,
  asyncHandler(async (req, res) => {
    const community = await Community.findOne({ slug: req.params.slug });
    if (!community) throw httpError(404, "Comunidad no encontrada");
    await communityService.leaveCommunity(req.user, community);
    res.json({ message: "Saliste de la comunidad" });
  }),
);

// GET /api/comunidades/:slug/solicitudes — subadmin/admin.
router.get(
  "/:slug/solicitudes",
  protect,
  requireCommunityRole(),
  asyncHandler(async (req, res) => {
    await req.community.populate("pendingMembers.user", USER_FIELDS);
    res.json({ solicitudes: req.community.pendingMembers });
  }),
);

// POST /api/comunidades/:slug/solicitudes/:userId/aceptar — subadmin/admin.
router.post(
  "/:slug/solicitudes/:userId/aceptar",
  protect,
  requireCommunityRole(),
  asyncHandler(async (req, res) => {
    const requester = await communityService.acceptRequest(
      req.community,
      req.params.userId,
    );
    if (requester) {
      await emitNotificationReq(
        req,
        requester._id,
        "community_join_accepted",
        {
          communityId: String(req.community._id),
          communityName: req.community.name,
          communitySlug: req.community.slug,
        },
        "community:join-resolved",
        { resolution: "accepted" },
      );
    }
    res.json({ message: "Solicitud aceptada" });
  }),
);

// POST /api/comunidades/:slug/solicitudes/:userId/rechazar — subadmin/admin.
router.post(
  "/:slug/solicitudes/:userId/rechazar",
  protect,
  requireCommunityRole(),
  asyncHandler(async (req, res) => {
    const requester = await communityService.rejectRequest(
      req.community,
      req.params.userId,
    );
    if (requester) {
      await emitNotificationReq(
        req,
        requester._id,
        "community_join_rejected",
        {
          communityId: String(req.community._id),
          communityName: req.community.name,
          communitySlug: req.community.slug,
        },
        "community:join-resolved",
        { resolution: "rejected" },
      );
    }
    res.json({ message: "Solicitud rechazada" });
  }),
);

// GET /api/comunidades/:slug/miembros — subadmin/admin.
router.get(
  "/:slug/miembros",
  protect,
  requireCommunityRole(),
  asyncHandler(async (req, res) => {
    const members = await User.find({
      "communityMemberships.community": req.community._id,
    }).select("username displayName avatar communityMemberships");
    res.json({
      miembros: members.map((u) => {
        const m = (u.communityMemberships || []).find((mm) =>
          isSameId(mm.community, req.community._id),
        );
        return {
          _id: u._id,
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar,
          role: m?.role || "member",
          joinedAt: m?.joinedAt,
        };
      }),
    });
  }),
);

// DELETE /api/comunidades/:slug/miembros/:userId — expulsar (subadmin/admin).
router.delete(
  "/:slug/miembros/:userId",
  protect,
  requireCommunityRole(),
  asyncHandler(async (req, res) => {
    await communityService.expelMember(req.community, req.params.userId);
    res.json({ message: "Miembro expulsado" });
  }),
);

// PUT /api/comunidades/:slug/subadmins/:userId — admin: asignar/revocar subadmin.
router.put(
  "/:slug/subadmins/:userId",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const community = await Community.findOne({ slug: req.params.slug });
    if (!community) throw httpError(404, "Comunidad no encontrada");
    const makeSubadmin = req.body.subadmin !== false;
    await communityService.setSubadmin(
      community,
      req.params.userId,
      makeSubadmin,
    );
    res.json({
      message: makeSubadmin ? "Subadmin asignado" : "Subadmin removido",
    });
  }),
);

// GET /api/comunidades/:slug — detalle (público). Declarado al final para no
// shadowear los paths fijos y los sub-recursos.
router.get(
  "/:slug",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const community = await Community.findOne({ slug: req.params.slug });
    if (!community) throw httpError(404, "Comunidad no encontrada");
    const counts = await communityService.memberCounts();
    res.json(
      publicView(community, {
        memberCount: counts.get(String(community._id)) || 0,
        user: req.user,
      }),
    );
  }),
);

module.exports = router;
