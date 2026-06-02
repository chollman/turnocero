// Servicio de agregación del Calendario unificado.
//
// Combina las tres entidades con fecha del sistema — mesas (Table.date),
// eventos (Evento.eventDate) y torneos (Torneo.fecha, opcional) — en una
// lista normalizada de items para renderizar en una grilla mensual o agenda.
//
// Es SOLO LECTURA: no muta nada, no emite notifs. Reutiliza los mismos
// filtros de privacidad y visibilidad que las secciones originales para que
// el calendario nunca exponga algo que el usuario no vería en su sección.
//
//   - Mesas:   buildPrivacyFilter (utils/tablePrivacy) en scope "todas".
//   - Eventos: drafts ocultos a no-admin; cancelados siempre excluidos.
//   - Torneos: visibleStatusFilter (drafts ocultos a no-admin); solo los que
//              tienen `fecha` cargada.
//
// Cada tipo se omite si su sección está deshabilitada en SiteConfig (salvo
// admin, que ve secciones deshabilitadas como en el resto de la app).

const Table = require("../models/Table");
const Evento = require("../models/Evento");
const Torneo = require("../models/Torneo");
const { buildPrivacyFilter } = require("../utils/tablePrivacy");
const { isSectionEnabled } = require("../utils/siteConfig");

const USER_FIELDS = "username displayName avatar";

const ALL_TIPOS = ["mesa", "evento", "torneo"];

// Un tipo entra al calendario si su sección está habilitada, o si el que
// consulta es admin (los admins ven secciones deshabilitadas).
function tipoVisible(section, isAdmin) {
  return isSectionEnabled(section) || !!isAdmin;
}

async function fetchMesas({ user, friendIds, from, to, scope, communityScope }) {
  const base = {
    date: { $gte: from, $lte: to },
    status: { $ne: "cancelled" },
    ...communityScope,
  };
  let scopeFilter;
  if (scope === "mias") {
    if (!user) return [];
    scopeFilter = { $or: [{ host: user._id }, { players: user._id }] };
  } else {
    scopeFilter = buildPrivacyFilter(user, friendIds);
  }
  const mesas = await Table.find({ ...base, ...scopeFilter })
    .populate("host", USER_FIELDS)
    .select("boardGame date status location host")
    .sort({ date: 1 })
    .lean();
  return mesas.map((m) => ({
    id: String(m._id),
    tipo: "mesa",
    title: m.boardGame,
    subtitle: m.location?.texto || "",
    date: m.date,
    status: m.status,
    url: `/mesas/${m._id}`,
    host: m.host || null,
  }));
}

async function fetchEventos({ user, from, to, scope, isAdmin, communityScope }) {
  const base = { eventDate: { $gte: from, $lte: to }, ...communityScope };
  let statusFilter;
  let scopeFilter = {};
  if (scope === "mias") {
    if (!user) return [];
    scopeFilter = {
      $or: [
        { author: user._id },
        {
          registrations: {
            $elemMatch: {
              user: user._id,
              status: { $in: ["confirmed", "pending"] },
            },
          },
        },
      ],
    };
    statusFilter = { status: { $in: ["open", "closed"] } };
  } else {
    // Cancelados siempre fuera; drafts solo visibles para admin.
    statusFilter = isAdmin
      ? { status: { $in: ["draft", "open", "closed"] } }
      : { status: { $in: ["open", "closed"] } };
  }
  const eventos = await Evento.find({
    ...base,
    ...statusFilter,
    ...scopeFilter,
  })
    .populate("author", USER_FIELDS)
    .select("title eventDate status location author")
    .sort({ eventDate: 1 })
    .lean();
  return eventos.map((e) => ({
    id: String(e._id),
    tipo: "evento",
    title: e.title,
    subtitle: e.location?.displayName || e.location?.texto || "",
    date: e.eventDate,
    status: e.status,
    url: `/eventos/${e._id}`,
    host: e.author || null,
  }));
}

async function fetchTorneos({ user, from, to, scope, isAdmin, communityScope }) {
  const base = { fecha: { $ne: null, $gte: from, $lte: to }, ...communityScope };
  let scopeFilter;
  if (scope === "mias") {
    if (!user) return [];
    scopeFilter = { participants: user._id, status: { $ne: "draft" } };
  } else {
    scopeFilter = isAdmin ? {} : { status: { $ne: "draft" } };
  }
  const torneos = await Torneo.find({ ...base, ...scopeFilter })
    .populate("createdBy", USER_FIELDS)
    .select("title game fecha status createdBy")
    .sort({ fecha: 1 })
    .lean();
  return torneos.map((t) => ({
    id: String(t._id),
    tipo: "torneo",
    title: t.title,
    subtitle: t.game || "",
    date: t.fecha,
    status: t.status,
    url: `/torneos/${t._id}`,
    host: t.createdBy || null,
  }));
}

// Punto de entrada. Devuelve { items } ordenados por fecha ascendente.
async function getCalendarItems({
  user = null,
  friendIds = [],
  from,
  to,
  scope = "todas",
  tipos = ALL_TIPOS,
  isAdmin = false,
  viewingCommunities = [],
}) {
  const wanted = new Set(
    (Array.isArray(tipos) ? tipos : ALL_TIPOS).filter((t) =>
      ALL_TIPOS.includes(t),
    ),
  );

  // Scoping por comunidad. Condicional: si no se pasan comunidades (ej. tests
  // que llaman al service directo), no se scopea. La ruta siempre pasa ≥1 (el
  // invariante never-empty garantiza al menos la base).
  const communityScope = viewingCommunities.length
    ? { community: { $in: viewingCommunities } }
    : {};

  const tasks = [];
  if (wanted.has("mesa") && tipoVisible("mesas", isAdmin)) {
    tasks.push(fetchMesas({ user, friendIds, from, to, scope, communityScope }));
  }
  if (wanted.has("evento") && tipoVisible("eventos", isAdmin)) {
    tasks.push(fetchEventos({ user, from, to, scope, isAdmin, communityScope }));
  }
  if (wanted.has("torneo") && tipoVisible("torneos", isAdmin)) {
    tasks.push(fetchTorneos({ user, from, to, scope, isAdmin, communityScope }));
  }

  const results = await Promise.all(tasks);
  const items = results
    .flat()
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return { items };
}

module.exports = { getCalendarItems, ALL_TIPOS };
