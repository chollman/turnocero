const express = require("express");
const router = express.Router();
const multerLib = require("multer");
const multer = require("../config/multer");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");
const Evento = require("../models/Evento");
const { protect, requireAdmin, optionalAuth } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const validateObjectId = require("../middleware/validateObjectId");
const {
  isValidCoord,
  attachDistance,
  buildBboxFilter,
} = require("../utils/geo");
const {
  normalizeLocationInput,
  isEmptyLocation,
} = require("../utils/locationHelpers");
const { emitNotificationReq } = require("../utils/emitNotification");
const { canActInEvento } = require("../utils/eventoPermissions");
const { parsePagination } = require("../utils/paginate");
const {
  emitToUser,
  emitToEventoRoom,
  emitToEventosList,
} = require("../utils/socketHelpers");
const { resolveGame } = require("./bgg");
const { listTables } = require("./tables");

router.use(requireSection("eventos"));

// Validación temprana de ObjectId en cualquier ruta que use :id o :userId.
// Antes, un string malformado pegaba a Mongoose y devolvía CastError 500 o
// silenciosamente null → 404. Ahora devolvemos 400 sin tocar la DB.
router.param("id", validateObjectId("id"));
router.param("userId", validateObjectId("userId"));

// Calcula el snapshot público de inscripciones de un evento.
function countsFor(evento) {
  const regs = evento.registrations || [];
  return {
    total: regs.length,
    pending: regs.filter((r) => r.status === "pending").length,
    confirmed: regs.filter((r) => r.status === "confirmed").length,
  };
}

// Helpers de socket (emitToUser / emitToEventoRoom / emitToEventosList)
// viven en `server/utils/socketHelpers.js` — un único lugar compartido con
// otros routers en lugar de copias locales por archivo.

// ── Notifications helpers ─────────────────────────────────────────────
//
// Notifica a un usuario individual: persiste + socket emit (vía
// emitNotificationReq → contrato unificado con notifId + count absoluto).
// Skip si el recipient es el mismo que el actor (un admin que confirma su
// propia inscripción, ej., no debería auto-notificarse).
//
// Devuelve una Promise para que el caller pueda awaitearla — si no la
// awaitea, el emit puede ocurrir DESPUÉS de res.json y los tests pierden
// el evento. En prod no afecta correctness; en tests sí.
function notifyOne(req, recipientId, type, fields, actorId) {
  if (recipientId == null) return Promise.resolve();
  if (actorId != null && recipientId.toString() === actorId.toString()) {
    return Promise.resolve();
  }
  // `type` también va en el payload del socket (el client lo usa como
  // discriminador para el listener único `evento:notification`).
  return emitNotificationReq(
    req,
    recipientId,
    type,
    fields,
    "evento:notification",
    {
      type,
    },
  ).catch(() => {
    /* best-effort */
  });
}

// Cancela todas las mesas asociadas al evento (en cascada cuando el evento
// se cancela o elimina). Emite `table:cancelled` a cada participante de cada
// mesa para que su UI lo refleje sin refresh. Idempotente: si una mesa ya
// está cancelled, no se toca.
async function cancelAssociatedTables(req, eventoId) {
  const Table = require("../models/Table");
  const tables = await Table.find({
    eventoId,
    status: { $ne: "cancelled" },
  }).select("_id boardGame host players followers");
  if (tables.length === 0) return;

  await Table.updateMany(
    { _id: { $in: tables.map((t) => t._id) } },
    { $set: { status: "cancelled" } },
  );

  // Notif persistente + emit a cada participante (members + followers, sin host
  // duplicado). Reusa el mismo helper que el handler DELETE /api/tables/:id.
  for (const table of tables) {
    const hostId = table.host.toString();
    const recipients = new Set([
      ...table.players.map((p) => p.toString()),
      ...table.followers.map((f) => f.toString()),
    ]);
    recipients.delete(hostId);
    // El host también recibe notif: la cancelación no fue iniciada por él.
    recipients.add(hostId);
    await Promise.all(
      [...recipients].map((userId) =>
        emitNotificationReq(
          req,
          userId,
          "table_cancelled",
          {
            tableId: table._id.toString(),
            tableName: table.boardGame,
          },
          "table:cancelled",
        ).catch(() => {}),
      ),
    );
  }
}

// Notifica a todos los inscriptos activos (confirmed + pending) de un evento,
// excluyendo al autor del evento (el admin) si es el actor. Usado para cancel
// y update.
function notifyActiveRegistrations(req, evento, type, extraFields, actorId) {
  const baseFields = {
    eventoId: evento._id.toString(),
    eventoTitle: evento.title,
    eventoDate: evento.eventDate,
    ...extraFields,
  };
  const promises = [];
  for (const reg of evento.registrations || []) {
    if (reg.status !== "confirmed" && reg.status !== "pending") continue;
    promises.push(notifyOne(req, reg.user, type, baseFields, actorId));
  }
  return Promise.all(promises);
}

// Devuelve la subdoc de registro con su `user` populado a { _id, username,
// displayName, avatar }. Necesario para que los clients del evento puedan
// mostrar el usuario en la grilla de inscriptos confirmados sin re-fetch.
async function reloadRegPopulated(evento, regId) {
  await evento.populate({
    path: "registrations.user",
    select: "username displayName avatar",
  });
  const reg = evento.registrations.id(regId);
  if (!reg) return null;
  return {
    _id: reg._id.toString(),
    status: reg.status,
    submittedAt: reg.submittedAt,
    reviewedAt: reg.reviewedAt,
    adminNotes: reg.adminNotes || null,
    permanentlyRejected: !!reg.permanentlyRejected,
    user: reg.user
      ? {
          _id: reg.user._id?.toString?.() || reg.user._id,
          username: reg.user.username,
          displayName: reg.user.displayName,
          avatar: reg.user.avatar,
        }
      : null,
  };
}

// Cierra automáticamente los eventos abiertos cuya fecha ya pasó.
// Se llama lazy al inicio de las rutas GET de listado y detalle: el primer
// request después de la fecha "barre" el estado y persiste status='closed',
// para que filtros y cards reflejen la realidad sin requerir un cron externo.
// Si `req` se provee, además broadcastea evento:updated por cada item cerrado
// para que los clientes en /eventos muevan el item de "Abiertos" a "Cerrados"
// sin esperar al próximo refresh.
async function closePastOpenEvents(req) {
  try {
    // Traer docs completos con author populated — necesario porque algunos
    // clientes (los que tienen chip "Cerrados" activo) van a AGREGAR el item
    // a su lista cuando llegue el broadcast, y necesitan title/author/etc.
    // para renderizar la card. Si emitiéramos sólo {_id, status} mostrarían
    // una card vacía.
    const candidates = await Evento.find({
      status: "open",
      eventDate: { $ne: null, $lt: new Date() },
    }).populate("author", "username displayName avatar");
    if (candidates.length === 0) return;
    await Evento.updateMany(
      { _id: { $in: candidates.map((c) => c._id) } },
      { $set: { status: "closed" } },
    );
    if (!req) return;
    for (const c of candidates) {
      const idStr = c._id.toString();
      const obj = c.toObject();
      delete obj.registrations;
      const payload = {
        ...obj,
        status: "closed", // el doc en memoria aún tenía status='open'
        registrationCount: countsFor(c),
        userRegistration: null,
      };
      emitToEventoRoom(req, idStr, "evento:updated", {
        eventoId: idStr,
        evento: payload,
      });
      emitToEventosList(req, "evento:updated", {
        eventoId: idStr,
        evento: payload,
      });
    }
  } catch (err) {
    // best-effort: nunca tirar el request por una falla del sweep
    console.error("closePastOpenEvents failed:", err.message);
  }
}

// Multer instance that also accepts PDF for comprobante uploads
const COMPROBANTE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const comprobanteUpload = multerLib({
  storage: multerLib.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB for PDFs
  fileFilter: (_req, file, cb) => {
    if (COMPROBANTE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se permiten imágenes (JPG, PNG) o PDF"));
  },
});

// GET /api/eventos — public, paginated
router.get("/", optionalAuth, async (req, res) => {
  try {
    await closePastOpenEvents(req);
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 10,
      maxLimit: 20,
    });

    const filter = {};
    if (req.user?.isAdmin) {
      if (req.query.status) filter.status = req.query.status;
    } else if (req.query.status === "open" || req.query.status === "closed") {
      // Los chips públicos pueden filtrar entre open/closed; otros valores caen
      // al default para que un user no pueda pedir 'draft' o 'cancelled'.
      filter.status = req.query.status;
    } else {
      filter.status = { $in: ["open", "closed"] };
    }

    // Búsqueda case-insensitive por título. Si llegan muchos eventos al feed
    // los chips de status no alcanzan; el input debounced del cliente manda
    // ?search=. Escapamos regex metacharacters para que el usuario no rompa
    // la query con caracteres especiales.
    const searchRaw = (req.query.search || "").trim();
    if (searchRaw) {
      const escaped = searchRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: escaped, $options: "i" };
    }

    const userLat = req.user?.direccion?.lat ?? null;
    const userLng = req.user?.direccion?.lng ?? null;
    const maxKmRaw = parseFloat(req.query.maxDistanceKm);
    const maxKm = Number.isFinite(maxKmRaw) && maxKmRaw > 0 ? maxKmRaw : null;
    const filterByDistance = maxKm !== null && isValidCoord(userLat, userLng);

    const userIdStr = req.user?._id?.toString();

    // Enriquece cada evento con counts + userRegistration. Reutilizable en
    // ambos modos (con o sin filtro de distancia).
    const enrichOne = (ev) => {
      const obj = typeof ev.toObject === "function" ? ev.toObject() : ev;
      const regs = obj.registrations || [];
      const registrationCount = {
        total: regs.length,
        pending: regs.filter((r) => r.status === "pending").length,
        confirmed: regs.filter((r) => r.status === "confirmed").length,
      };
      let userRegistration = null;
      if (userIdStr) {
        const reg = regs.find((r) => r.user?.toString() === userIdStr);
        if (reg) {
          userRegistration = {
            _id: reg._id,
            status: reg.status,
            submittedAt: reg.submittedAt,
            permanentlyRejected: !!reg.permanentlyRejected,
          };
        }
      }
      delete obj.registrations;
      return { ...obj, registrationCount, userRegistration };
    };

    if (filterByDistance) {
      // Modo filtro: bbox en Mongo + refine Haversine en memoria + paginación post-refine.
      const bbox = buildBboxFilter(userLat, userLng, maxKm);
      const all = await Evento.find({ ...filter, ...bbox })
        .populate("author", "username displayName avatar")
        .sort({ createdAt: -1 });
      const withDistance = attachDistance(all, userLat, userLng)
        .filter((ev) => ev.distanceKm !== null && ev.distanceKm <= maxKm)
        .map(enrichOne);
      const total = withDistance.length;
      const slice = withDistance.slice(skip, skip + limit);
      return res.json({
        eventos: slice,
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    }

    const [eventos, total] = await Promise.all([
      Evento.find(filter)
        .populate("author", "username displayName avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Evento.countDocuments(filter),
    ]);

    const withDistance = attachDistance(eventos, userLat, userLng);
    const enriched = withDistance.map(enrichOne);

    res.json({
      eventos: enriched,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/eventos:", err.message);
    res.status(500).json({ message: "Error al obtener eventos" });
  }
});

// GET /api/eventos/mine — eventos donde el user es author o inscripción activa.
// Usado por el formulario de Compartidas para listar candidatos para vincular.
// Devuelve forma ligera (no incluye registrations ni counts) — solo lo justo
// para renderizar un <option> en un select.
router.get("/mine", protect, async (req, res) => {
  try {
    const uid = req.user._id;
    const eventos = await Evento.find({
      $or: [
        { author: uid },
        {
          registrations: {
            $elemMatch: {
              user: uid,
              status: { $in: ["confirmed", "pending"] },
            },
          },
        },
      ],
      status: { $in: ["open", "closed"] }, // ocultamos drafts y cancelled
    })
      .select("title eventDate status image")
      .sort({ eventDate: -1 })
      .limit(50);
    res.json({ eventos });
  } catch (err) {
    console.error("GET /api/eventos/mine:", err.message);
    res.status(500).json({ message: "Error al obtener tus eventos" });
  }
});

// POST /api/eventos — admin only
router.post(
  "/",
  protect,
  requireAdmin,
  multer.single("image"),
  async (req, res) => {
    try {
      if (!req.body.title?.trim()) {
        return res.status(400).json({ message: "El título es obligatorio" });
      }
      if (!req.body.eventDate) {
        return res
          .status(400)
          .json({ message: "La fecha y hora del evento son obligatorias" });
      }
      const parsedDate = new Date(req.body.eventDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ message: "La fecha del evento no es válida" });
      }
      const VALID_STATUSES = ["draft", "open", "closed", "cancelled"];
      if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
        return res.status(400).json({
          message: `Status inválido. Debe ser uno de: ${VALID_STATUSES.join(", ")}`,
        });
      }

      let image;
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: "turnocero/eventos",
          transformation: [{ width: 1200, crop: "limit" }],
        });
        image = { url: result.secure_url, publicId: result.public_id };
      }

      // Location obligatoria — sin fallback al direccion del perfil del admin.
      // Es info importante del evento y siempre debe especificarse explícitamente.
      const normalizedLocation = normalizeLocationInput(req.body.location);
      if (isEmptyLocation(normalizedLocation)) {
        return res
          .status(400)
          .json({ message: "El lugar del evento es obligatorio" });
      }

      const evento = await Evento.create({
        title: req.body.title?.trim(),
        description: req.body.description?.trim() || undefined,
        conditions: req.body.conditions?.trim() || undefined,
        fee: parseFloat(req.body.fee) || 0,
        transferDetails: req.body.transferDetails?.trim() || undefined,
        eventDate: req.body.eventDate || undefined,
        location: normalizedLocation,
        maxParticipants: req.body.maxParticipants
          ? parseInt(req.body.maxParticipants)
          : undefined,
        status: req.body.status || "open",
        image,
        author: req.user._id,
      });

      const populated = await evento.populate(
        "author",
        "username displayName avatar",
      );

      // Broadcast a la lista (no drafts — son privados al admin).
      if (populated.status !== "draft") {
        const obj = populated.toObject();
        delete obj.registrations;
        emitToEventosList(req, "evento:created", {
          evento: {
            ...obj,
            registrationCount: { total: 0, pending: 0, confirmed: 0 },
            userRegistration: null,
          },
        });
      }

      res.status(201).json(populated);
    } catch (err) {
      console.error("POST /api/eventos:", err.message);
      res.status(500).json({ message: "Error al crear el evento" });
    }
  },
);

// GET /api/eventos/:id/og — metadata pública para crawlers de redes sociales.
// El middleware del cliente (client/middleware.js) detecta el UA y consulta
// este endpoint para armar OG tags. NO requiere auth y NO devuelve drafts ni
// cancelled. Mismo patrón que /api/compartidas/:id/og.
router.get("/:id/og", async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id)
      .populate("author", "username displayName")
      .select("title description eventDate location image status author");
    if (!evento || evento.status === "draft" || evento.status === "cancelled") {
      return res.status(404).json({});
    }
    res.json({
      title: evento.title,
      description: evento.description?.slice(0, 160) || null,
      image: evento.image?.url || null,
      eventDate: evento.eventDate,
      location:
        typeof evento.location === "string"
          ? evento.location
          : evento.location?.displayName || evento.location?.texto || null,
      host: evento.author?.displayName || evento.author?.username || null,
    });
  } catch {
    res.status(500).json({});
  }
});

// GET /api/eventos/:id — public for open/closed; drafts y cancelled sólo para admins
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    await closePastOpenEvents(req);
    const evento = await Evento.findById(req.params.id)
      .populate("author", "username displayName avatar")
      .populate("registrations.user", "username displayName avatar");

    if (!evento)
      return res.status(404).json({ message: "Evento no encontrado" });
    if (
      !req.user?.isAdmin &&
      (evento.status === "draft" || evento.status === "cancelled")
    ) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    const registrationCount = {
      total: evento.registrations.length,
      pending: evento.registrations.filter((r) => r.status === "pending")
        .length,
      confirmed: evento.registrations.filter((r) => r.status === "confirmed")
        .length,
    };

    const confirmedRegistrations = evento.registrations
      .filter((r) => r.status === "confirmed")
      .map((r) => ({
        _id: r._id,
        user: r.user
          ? {
              _id: r.user._id,
              username: r.user.username,
              displayName: r.user.displayName,
              avatar: r.user.avatar,
            }
          : null,
      }));

    let userRegistration = null;
    if (req.user) {
      const reg = evento.registrations.find(
        (r) => r.user?._id?.toString() === req.user._id.toString(),
      );
      if (reg) {
        userRegistration = {
          _id: reg._id,
          status: reg.status,
          submittedAt: reg.submittedAt,
          permanentlyRejected: !!reg.permanentlyRejected,
          adminNotes: reg.adminNotes || null,
          comprobante: reg.comprobante
            ? {
                url: reg.comprobante.url,
                resourceType: reg.comprobante.resourceType,
              }
            : null,
        };
      }
    }

    const eventoObj = evento.toObject();
    delete eventoObj.registrations;
    res.json({
      ...eventoObj,
      registrationCount,
      userRegistration,
      confirmedRegistrations,
    });
  } catch (err) {
    console.error("GET /api/eventos/:id:", err.message);
    res.status(500).json({ message: "Error al obtener el evento" });
  }
});

// PUT /api/eventos/:id — admin only
router.put(
  "/:id",
  protect,
  requireAdmin,
  multer.single("image"),
  async (req, res) => {
    try {
      // Validar status temprano contra el enum antes de hacer queries.
      // Sin esto, un valor inválido moría en mongoose validation → 500 genérico.
      const VALID_STATUSES = ["draft", "open", "closed", "cancelled"];
      if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
        return res.status(400).json({
          message: `Status inválido. Debe ser uno de: ${VALID_STATUSES.join(", ")}`,
        });
      }

      const evento = await Evento.findById(req.params.id);
      if (!evento)
        return res.status(404).json({ message: "Evento no encontrado" });

      // Snapshot pre-edit para detectar cambios significativos que deben
      // notificarse a los inscriptos (fecha, lugar, cancelación).
      const prevStatus = evento.status;
      const prevEventDate = evento.eventDate
        ? evento.eventDate.getTime()
        : null;
      const prevLocation = {
        texto: evento.location?.texto || "",
        lat: evento.location?.lat ?? null,
        lng: evento.location?.lng ?? null,
      };

      // Partial update: only modify fields that were actually sent in the body.
      // The form sends every field (empty string clears the value); a partial call
      // like cancellation can send just { status } without clobbering everything else.
      if (req.body.title !== undefined && req.body.title.trim()) {
        evento.title = req.body.title.trim();
      }
      if (req.body.description !== undefined)
        evento.description = req.body.description.trim() || undefined;
      if (req.body.conditions !== undefined)
        evento.conditions = req.body.conditions.trim() || undefined;
      if (req.body.fee !== undefined)
        evento.fee = parseFloat(req.body.fee) || 0;
      if (req.body.transferDetails !== undefined)
        evento.transferDetails = req.body.transferDetails.trim() || undefined;
      if (req.body.eventDate !== undefined)
        evento.eventDate = req.body.eventDate || undefined;
      if (req.body.location !== undefined) {
        // Location obligatoria también en update — no permitir limpiarla.
        const normalizedLocation = normalizeLocationInput(req.body.location);
        if (isEmptyLocation(normalizedLocation)) {
          return res
            .status(400)
            .json({ message: "El lugar del evento es obligatorio" });
        }
        evento.location = normalizedLocation;
      }
      if (req.body.maxParticipants !== undefined) {
        evento.maxParticipants = req.body.maxParticipants
          ? parseInt(req.body.maxParticipants)
          : undefined;
      }
      if (req.body.status) evento.status = req.body.status;

      if (req.file) {
        // Subir el nuevo asset primero. Recién después de que tenemos el nuevo
        // publicId persistido, intentamos destruir el viejo — así, si el upload
        // falla, el evento conserva su imagen anterior.
        const oldPublicId = evento.image?.publicId;
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: "turnocero/eventos",
          transformation: [{ width: 1200, crop: "limit" }],
        });
        evento.image = { url: result.secure_url, publicId: result.public_id };
        if (oldPublicId) {
          cloudinary.uploader.destroy(oldPublicId).catch(() => {
            /* best-effort cleanup */
          });
        }
      }

      await evento.save();
      const populated = await evento.populate(
        "author",
        "username displayName avatar",
      );

      const registrationCount = {
        total: evento.registrations.length,
        pending: evento.registrations.filter((r) => r.status === "pending")
          .length,
        confirmed: evento.registrations.filter((r) => r.status === "confirmed")
          .length,
      };

      const eventoObj = populated.toObject();
      delete eventoObj.registrations;
      const payload = {
        ...eventoObj,
        registrationCount,
        userRegistration: null,
      };

      // Notificar a todos los que estén viendo el evento (room evento:<id>).
      // Incluye cambios de status (cancel/reopen), edits del form, imagen nueva,
      // etc. — los clientes mergean en su state local.
      emitToEventoRoom(req, evento._id, "evento:updated", {
        eventoId: evento._id.toString(),
        evento: payload,
      });

      // Broadcast a la lista pública. Si el evento pasó a draft, mejor avisar
      // como "deleted" para que los users normales lo saquen de su vista.
      if (evento.status === "draft") {
        emitToEventosList(req, "evento:deleted", {
          eventoId: evento._id.toString(),
        });
      } else {
        emitToEventosList(req, "evento:updated", {
          eventoId: evento._id.toString(),
          evento: payload,
        });
      }

      // ── Notificaciones a inscriptos sobre cambios significativos ──
      // Cancelación (status pasó a "cancelled" recién): notif a confirmados+pending.
      if (evento.status === "cancelled" && prevStatus !== "cancelled") {
        await notifyActiveRegistrations(
          req,
          evento,
          "evento_cancelled",
          {},
          evento.author,
        );
        // Cascade: cancelar todas las mesas del evento + notif a participantes.
        await cancelAssociatedTables(req, evento._id);
      } else {
        // Si NO se canceló, chequear si cambió fecha o ubicación. Otros campos
        // (descripción, fee, etc.) no notifican — no son tan críticos.
        const changedFields = [];
        const newEventDate = evento.eventDate
          ? evento.eventDate.getTime()
          : null;
        if (newEventDate !== prevEventDate) changedFields.push("eventDate");
        const newLoc = {
          texto: evento.location?.texto || "",
          lat: evento.location?.lat ?? null,
          lng: evento.location?.lng ?? null,
        };
        if (
          newLoc.texto !== prevLocation.texto ||
          newLoc.lat !== prevLocation.lat ||
          newLoc.lng !== prevLocation.lng
        ) {
          changedFields.push("location");
        }
        if (changedFields.length > 0 && evento.status !== "draft") {
          await notifyActiveRegistrations(
            req,
            evento,
            "evento_updated",
            { changedFields },
            evento.author,
          );
        }
      }

      res.json(payload);
    } catch (err) {
      console.error("PUT /api/eventos/:id:", err.message);
      res.status(500).json({ message: "Error al editar el evento" });
    }
  },
);

// DELETE /api/eventos/:id — admin only
router.delete("/:id", protect, requireAdmin, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento)
      return res.status(404).json({ message: "Evento no encontrado" });

    // Limpieza best-effort de assets en Cloudinary: imagen del evento +
    // todos los comprobantes de las inscripciones (algunos pueden ser PDFs,
    // que se subieron como resource_type='raw' y requieren ese flag al borrar).
    // Disparamos todos los destroys en paralelo y atrapamos errores
    // individualmente para que un fallo no impida la eliminación del documento.
    const destroys = [];
    if (evento.image?.publicId) {
      destroys.push(
        cloudinary.uploader.destroy(evento.image.publicId).catch(() => {}),
      );
    }
    for (const reg of evento.registrations || []) {
      if (reg.comprobante?.publicId) {
        destroys.push(
          cloudinary.uploader
            .destroy(reg.comprobante.publicId, {
              resource_type: reg.comprobante.resourceType || "image",
            })
            .catch(() => {}),
        );
      }
    }
    await Promise.all(destroys);

    const deletedId = evento._id.toString();

    // Persistente + toast a los inscriptos activos ANTES de borrar — necesitamos
    // los datos del evento todavía. Usamos "evento_cancelled" para eliminación
    // (semánticamente similar para el user que se anota: el evento no va), pero
    // marcamos `eventoDeleted: true` para que el cliente no abra el deep-link
    // a /eventos/:id (404) y en su lugar mande a la lista.
    await notifyActiveRegistrations(
      req,
      evento,
      "evento_cancelled",
      { eventoDeleted: true },
      evento.author,
    );

    // Cascade: cancelar todas las mesas asociadas (igual que en PUT cuando
    // status pasa a 'cancelled'). Sin esto las mesas quedarían "huérfanas"
    // con eventoId apuntando a un Evento que ya no existe.
    await cancelAssociatedTables(req, evento._id);

    await evento.deleteOne();

    // Notificar a los viewers del detalle (cierran su pantalla) y a la lista.
    emitToEventoRoom(req, deletedId, "evento:deleted", { eventoId: deletedId });
    emitToEventosList(req, "evento:deleted", { eventoId: deletedId });

    res.json({ message: "Evento eliminado" });
  } catch (err) {
    console.error("DELETE /api/eventos/:id:", err.message);
    res.status(500).json({ message: "Error al eliminar el evento" });
  }
});

// POST /api/eventos/:id/inscribirse — auth required, multipart (comprobante opcional si fee=0)
router.post(
  "/:id/inscribirse",
  protect,
  comprobanteUpload.single("comprobante"),
  async (req, res) => {
    try {
      const evento = await Evento.findById(req.params.id);
      if (!evento)
        return res.status(404).json({ message: "Evento no encontrado" });
      if (evento.status !== "open")
        return res
          .status(400)
          .json({ message: "Las inscripciones están cerradas" });

      const existing = evento.registrations.find(
        (r) => r.user.toString() === req.user._id.toString(),
      );
      // Bloqueo permanente: 403, no permite reintentar.
      if (existing?.permanentlyRejected) {
        return res.status(403).json({
          message:
            "Fuiste rechazado de este evento y no podés volver a inscribirte.",
        });
      }
      // Ya inscripto (pending / confirmed): bloquear.
      if (existing && existing.status !== "rejected") {
        return res
          .status(400)
          .json({ message: "Ya estás inscripto en este evento" });
      }
      // Rechazado pero NO permanente: el flujo más abajo recicla el registro existente.

      if (evento.maxParticipants) {
        const confirmed = evento.registrations.filter(
          (r) => r.status === "confirmed",
        ).length;
        if (confirmed >= evento.maxParticipants) {
          return res
            .status(400)
            .json({ message: "El evento ya alcanzó el cupo máximo" });
        }
      }

      // Comprobante required for paid events
      if (evento.fee > 0 && !req.file) {
        return res
          .status(400)
          .json({ message: "Debés adjuntar el comprobante de transferencia" });
      }

      let comprobante;
      if (req.file) {
        const isPdf = req.file.mimetype === "application/pdf";
        const resourceType = isPdf ? "raw" : "image";
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: `turnocero/eventos/${req.params.id}/comprobantes`,
          resource_type: resourceType,
        });
        comprobante = {
          url: result.secure_url,
          publicId: result.public_id,
          resourceType,
          uploadedAt: new Date(),
        };
      }

      let reg;
      let workingEvento = evento;
      if (existing && existing.status === "rejected") {
        // Reciclar el registro rechazado no-permanente: vuelve a pendiente con nuevo comprobante.
        // Si el comprobante anterior estaba en Cloudinary, lo limpiamos.
        if (existing.comprobante?.publicId) {
          try {
            await cloudinary.uploader.destroy(existing.comprobante.publicId, {
              resource_type: existing.comprobante.resourceType || "image",
            });
          } catch {
            // no-op, no bloqueamos el reintento por una falla de cleanup
          }
        }
        existing.status = "pending";
        existing.submittedAt = new Date();
        existing.reviewedAt = undefined;
        existing.reviewedBy = undefined;
        existing.adminNotes = undefined;
        existing.comprobante = comprobante;
        reg = existing;
        await evento.save();
      } else {
        // Inscripción nueva: usamos findOneAndUpdate atómico para evitar la
        // race en la que dos requests paralelos pasan el check "ya inscripto"
        // y terminan creando dos entries para el mismo user. El filter
        // `'registrations.user': { $ne }` garantiza que solo el primero
        // matchee; los siguientes reciben null y devolvemos 409.
        const newReg = {
          user: req.user._id,
          status: "pending",
          comprobante,
          submittedAt: new Date(),
        };
        workingEvento = await Evento.findOneAndUpdate(
          {
            _id: req.params.id,
            status: "open",
            "registrations.user": { $ne: req.user._id },
          },
          { $push: { registrations: newReg } },
          { new: true },
        );
        if (!workingEvento) {
          // Race detectada (o el evento pasó a non-open mientras subíamos el
          // comprobante). Limpiamos el asset recién subido para no dejar huérfanos.
          if (comprobante?.publicId) {
            cloudinary.uploader
              .destroy(comprobante.publicId, {
                resource_type: comprobante.resourceType || "image",
              })
              .catch(() => {});
          }
          return res.status(409).json({
            message: "Ya estás inscripto en este evento",
          });
        }
        // Tomamos la entry recién pusheada (la última del array).
        reg =
          workingEvento.registrations[workingEvento.registrations.length - 1];
      }

      // Notificar al host que tiene una nueva inscripción pendiente, y a todos
      // los que estén viendo el evento que cambiaron los counts. Usamos
      // workingEvento (que es `evento` en el path recycle, o el resultado de
      // findOneAndUpdate en el path nueva inscripción).
      const newCounts = countsFor(workingEvento);
      const eventoIdStr = workingEvento._id.toString();
      try {
        const populated = await Evento.populate(workingEvento, {
          path: "registrations.user",
          select: "username displayName avatar",
        });
        const populatedReg = populated.registrations.id(reg._id);
        emitToUser(req, workingEvento.author, "evento:registration-created", {
          eventoId: eventoIdStr,
          registration: populatedReg ? populatedReg.toObject() : reg.toObject(),
          counts: newCounts,
        });
      } catch {
        /* no-op */
      }
      const countsPayload = { eventoId: eventoIdStr, counts: newCounts };
      emitToEventoRoom(
        req,
        workingEvento._id,
        "evento:counts-changed",
        countsPayload,
      );
      if (workingEvento.status !== "draft")
        emitToEventosList(req, "evento:counts-changed", countsPayload);

      res.status(201).json({
        _id: reg._id,
        status: reg.status,
        submittedAt: reg.submittedAt,
        comprobante: reg.comprobante
          ? {
              url: reg.comprobante.url,
              resourceType: reg.comprobante.resourceType,
            }
          : null,
      });
    } catch (err) {
      console.error("POST /api/eventos/:id/inscribirse:", err.message);
      res.status(500).json({ message: "Error al procesar la inscripción" });
    }
  },
);

// DELETE /api/eventos/:id/inscribirse — cancel own pending registration
router.delete("/:id/inscribirse", protect, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento)
      return res.status(404).json({ message: "Evento no encontrado" });

    const idx = evento.registrations.findIndex(
      (r) => r.user.toString() === req.user._id.toString(),
    );
    if (idx === -1)
      return res
        .status(404)
        .json({ message: "No estás inscripto en este evento" });
    if (evento.registrations[idx].status !== "pending") {
      return res
        .status(400)
        .json({ message: "Solo podés cancelar inscripciones pendientes" });
    }

    const reg = evento.registrations[idx];
    if (reg.comprobante?.publicId) {
      await cloudinary.uploader
        .destroy(reg.comprobante.publicId, {
          resource_type: reg.comprobante.resourceType || "image",
        })
        .catch(() => {});
    }

    const removedRegId = reg._id?.toString();
    const removedUserId = req.user._id.toString();
    evento.registrations.splice(idx, 1);
    await evento.save();

    const newCounts = countsFor(evento);
    const eventoIdStr = evento._id.toString();
    emitToUser(req, evento.author, "evento:registration-cancelled", {
      eventoId: eventoIdStr,
      registrationId: removedRegId,
      userId: removedUserId,
      counts: newCounts,
    });
    const cancelCountsPayload = { eventoId: eventoIdStr, counts: newCounts };
    emitToEventoRoom(
      req,
      evento._id,
      "evento:counts-changed",
      cancelCountsPayload,
    );
    if (evento.status !== "draft")
      emitToEventosList(req, "evento:counts-changed", cancelCountsPayload);

    res.json({ message: "Inscripción cancelada" });
  } catch (err) {
    console.error("DELETE /api/eventos/:id/inscribirse:", err.message);
    res.status(500).json({ message: "Error al cancelar la inscripción" });
  }
});

// GET /api/eventos/:id/inscripciones — admin only
router.get("/:id/inscripciones", protect, requireAdmin, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id).populate(
      "registrations.user",
      "username displayName avatar email",
    );
    if (!evento)
      return res.status(404).json({ message: "Evento no encontrado" });

    let registrations = evento.registrations.toObject
      ? evento.registrations.toObject()
      : [...evento.registrations];
    const statusFilter = req.query.status;
    if (
      statusFilter &&
      ["pending", "confirmed", "rejected"].includes(statusFilter)
    ) {
      registrations = registrations.filter((r) => r.status === statusFilter);
    }

    res.json({
      evento: {
        _id: evento._id,
        title: evento.title,
        status: evento.status,
        eventDate: evento.eventDate,
        maxParticipants: evento.maxParticipants,
      },
      registrations,
      counts: {
        total: evento.registrations.length,
        pending: evento.registrations.filter((r) => r.status === "pending")
          .length,
        confirmed: evento.registrations.filter((r) => r.status === "confirmed")
          .length,
        rejected: evento.registrations.filter((r) => r.status === "rejected")
          .length,
      },
    });
  } catch (err) {
    console.error("GET /api/eventos/:id/inscripciones:", err.message);
    res.status(500).json({ message: "Error al obtener inscripciones" });
  }
});

// PATCH /api/eventos/:id/inscripciones/:userId/confirmar — admin only
router.patch(
  "/:id/inscripciones/:userId/confirmar",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const evento = await Evento.findById(req.params.id);
      if (!evento)
        return res.status(404).json({ message: "Evento no encontrado" });

      const reg = evento.registrations.find(
        (r) => r.user.toString() === req.params.userId,
      );
      if (!reg)
        return res.status(404).json({ message: "Inscripción no encontrada" });

      // Cap check: si la registración aún no está confirmada, confirmarla
      // suma un slot al total confirmado. Re-confirmar una ya confirmada es
      // idempotente y no consume cupo, así que se permite siempre.
      if (evento.maxParticipants && reg.status !== "confirmed") {
        const confirmedCount = evento.registrations.filter(
          (r) => r.status === "confirmed",
        ).length;
        if (confirmedCount >= evento.maxParticipants) {
          return res.status(400).json({
            message: "El evento ya alcanzó el cupo máximo de confirmados",
          });
        }
      }

      reg.status = "confirmed";
      reg.reviewedAt = new Date();
      reg.reviewedBy = req.user._id;
      reg.permanentlyRejected = false; // limpiar el bloqueo si lo había
      if (req.body.adminNotes?.trim())
        reg.adminNotes = req.body.adminNotes.trim();

      await evento.save();

      const newCounts = countsFor(evento);
      const eventoIdStr = evento._id.toString();
      const userIdStr = reg.user.toString();
      const populatedReg = await reloadRegPopulated(evento, reg._id);
      const reviewPayload = {
        eventoId: eventoIdStr,
        userId: userIdStr,
        registrationId: reg._id.toString(),
        status: "confirmed",
        reviewedAt: reg.reviewedAt,
        adminNotes: reg.adminNotes || null,
        permanentlyRejected: false,
        counts: newCounts,
        registration: populatedReg,
      };
      emitToUser(req, userIdStr, "evento:registration-reviewed", reviewPayload);
      emitToEventoRoom(
        req,
        evento._id,
        "evento:registration-reviewed",
        reviewPayload,
      );
      // La lista sólo necesita refrescar los counts.
      if (evento.status !== "draft") {
        emitToEventosList(req, "evento:counts-changed", {
          eventoId: eventoIdStr,
          counts: newCounts,
        });
      }

      // Persistente + toast: el user inscripto recibe la notificación de que
      // lo aceptaron, incluso si no tiene la app abierta en ese momento.
      await notifyOne(
        req,
        reg.user,
        "evento_confirmed",
        {
          eventoId: eventoIdStr,
          eventoTitle: evento.title,
          eventoDate: evento.eventDate,
        },
        req.user._id,
      );

      res.json({ message: "Inscripción confirmada", status: reg.status });
    } catch (err) {
      console.error(
        "PATCH /api/eventos/:id/inscripciones/:userId/confirmar:",
        err.message,
      );
      res.status(500).json({ message: "Error al confirmar la inscripción" });
    }
  },
);

// PATCH /api/eventos/:id/inscripciones/:userId/rechazar — admin only
router.patch(
  "/:id/inscripciones/:userId/rechazar",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const evento = await Evento.findById(req.params.id);
      if (!evento)
        return res.status(404).json({ message: "Evento no encontrado" });

      const reg = evento.registrations.find(
        (r) => r.user.toString() === req.params.userId,
      );
      if (!reg)
        return res.status(404).json({ message: "Inscripción no encontrada" });

      reg.status = "rejected";
      reg.reviewedAt = new Date();
      reg.reviewedBy = req.user._id;
      // Estricto: solo boolean `true`. El cliente manda JSON (no FormData
      // string), así que la coerción de "true" → true que existía antes era
      // defensa innecesaria contra clients que no respetan el contrato.
      reg.permanentlyRejected = req.body.permanent === true;
      if (req.body.adminNotes?.trim())
        reg.adminNotes = req.body.adminNotes.trim();

      // Rechazo permanente: limpiar el comprobante en Cloudinary. El user
      // no podrá reintentar (403), así que el path de "reciclar" — que es
      // el único otro lugar donde se destruía el comprobante viejo — nunca
      // se ejecuta y el archivo queda como orphan permanente. Best-effort:
      // si Cloudinary falla, el reject ya quedó persistido y solo loggeamos.
      if (reg.permanentlyRejected && reg.comprobante?.publicId) {
        const stalePublicId = reg.comprobante.publicId;
        const staleResourceType = reg.comprobante.resourceType || "image";
        try {
          await cloudinary.uploader.destroy(stalePublicId, {
            resource_type: staleResourceType,
          });
        } catch (cleanupErr) {
          console.error(
            "Cloudinary destroy falló para comprobante rechazado permanentemente:",
            stalePublicId,
            cleanupErr.message,
          );
        }
        reg.comprobante = undefined;
      }

      await evento.save();

      const newCounts = countsFor(evento);
      const eventoIdStr = evento._id.toString();
      const userIdStr = reg.user.toString();
      const populatedReg = await reloadRegPopulated(evento, reg._id);
      const reviewPayload = {
        eventoId: eventoIdStr,
        userId: userIdStr,
        registrationId: reg._id.toString(),
        status: "rejected",
        reviewedAt: reg.reviewedAt,
        adminNotes: reg.adminNotes || null,
        permanentlyRejected: reg.permanentlyRejected,
        counts: newCounts,
        registration: populatedReg,
      };
      emitToUser(req, userIdStr, "evento:registration-reviewed", reviewPayload);
      emitToEventoRoom(
        req,
        evento._id,
        "evento:registration-reviewed",
        reviewPayload,
      );
      if (evento.status !== "draft") {
        emitToEventosList(req, "evento:counts-changed", {
          eventoId: eventoIdStr,
          counts: newCounts,
        });
      }

      // Persistente + toast: el user inscripto recibe la notificación del
      // rechazo. La flag `permanentlyRejected` distingue "esta vez" vs bloqueo
      // permanente y la UI puede renderizar tonos distintos.
      await notifyOne(
        req,
        reg.user,
        "evento_rejected",
        {
          eventoId: eventoIdStr,
          eventoTitle: evento.title,
          eventoDate: evento.eventDate,
          permanentlyRejected: reg.permanentlyRejected,
        },
        req.user._id,
      );

      res.json({
        message: "Inscripción rechazada",
        status: reg.status,
        permanentlyRejected: reg.permanentlyRejected,
      });
    } catch (err) {
      console.error(
        "PATCH /api/eventos/:id/inscripciones/:userId/rechazar:",
        err.message,
      );
      res.status(500).json({ message: "Error al rechazar la inscripción" });
    }
  },
);

// PATCH /api/eventos/:id/inscripciones/:userId/revertir — admin only
// Vuelve un registro confirmed/rejected a 'pending' como si el usuario recién
// se hubiera inscripto: limpia adminNotes / reviewedAt / reviewedBy /
// permanentlyRejected y resetea submittedAt. El comprobante se mantiene.
router.patch(
  "/:id/inscripciones/:userId/revertir",
  protect,
  requireAdmin,
  async (req, res) => {
    try {
      const evento = await Evento.findById(req.params.id);
      if (!evento)
        return res.status(404).json({ message: "Evento no encontrado" });

      const reg = evento.registrations.find(
        (r) => r.user.toString() === req.params.userId,
      );
      if (!reg)
        return res.status(404).json({ message: "Inscripción no encontrada" });

      reg.status = "pending";
      reg.submittedAt = new Date();
      reg.reviewedAt = undefined;
      reg.reviewedBy = undefined;
      reg.adminNotes = undefined;
      reg.permanentlyRejected = false;

      await evento.save();

      const newCounts = countsFor(evento);
      const eventoIdStr = evento._id.toString();
      const userIdStr = reg.user.toString();
      const populatedReg = await reloadRegPopulated(evento, reg._id);
      const reviewPayload = {
        eventoId: eventoIdStr,
        userId: userIdStr,
        registrationId: reg._id.toString(),
        status: "pending",
        reviewedAt: null,
        adminNotes: null,
        permanentlyRejected: false,
        submittedAt: reg.submittedAt,
        counts: newCounts,
        registration: populatedReg,
      };
      emitToUser(req, userIdStr, "evento:registration-reviewed", reviewPayload);
      emitToEventoRoom(
        req,
        evento._id,
        "evento:registration-reviewed",
        reviewPayload,
      );
      if (evento.status !== "draft") {
        emitToEventosList(req, "evento:counts-changed", {
          eventoId: eventoIdStr,
          counts: newCounts,
        });
      }

      res.json({
        message: "Inscripción revertida a pendiente",
        status: reg.status,
        submittedAt: reg.submittedAt,
      });
    } catch (err) {
      console.error(
        "PATCH /api/eventos/:id/inscripciones/:userId/revertir:",
        err.message,
      );
      res.status(500).json({ message: "Error al revertir la inscripción" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────
// Ludoteca del Evento
// Cada user (confirmed registrant + admin del evento + admin del sitio)
// puede agregar juegos. La metadata BGG (name, thumbnail, year, players)
// se hidrata server-side via resolveGame() — el cliente solo manda
// `bggGameId` + `notes` opcional.
// ─────────────────────────────────────────────────────────────────────

const POPULATE_LUDOTECA_USER = "username displayName avatar";

// GET /:id/ludoteca — público (visible para cualquiera que pueda ver el evento)
router.get("/:id/ludoteca", optionalAuth, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id)
      .select("status author ludoteca")
      .populate("ludoteca.addedBy", POPULATE_LUDOTECA_USER);
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    // Drafts/cancelled solo visibles a admins (consistente con GET /:id).
    const isAdmin = !!req.user?.isAdmin;
    if (
      (evento.status === "draft" || evento.status === "cancelled") &&
      !isAdmin
    ) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    res.json({ items: evento.ludoteca || [] });
  } catch (err) {
    res.status(500).json({ message: "Error al cargar la ludoteca" });
  }
});

// POST /:id/ludoteca — agregar juego (confirmados + admin)
router.post("/:id/ludoteca", protect, async (req, res) => {
  try {
    const { bggGameId, notes } = req.body;
    const numericId = Number(bggGameId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return res.status(400).json({ message: "bggGameId inválido" });
    }
    if (notes && typeof notes === "string" && notes.length > 200) {
      return res
        .status(400)
        .json({ message: "Las notas no pueden superar 200 caracteres" });
    }

    const evento = await Evento.findById(req.params.id).select(
      "status author registrations ludoteca title",
    );
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    if (evento.status === "cancelled") {
      return res.status(400).json({ message: "El evento está cancelado" });
    }
    if (!canActInEvento(evento, req.user)) {
      return res
        .status(403)
        .json({ message: "Solo inscriptos confirmados pueden agregar juegos" });
    }

    // Dedupe lógico por (addedBy, bggGameId) — un user no agrega el mismo juego dos veces.
    const myId = req.user._id.toString();
    const alreadyMine = (evento.ludoteca || []).some(
      (item) =>
        item.bggGameId === numericId && item.addedBy.toString() === myId,
    );
    if (alreadyMine) {
      return res.status(409).json({ message: "Ya agregaste este juego" });
    }

    // Hidratar metadata desde BGG (cache 30min memoria + Mongo permanente).
    const game = await resolveGame(numericId);
    if (!game) {
      return res
        .status(404)
        .json({ message: "Juego no encontrado en BoardGameGeek" });
    }

    evento.ludoteca.push({
      bggGameId: numericId,
      gameName: game.name,
      thumbnail: game.thumbnail || "",
      image: game.image || "",
      year: game.year ?? null,
      minPlayers: game.minPlayers ?? null,
      maxPlayers: game.maxPlayers ?? null,
      addedBy: req.user._id,
      addedAt: new Date(),
      notes: (notes || "").trim(),
    });
    await evento.save();

    // Devolvemos el item con addedBy populated para que el cliente lo renderice.
    await evento.populate("ludoteca.addedBy", POPULATE_LUDOTECA_USER);
    const newItem = evento.ludoteca[evento.ludoteca.length - 1];

    // Broadcast al room del evento para que las pestañas abiertas refresquen.
    emitToEventoRoom(req, evento._id, "evento:ludoteca-changed", {
      eventoId: evento._id.toString(),
      action: "added",
      item: newItem,
    });

    // Notificación persistente a todos los confirmados excepto al actor.
    const actorId = req.user._id.toString();
    const recipients = (evento.registrations || [])
      .filter((r) => r.status === "confirmed")
      .map((r) => r.user.toString())
      .filter((id) => id !== actorId);
    await Promise.all(
      recipients.map((userId) =>
        emitNotificationReq(
          req,
          userId,
          "evento_ludoteca_added",
          {
            eventoId: evento._id.toString(),
            eventoTitle: evento.title,
            gameName: game.name,
            addedByUsername: req.user.username,
          },
          "evento:notification",
          { type: "evento_ludoteca_added" },
        ).catch(() => {}),
      ),
    );

    res.status(201).json({ item: newItem });
  } catch (err) {
    console.error("POST /api/eventos/:id/ludoteca:", err.message);
    res.status(500).json({ message: "Error al agregar el juego" });
  }
});

// PATCH /:id/ludoteca/:itemId — editar notas (owner o admin)
router.patch("/:id/ludoteca/:itemId", protect, async (req, res) => {
  try {
    const { notes } = req.body;
    if (notes != null && typeof notes !== "string") {
      return res.status(400).json({ message: "notes debe ser string" });
    }
    if (notes && notes.length > 200) {
      return res
        .status(400)
        .json({ message: "Las notas no pueden superar 200 caracteres" });
    }

    const evento = await Evento.findById(req.params.id).select(
      "ludoteca status author",
    );
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    const item = evento.ludoteca.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Juego no encontrado" });
    }
    const isOwner = item.addedBy.toString() === req.user._id.toString();
    const isAdmin =
      !!req.user.isAdmin ||
      evento.author.toString() === req.user._id.toString();
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "No podés editar este juego" });
    }

    item.notes = (notes || "").trim();
    await evento.save();

    await evento.populate("ludoteca.addedBy", POPULATE_LUDOTECA_USER);
    const updated = evento.ludoteca.id(req.params.itemId);

    emitToEventoRoom(req, evento._id, "evento:ludoteca-changed", {
      eventoId: evento._id.toString(),
      action: "updated",
      item: updated,
    });

    res.json({ item: updated });
  } catch (err) {
    console.error("PATCH /api/eventos/:id/ludoteca/:itemId:", err.message);
    res.status(500).json({ message: "Error al editar el juego" });
  }
});

// DELETE /:id/ludoteca/:itemId — quitar juego (owner o admin)
router.delete("/:id/ludoteca/:itemId", protect, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id).select(
      "ludoteca author",
    );
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    const item = evento.ludoteca.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Juego no encontrado" });
    }
    const isOwner = item.addedBy.toString() === req.user._id.toString();
    const isAdmin =
      !!req.user.isAdmin ||
      evento.author.toString() === req.user._id.toString();
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "No podés quitar este juego" });
    }

    const itemId = item._id.toString();
    item.deleteOne();
    await evento.save();

    emitToEventoRoom(req, evento._id, "evento:ludoteca-changed", {
      eventoId: evento._id.toString(),
      action: "removed",
      itemId,
    });

    res.json({ removed: itemId });
  } catch (err) {
    console.error("DELETE /api/eventos/:id/ludoteca/:itemId:", err.message);
    res.status(500).json({ message: "Error al quitar el juego" });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Mesas del Evento
// Listado de mesas asociadas al evento. Reusa el pipeline del listado
// global (`listTables` exportado por routes/tables.js) — paginación,
// search, distance, privacy gating funcionan idéntico. Cambia solo el
// filtro: en vez de `eventoId:null` se filtra por el id del evento.
// ─────────────────────────────────────────────────────────────────────
router.get("/:id/mesas", optionalAuth, async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id).select("status");
    if (!evento) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    const isAdmin = !!req.user?.isAdmin;
    if (
      (evento.status === "draft" || evento.status === "cancelled") &&
      !isAdmin
    ) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }
    const result = await listTables({
      user: req.user,
      query: req.query,
      eventoId: req.params.id,
    });
    res.json(result);
  } catch (err) {
    console.error("GET /api/eventos/:id/mesas:", err.message);
    res.status(500).json({ message: "Error al cargar las mesas del evento" });
  }
});

module.exports = router;
