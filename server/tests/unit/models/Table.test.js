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
