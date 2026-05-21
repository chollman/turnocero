const Table = require('../../models/Table');
const Compartida = require('../../models/Compartida');
const Noticia = require('../../models/Noticia');
const Torneo = require('../../models/Torneo');
const Evento = require('../../models/Evento');

// Acepta location como string legacy (la convertimos al subdoc nuevo) o
// como objeto { texto, lat, lng }. Sin esto, tests que pasan strings caen
// silenciosamente al subdoc vacío porque Mongoose no castea string → subdoc.
function normalizeLocationForFactory(loc) {
  if (loc == null) return undefined;
  if (typeof loc === 'string') return { texto: loc, lat: null, lng: null };
  return loc;
}

async function createTable(host, overrides = {}) {
  const { location: locOverride, ...rest } = overrides;
  return Table.create({
    host: host._id,
    boardGame: 'Catán',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // a week away
    location: normalizeLocationForFactory(locOverride) ?? { texto: 'Buenos Aires', lat: null, lng: null },
    maxPlayers: 4,
    privacy: 'public',
    notes: '',
    players: [],
    ...rest,
  });
}

async function createCompartida(author, overrides = {}) {
  return Compartida.create({
    author: author._id,
    title: overrides.title || '',
    body: overrides.body || 'Test post',
    privacy: overrides.privacy || 'public',
    images: overrides.images || [],
    linkedTable: overrides.linkedTable || undefined,
  });
}

async function createNoticia(author, overrides = {}) {
  return Noticia.create({
    author: author._id,
    title: overrides.title || 'Test news',
    body: overrides.body || 'Body of the news.',
    link: overrides.link || '',
    linkLabel: overrides.linkLabel || '',
    image: overrides.image,
  });
}

async function createTorneo(createdBy, overrides = {}) {
  return Torneo.create({
    title: overrides.title || 'Test Tournament',
    description: overrides.description || '',
    game: overrides.game || 'Catán',
    format: overrides.format || 'league',
    status: overrides.status || 'draft',
    inscriptionMode: overrides.inscriptionMode || 'open',
    maxParticipants: overrides.maxParticipants ?? 8,
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
  const { location: locOverride, ...rest } = overrides;
  return Evento.create({
    author: author._id,
    title: 'Test Event',
    description: '',
    conditions: '',
    fee: 0,
    transferDetails: '',
    eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    location: normalizeLocationForFactory(locOverride) ?? { texto: 'Buenos Aires', lat: null, lng: null },
    maxParticipants: 20,
    status: 'open',
    registrations: [],
    ...rest,
  });
}

module.exports = {
  createTable,
  createCompartida,
  createNoticia,
  createTorneo,
  createEvento,
};
