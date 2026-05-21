const Evento = require('../../../models/Evento');
const { createUser } = require('../../helpers/auth');

describe('Evento model — location subdocument', () => {
  let author;
  beforeEach(async () => { author = await createUser(); });

  it('persists location as { texto, lat, lng } when created with all fields', async () => {
    const e = await Evento.create({
      author: author._id,
      title: 'Torneo X',
      eventDate: new Date(Date.now() + 14 * 86400000),
      location: { texto: 'Av. Corrientes 1234, CABA', lat: -34.6037, lng: -58.3816 },
    });
    expect(e.location.texto).toBe('Av. Corrientes 1234, CABA');
    expect(e.location.lat).toBe(-34.6037);
    expect(e.location.lng).toBe(-58.3816);
  });

  it('defaults lat/lng to null when only texto is provided', async () => {
    const e = await Evento.create({
      author: author._id,
      title: 'Torneo X',
      eventDate: new Date(Date.now() + 14 * 86400000),
      location: { texto: 'Sin coords' },
    });
    expect(e.location.texto).toBe('Sin coords');
    expect(e.location.lat).toBeNull();
    expect(e.location.lng).toBeNull();
  });

  it('normalizes legacy string location into the new subdocument on hydrate', async () => {
    const Mongoose = require('mongoose');
    await Mongoose.connection.collection('eventos').insertOne({
      author: author._id,
      title: 'Torneo legacy',
      description: '',
      conditions: '',
      fee: 0,
      transferDetails: '',
      eventDate: new Date(Date.now() + 14 * 86400000),
      location: 'Bar Pepe',  // ← string plano, formato viejo
      maxParticipants: 20,
      status: 'open',
      registrations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const found = await Evento.findOne({ title: 'Torneo legacy' });
    expect(found.location.texto).toBe('Bar Pepe');
    expect(found.location.lat).toBeNull();
    expect(found.location.lng).toBeNull();
  });

  it('accepts default location when no field is sent', async () => {
    const e = await Evento.create({
      author: author._id,
      title: 'Torneo sin lugar',
      eventDate: new Date(Date.now() + 14 * 86400000),
    });
    expect(e.location.texto).toBe('');
    expect(e.location.lat).toBeNull();
    expect(e.location.lng).toBeNull();
  });
});
