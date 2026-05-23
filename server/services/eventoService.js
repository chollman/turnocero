// Business logic de eventos extraída del router. Antes vivían como
// funciones top-level en `routes/eventos.js` (1647 líneas) — difíciles
// de testear sin armar request/response mocks. Acá quedan como funciones
// que reciben `req` cuando necesitan emitir vía socket (porque
// `emitNotificationReq` lo necesita) pero por lo demás son testables
// aisladas con mongodb-memory-server.
//
// Patrón pareado con `services/torneoService.js`.

const Evento = require("../models/Evento");
const Table = require("../models/Table");
const { emitNotificationReq } = require("../utils/emitNotification");
const {
  emitToEventoRoom,
  emitToEventosList,
} = require("../utils/socketHelpers");
const { isSameId } = require("../utils/idCompare");
const logger = require("../utils/logger");

// Snapshot público de inscripciones de un evento. Pura sobre el array
// embebido; el client lo usa para los chips "X/Y inscriptos".
function countsFor(evento) {
  const regs = evento.registrations || [];
  return {
    total: regs.length,
    pending: regs.filter((r) => r.status === "pending").length,
    confirmed: regs.filter((r) => r.status === "confirmed").length,
  };
}

// Notifica a un usuario individual: persiste + socket emit (vía
// emitNotificationReq → contrato unificado con notifId + count absoluto).
// Skip si el recipient es el mismo que el actor (un admin que confirma
// su propia inscripción, por ej., no debería auto-notificarse).
//
// Devuelve una Promise para que el caller pueda awaitearla — si no la
// awaitea, el emit puede ocurrir DESPUÉS de res.json y los tests pierden
// el evento. En prod no afecta correctness; en tests sí.
function notifyOne(req, recipientId, type, fields, actorId) {
  if (recipientId == null) return Promise.resolve();
  if (actorId != null && isSameId(recipientId, actorId)) {
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
    { type },
  ).catch(() => {
    /* best-effort */
  });
}

// Notifica a todos los inscriptos activos (confirmed + pending) de un
// evento, excluyendo al actor si lo provee. Usado en cancel/update del
// evento (admin notifica a sus inscriptos), y en cron de reminders.
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

// Cuando un evento se cancela o elimina, también se cancelan en cascada
// las mesas asociadas (Table.eventoId === el evento). Idempotente: si una
// mesa ya está cancelled, no se toca. Emite `table:cancelled` a cada
// participante (members + followers + host) de cada mesa.
async function cancelAssociatedTables(req, eventoId) {
  const tables = await Table.find({
    eventoId,
    status: { $ne: "cancelled" },
  }).select("_id boardGame host players followers");
  if (tables.length === 0) return;

  await Table.updateMany(
    { _id: { $in: tables.map((t) => t._id) } },
    { $set: { status: "cancelled" } },
  );

  // Notif persistente + emit a cada participante (members + followers, sin
  // host duplicado). Reusa el mismo helper que el handler DELETE
  // /api/tables/:id.
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

// Carga el `user` de una subdoc de registro y devuelve la forma plana
// que esperan los clientes (sin Mongoose overhead). Necesario para que
// la grilla de inscriptos confirmados pueda renderizar avatares + nombres
// sin re-fetch.
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

// Cierra automáticamente los eventos abiertos cuya fecha ya pasó. Se
// llama lazy al inicio de las rutas GET de listado y detalle: el primer
// request después de la fecha "barre" el estado y persiste
// status='closed', para que filtros y cards reflejen la realidad sin
// requerir un cron externo.
//
// Si `req` se provee, además broadcastea `evento:updated` por cada item
// cerrado para que los clientes en /eventos muevan el item de "Abiertos"
// a "Cerrados" sin esperar al próximo refresh.
async function closePastOpenEvents(req) {
  try {
    // Traer docs completos con author populated — necesario porque algunos
    // clientes (los que tienen chip "Cerrados" activo) van a AGREGAR el
    // item a su lista cuando llegue el broadcast, y necesitan
    // title/author/etc. para renderizar la card. Si emitiéramos sólo
    // {_id, status} mostrarían una card vacía.
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
    logger.error("closePastOpenEvents failed", { error: err.message });
  }
}

module.exports = {
  countsFor,
  notifyOne,
  notifyActiveRegistrations,
  cancelAssociatedTables,
  reloadRegPopulated,
  closePastOpenEvents,
};
