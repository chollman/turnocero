const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const DirectMessage = require('../../models/DirectMessage');
const { createUser, createAuthedUser, tokenFor } = require('../helpers/auth');
const { loadSiteConfig, updateSiteConfig } = require('../../utils/siteConfig');
const SiteConfig = require('../../models/SiteConfig');

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

async function makeMutualFriends(a, b) {
  await User.updateOne({ _id: a._id }, { $addToSet: { friends: b._id } });
  await User.updateOne({ _id: b._id }, { $addToSet: { friends: a._id } });
}

beforeEach(enableAllSections);

describe('POST /api/dm/:userId — send DM', () => {
  it('friends can message each other', async () => {
    const friend = await createUser({ username: 'friendly' });
    const { user, token } = await createAuthedUser();
    await makeMutualFriends(user, friend);

    const res = await request(app)
      .post(`/api/dm/${friend._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hola' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('hola');

    const stored = await DirectMessage.find({});
    expect(stored.length).toBe(1);
    expect(stored[0].from.toString()).toBe(user._id.toString());
    expect(stored[0].to.toString()).toBe(friend._id.toString());
  });

  it('non-friends get 403', async () => {
    const stranger = await createUser();
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post(`/api/dm/${stranger._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hola' });
    expect(res.status).toBe(403);
  });

  it('400s on empty content', async () => {
    const friend = await createUser();
    const { user, token } = await createAuthedUser();
    await makeMutualFriends(user, friend);
    const res = await request(app)
      .post(`/api/dm/${friend._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('400s on content over 1000 chars', async () => {
    const friend = await createUser();
    const { user, token } = await createAuthedUser();
    await makeMutualFriends(user, friend);
    const res = await request(app)
      .post(`/api/dm/${friend._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'a'.repeat(1001) });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/dm/:userId — paginated history', () => {
  it('returns the conversation in chronological order', async () => {
    const friend = await createUser();
    const { user, token } = await createAuthedUser();
    await makeMutualFriends(user, friend);

    await DirectMessage.create({ from: user._id, to: friend._id, content: 'hola' });
    await DirectMessage.create({ from: friend._id, to: user._id, content: 'qué hacés' });
    await DirectMessage.create({ from: user._id, to: friend._id, content: 'bien' });

    const res = await request(app)
      .get(`/api/dm/${friend._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0].content).toBe('hola');
    expect(res.body[2].content).toBe('bien');
  });

  it('403s if not friends', async () => {
    const stranger = await createUser();
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get(`/api/dm/${stranger._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/dm — conversation list', () => {
  it('returns one entry per contact with the latest message + unread count', async () => {
    const friend1 = await createUser({ username: 'friend1' });
    const friend2 = await createUser({ username: 'friend2' });
    const { user, token } = await createAuthedUser();
    await makeMutualFriends(user, friend1);
    await makeMutualFriends(user, friend2);

    await DirectMessage.create({ from: friend1._id, to: user._id, content: 'hi 1', readByRecipient: false });
    await DirectMessage.create({ from: friend1._id, to: user._id, content: 'hi 2', readByRecipient: false });
    await DirectMessage.create({ from: user._id, to: friend2._id, content: 'sent' });

    const res = await request(app)
      .get('/api/dm')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);

    const f1 = res.body.find((c) => c.contact._id.toString() === friend1._id.toString());
    const f2 = res.body.find((c) => c.contact._id.toString() === friend2._id.toString());

    // Conversation list contact projection must include avatar (regression
    // check: previously only username was projected, breaking <Avatar>).
    expect(f1.contact.avatar).toBeDefined();
    expect(f1.contact.username).toBe('friend1');
    expect(f1.unread).toBe(2);
    expect(f1.lastMessage.content).toBe('hi 2');

    expect(f2.contact.username).toBe('friend2');
    expect(f2.unread).toBe(0); // outgoing doesn't count
  });
});

describe('PATCH /api/dm/:userId/read', () => {
  it('marks all messages from that user as read', async () => {
    const friend = await createUser();
    const { user, token } = await createAuthedUser();
    await makeMutualFriends(user, friend);
    await DirectMessage.create({ from: friend._id, to: user._id, content: 'unread', readByRecipient: false });
    await DirectMessage.create({ from: friend._id, to: user._id, content: 'unread2', readByRecipient: false });

    const res = await request(app)
      .patch(`/api/dm/${friend._id}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const unread = await DirectMessage.countDocuments({
      from: friend._id, to: user._id, readByRecipient: false,
    });
    expect(unread).toBe(0);
  });
});
