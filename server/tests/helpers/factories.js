const Table = require('../../models/Table');
const Compartida = require('../../models/Compartida');
const Noticia = require('../../models/Noticia');
const Torneo = require('../../models/Torneo');
const Evento = require('../../models/Evento');

async function createTable(host, overrides = {}) {
  return Table.create({
    host: host._id,
    boardGame: overrides.boardGame || 'Catán',
    date: overrides.date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // a week away
    location: overrides.location || 'Buenos Aires',
    maxPlayers: overrides.maxPlayers ?? 4,
    privacy: overrides.privacy || 'public',
    notes: overrides.notes || '',
    players: overrides.players || [],
    ...overrides,
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
  return Evento.create({
    author: author._id,
    title: overrides.title || 'Test Event',
    description: overrides.description || '',
    conditions: overrides.conditions || '',
    fee: overrides.fee ?? 0,
    transferDetails: overrides.transferDetails || '',
    eventDate: overrides.eventDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    location: overrides.location || 'Buenos Aires',
    maxParticipants: overrides.maxParticipants ?? 20,
    status: overrides.status || 'open',
    registrations: overrides.registrations || [],
  });
}

module.exports = {
  createTable,
  createCompartida,
  createNoticia,
  createTorneo,
  createEvento,
};
