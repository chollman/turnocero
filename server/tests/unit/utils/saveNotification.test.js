const Notification = require('../../../models/Notification');
const saveNotification = require('../../../utils/saveNotification');
const SiteConfig = require('../../../models/SiteConfig');
const { loadSiteConfig, updateSiteConfig } = require('../../../utils/siteConfig');
const { createUser } = require('../../helpers/auth');

// All saveNotification tests except the section-gating block start with every
// section enabled, so the underlying upsert logic is exercised in isolation
// from the section-gating policy.
async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

describe('saveNotification — aggregating types', () => {
  beforeEach(enableAllSections);

  it('inserts a new notification with count=1 on first call', async () => {
    const user = await createUser();
    const n = await saveNotification(user._id, 'chat', {
      tableId: 't1', tableName: 'Mesa Catán', lastSenderUsername: 'cha',
    });
    expect(n).not.toBeNull();
    expect(n.count).toBe(1);
    expect(n.tableId).toBe('t1');
    expect(n.read).toBe(false);
  });

  it('increments count on subsequent calls for the same target', async () => {
    const user = await createUser();
    await saveNotification(user._id, 'chat', { tableId: 't1', tableName: 'Mesa', lastSenderUsername: 'a' });
    await saveNotification(user._id, 'chat', { tableId: 't1', tableName: 'Mesa', lastSenderUsername: 'b' });
    const n = await saveNotification(user._id, 'chat', { tableId: 't1', tableName: 'Mesa', lastSenderUsername: 'c' });
    expect(n.count).toBe(3);
    expect(n.lastSenderUsername).toBe('c');
  });

  it('keeps separate notifications for different tableIds', async () => {
    const user = await createUser();
    await saveNotification(user._id, 'comment', { tableId: 't1', lastCommenterUsername: 'a' });
    await saveNotification(user._id, 'comment', { tableId: 't2', lastCommenterUsername: 'b' });
    const all = await Notification.find({ recipient: user._id, type: 'comment' });
    expect(all.length).toBe(2);
  });

  it('resets read=false on increment (even if previously read)', async () => {
    const user = await createUser();
    await saveNotification(user._id, 'chat', { tableId: 't1', tableName: 'Mesa' });
    await Notification.updateOne({ recipient: user._id, type: 'chat', tableId: 't1' }, { $set: { read: true } });
    const after = await saveNotification(user._id, 'chat', { tableId: 't1', tableName: 'Mesa' });
    expect(after.read).toBe(false);
  });
});

describe('saveNotification — non-aggregating types', () => {
  beforeEach(enableAllSections);

  it('overwrites instead of incrementing for non-aggregating types', async () => {
    const user = await createUser();
    await saveNotification(user._id, 'tournament_accepted', {
      torneoId: 'tt1', torneoTitle: 'Liga 1',
    });
    const n = await saveNotification(user._id, 'tournament_accepted', {
      torneoId: 'tt1', torneoTitle: 'Liga 1 (renombrada)',
    });
    expect(n.count).toBe(1);
    expect(n.torneoTitle).toBe('Liga 1 (renombrada)');
  });
});

describe('saveNotification — section gating', () => {
  // No enableAllSections() here — these tests assert behavior when sections are OFF.
  beforeEach(async () => {
    await loadSiteConfig(); // section 'mesas' defaults to false
  });

  it('returns null and persists nothing when the section is disabled for non-admins', async () => {
    const user = await createUser({ isAdmin: false });
    const result = await saveNotification(user._id, 'chat', { tableId: 't1' });
    expect(result).toBeNull();
    const count = await Notification.countDocuments({ recipient: user._id });
    expect(count).toBe(0);
  });

  it('still saves to admins when section is disabled (admins see through)', async () => {
    const admin = await createUser({ isAdmin: true });
    const result = await saveNotification(admin._id, 'chat', { tableId: 't1' });
    expect(result).not.toBeNull();
    expect(result.count).toBe(1);
  });

  it('saves for everyone when the section is enabled', async () => {
    await updateSiteConfig({ mesas: { enabled: true } }, null, null);
    const user = await createUser({ isAdmin: false });
    const result = await saveNotification(user._id, 'chat', { tableId: 't1' });
    expect(result).not.toBeNull();
  });
});
