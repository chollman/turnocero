const Table = require("../../models/Table");
const Compartida = require("../../models/Compartida");
const Noticia = require("../../models/Noticia");
const Torneo = require("../../models/Torneo");
const Evento = require("../../models/Evento");
const Community = require("../../models/Community");

// Acepta location como string legacy (la convertimos al subdoc nuevo) o
// como objeto { texto, lat, lng }. Sin esto, tests que pasan strings caen
// silenciosamente al subdoc vacío porque Mongoose no castea string → subdoc.
function normalizeLocationForFactory(loc) {
  if (loc == null) return undefined;
  if (typeof loc === "string") return { texto: loc, lat: null, lng: null };
  return loc;
}

// Comunidad por defecto para el contenido de los tests = la base. Sin esto, el
// read-scoping (Fase 1) filtraría todo el contenido de factory (community null).
// Un test puede pasar `community` en overrides para scopear a otra comunidad.
async function defaultCommunity(override) {
  if (override) return override;
  return (await Community.getBase())._id;
}

async function createTable(host, overrides = {}) {
  const { location: locOverride, community, ...rest } = overrides;
  return Table.create({
    host: host._id,
    community: await defaultCommunity(community),
    boardGame: "Catán",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // a week away
    location: normalizeLocationForFactory(locOverride) ?? {
      texto: "Buenos Aires",
      lat: null,
      lng: null,
    },
    maxPlayers: 4,
    privacy: "public",
    notes: "",
    players: [],
    ...rest,
  });
}

async function createCompartida(author, overrides = {}) {
  return Compartida.create({
    author: author._id,
    community: await defaultCommunity(overrides.community),
    category: overrides.category || "juntada",
    title: overrides.title || "",
    body: overrides.body || "Test post",
    boardGame: overrides.boardGame || null,
    boardGames: overrides.boardGames || [],
    rating: overrides.rating ?? null,
    privacy: overrides.privacy || "public",
    images: overrides.images || [],
    linkedTable: overrides.linkedTable || undefined,
    likes: overrides.likes || [],
  });
}

// Reseña válida (juego + rating obligatorios). El pre('validate') del modelo
// rechaza reseñas sin estos campos, así que esta factory los provee por default.
async function createResena(author, overrides = {}) {
  return Compartida.create({
    author: author._id,
    community: await defaultCommunity(overrides.community),
    category: "resena",
    title: overrides.title || "Mi reseña",
    body: overrides.body || "<p>Excelente juego.</p>",
    boardGame: overrides.boardGame || {
      bggId: 13,
      name: "Catan",
      thumbnail: "",
      image: "",
      year: 1995,
    },
    rating: overrides.rating ?? 8,
    privacy: overrides.privacy || "public",
    images: overrides.images || [],
    likes: overrides.likes || [],
  });
}

async function createNoticia(author, overrides = {}) {
  return Noticia.create({
    author: author._id,
    community: await defaultCommunity(overrides.community),
    title: overrides.title || "Test news",
    body: overrides.body || "Body of the news.",
    link: overrides.link || "",
    linkLabel: overrides.linkLabel || "",
    image: overrides.image,
  });
}

async function createTorneo(createdBy, overrides = {}) {
  return Torneo.create({
    title: overrides.title || "Test Tournament",
    community: await defaultCommunity(overrides.community),
    description: overrides.description || "",
    game: overrides.game || "Catán",
    format: overrides.format || "league",
    status: overrides.status || "draft",
    inscriptionMode: overrides.inscriptionMode || "open",
    maxParticipants: overrides.maxParticipants ?? 8,
    fecha: overrides.fecha ?? null,
    createdBy: createdBy._id,
    participants: overrides.participants || [],
    pendingRegistrations: overrides.pendingRegistrations || [],
    rejectedRegistrations: overrides.rejectedRegistrations || [],
    tableSize: overrides.tableSize,
    gamesPerGroup: overrides.gamesPerGroup,
    qualifiersPerGroup: overrides.qualifiersPerGroup,
    currentPhase: overrides.currentPhase,
  });
}

async function createEvento(author, overrides = {}) {
  const { location: locOverride, community, ...rest } = overrides;
  return Evento.create({
    author: author._id,
    community: await defaultCommunity(community),
    title: "Test Event",
    description: "",
    conditions: "",
    fee: 0,
    transferDetails: "",
    eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    location: normalizeLocationForFactory(locOverride) ?? {
      texto: "Buenos Aires",
      lat: null,
      lng: null,
    },
    maxParticipants: 20,
    status: "open",
    registrations: [],
    ...rest,
  });
}

module.exports = {
  createTable,
  createCompartida,
  createResena,
  createNoticia,
  createTorneo,
  createEvento,
};
