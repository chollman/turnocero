const Table = require('../../../models/Table');
const { createUser } = require('../../helpers/auth');

describe('Table model — pre("save") status transitions', () => {
  let host, p1, p2, p3, p4;
  beforeEach(async () => {
    host = await createUser();
    p1 = await createUser();
    p2 = await createUser();
    p3 = await createUser();
    p4 = await createUser();
  });

  it('stays "open" when there are seats left', async () => {
    const t = await Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 4,
      players: [p1._id, p2._id],
    });
    expect(t.status).toBe('open');
  });

  it('flips to "full" when players reach maxPlayers', async () => {
    const t = await Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 4,
      players: [p1._id, p2._id, p3._id, p4._id],
    });
    expect(t.status).toBe('full');
  });

  it('flips back to "open" when a player leaves', async () => {
    const t = await Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 2,
      players: [p1._id, p2._id],
    });
    expect(t.status).toBe('full');
    t.players = [p1._id];
    await t.save();
    expect(t.status).toBe('open');
  });

  it('preserves "cancelled" when players are below max (does not auto-flip to open)', async () => {
    const t = await Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 4,
      players: [p1._id],
    });
    t.status = 'cancelled';
    await t.save();
    expect(t.status).toBe('cancelled');

    // Adding more players (still below max) doesn't revive a cancelled table.
    t.players = [p1._id, p2._id];
    await t.save();
    expect(t.status).toBe('cancelled');
  });

  it('overrides "cancelled" to "full" if the cancelled table somehow reaches max players', () => {
    // The pre-save hook is unconditional on "players >= maxPlayers → full".
    // The route layer is responsible for not adding players to a cancelled table;
    // this test documents the model-level invariant.
    return Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 2,
      players: [p1._id, p2._id],
      status: 'cancelled',
    }).then((t) => {
      // On insert with full players, the hook flips to 'full' regardless of input.
      expect(t.status).toBe('full');
    });
  });

  it('exposes availableSeats as a virtual', async () => {
    const t = await Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 4,
      players: [p1._id],
    });
    expect(t.availableSeats).toBe(3);
  });
});

describe('Table model — location subdocument', () => {
  let host;
  beforeEach(async () => { host = await createUser(); });

  it('persists location as { texto, lat, lng } when created with all fields', async () => {
    const t = await Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 4,
      location: { texto: 'Av. Corrientes 1234, CABA', lat: -34.6037, lng: -58.3816 },
    });
    expect(t.location.texto).toBe('Av. Corrientes 1234, CABA');
    expect(t.location.lat).toBe(-34.6037);
    expect(t.location.lng).toBe(-58.3816);
  });

  it('defaults lat/lng to null when only texto is provided', async () => {
    const t = await Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 4,
      location: { texto: 'Sin coords' },
    });
    expect(t.location.texto).toBe('Sin coords');
    expect(t.location.lat).toBeNull();
    expect(t.location.lng).toBeNull();
  });

  it('normalizes legacy string location into the new subdocument on hydrate', async () => {
    // Simular un doc viejo escribiendo directo a Mongo con el schema viejo (location: String).
    const Mongoose = require('mongoose');
    await Mongoose.connection.collection('tables').insertOne({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 4,
      players: [],
      location: 'Bar La Esquina',  // ← string plano, formato viejo
      description: '',
      status: 'open',
      privacy: 'public',
      reactions: [],
      followers: [],
      pendingRequests: [],
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Leerlo vía Mongoose dispara el pre('init') hook que migra el shape.
    const found = await Table.findOne({ boardGame: 'Catán' });
    expect(found.location.texto).toBe('Bar La Esquina');
    expect(found.location.lat).toBeNull();
    expect(found.location.lng).toBeNull();
  });

  it('accepts an empty string location and treats it as the default subdocument', async () => {
    const t = await Table.create({
      host: host._id,
      boardGame: 'Catán',
      date: new Date(Date.now() + 1e8),
      maxPlayers: 4,
    });
    expect(t.location.texto).toBe('');
    expect(t.location.lat).toBeNull();
    expect(t.location.lng).toBeNull();
  });
});
