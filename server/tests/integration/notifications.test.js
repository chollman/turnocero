const request = require('supertest');
const app = require('../../app');
const Notification = require('../../models/Notification');
const { createAuthedUser } = require('../helpers/auth');

describe('GET /api/notifications', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns the caller\'s notifications newest first, capped at limit', async () => {
    const { user, token } = await createAuthedUser();
    // Insert 5 notifications with staggered updatedAt
    for (let i = 0; i < 5; i++) {
      await Notification.create({
        recipient: user._id,
        type: 'comment',
        tableId: `t${i}`,
        tableName: `Mesa ${i}`,
        updatedAt: new Date(Date.now() + i * 1000),
      });
    }
    const res = await request(app)
      .get('/api/notifications?limit=3')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    // Newest first
    expect(res.body[0].tableId).toBe('t4');
    expect(res.body[1].tableId).toBe('t3');
  });

  it('does not leak other users\' notifications', async () => {
    const { user: mine, token } = await createAuthedUser();
    const { user: other } = await createAuthedUser();
    await Notification.create({ recipient: mine._id, type: 'comment', tableId: 'mine' });
    await Notification.create({ recipient: other._id, type: 'comment', tableId: 'other' });
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tableId).toBe('mine');
  });
});

describe('PATCH /api/notifications/read', () => {
  it('marks all unread as read when body is empty', async () => {
    const { user, token } = await createAuthedUser();
    await Notification.create({ recipient: user._id, type: 'comment', tableId: 't1', read: false });
    await Notification.create({ recipient: user._id, type: 'comment', tableId: 't2', read: false });

    await request(app).patch('/api/notifications/read').set('Authorization', `Bearer ${token}`).send({});

    const unreadCount = await Notification.countDocuments({ recipient: user._id, read: false });
    expect(unreadCount).toBe(0);
  });

  it('marks only matching tableId as read', async () => {
    const { user, token } = await createAuthedUser();
    await Notification.create({ recipient: user._id, type: 'comment', tableId: 't1', read: false });
    await Notification.create({ recipient: user._id, type: 'comment', tableId: 't2', read: false });

    await request(app)
      .patch('/api/notifications/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ tableId: 't1' });

    const ns = await Notification.find({ recipient: user._id });
    const t1 = ns.find((n) => n.tableId === 't1');
    const t2 = ns.find((n) => n.tableId === 't2');
    expect(t1.read).toBe(true);
    expect(t2.read).toBe(false);
  });
});

describe('DELETE /api/notifications', () => {
  it('clears all the caller\'s notifications', async () => {
    const { user, token } = await createAuthedUser();
    await Notification.create({ recipient: user._id, type: 'comment', tableId: 't1' });
    await Notification.create({ recipient: user._id, type: 'comment', tableId: 't2' });
    await request(app).delete('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(await Notification.countDocuments({ recipient: user._id })).toBe(0);
  });
});
