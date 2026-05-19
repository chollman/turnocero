const mongoose = require('mongoose');
const BggGame = require('../../../models/BggGame');

describe('BggGame model', () => {
  it('persists all the expected fields', async () => {
    const doc = await BggGame.create({
      gameId: 13,
      name: 'Catan',
      image: 'https://img/full.jpg',
      thumbnail: 'https://img/thumb.jpg',
      yearPublished: 1995,
      minPlayers: 3,
      maxPlayers: 4,
    });
    expect(doc.gameId).toBe(13);
    expect(doc.name).toBe('Catan');
    expect(doc.thumbnail).toBe('https://img/thumb.jpg');
    expect(doc.yearPublished).toBe(1995);
    expect(doc.minPlayers).toBe(3);
    expect(doc.maxPlayers).toBe(4);
    expect(doc.lastFetchedAt).toBeInstanceOf(Date);
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it('defaults lastFetchedAt to now when not provided', async () => {
    const before = Date.now();
    const doc = await BggGame.create({ gameId: 42, name: 'X' });
    const after = Date.now();
    expect(doc.lastFetchedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(doc.lastFetchedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('enforces uniqueness on gameId', async () => {
    await BggGame.create({ gameId: 100, name: 'A' });
    await BggGame.init(); // make sure the unique index is built
    let err;
    try {
      await BggGame.create({ gameId: 100, name: 'B' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000); // duplicate key
  });

  it('requires gameId', async () => {
    let err;
    try {
      await BggGame.create({ name: 'No id' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
  });
});
