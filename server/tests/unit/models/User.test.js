const mongoose = require('mongoose');
const User = require('../../../models/User');

describe('User model — pre("init") normalizes legacy avatar string', () => {
  it('converts a stored string avatar to { url, publicId } on hydrate', async () => {
    // Bypass mongoose validation by inserting via the raw collection.
    await User.collection.insertOne({
      username: 'legacy1',
      email: 'legacy1@test.local',
      password: 'hashed-already',
      avatar: 'https://res.cloudinary.com/legacy/asset.jpg',
      emailVerified: true,
    });
    const user = await User.findOne({ username: 'legacy1' });
    expect(user.avatar).toBeDefined();
    expect(user.avatar.url).toBe('https://res.cloudinary.com/legacy/asset.jpg');
    expect(user.avatar.publicId).toBe('');
  });

  it('leaves new-shape avatar untouched', async () => {
    await User.collection.insertOne({
      username: 'newshape',
      email: 'newshape@test.local',
      password: 'hashed',
      avatar: { url: 'https://x/y.webp', publicId: 'turnocero/users/abc/avatar' },
      emailVerified: true,
    });
    const user = await User.findOne({ username: 'newshape' });
    expect(user.avatar.url).toBe('https://x/y.webp');
    expect(user.avatar.publicId).toBe('turnocero/users/abc/avatar');
  });

  it('handles missing avatar gracefully (defaults to empty shape)', async () => {
    await User.collection.insertOne({
      username: 'noavatar',
      email: 'noavatar@test.local',
      password: 'hashed',
      emailVerified: true,
    });
    const user = await User.findOne({ username: 'noavatar' });
    expect(user.avatar.url).toBe('');
    expect(user.avatar.publicId).toBe('');
  });
});

describe('User model — pre("save") hashes password', () => {
  it('hashes the password on create (not stored as plaintext)', async () => {
    const user = await User.create({
      username: 'hasher',
      email: 'hash@test.local',
      password: 'Password123',
      emailVerified: true,
    });
    expect(user.password).not.toBe('Password123');
    expect(user.password.length).toBeGreaterThan(20); // bcrypt-style hash
  });

  it('does NOT re-hash on save when password is unchanged', async () => {
    const user = await User.create({
      username: 'nohash',
      email: 'nohash@test.local',
      password: 'Password123',
      emailVerified: true,
    });
    const firstHash = user.password;
    user.displayName = 'Changed';
    await user.save();
    expect(user.password).toBe(firstHash); // not re-hashed
  });

  it('re-hashes when password changes', async () => {
    const user = await User.create({
      username: 'rehash',
      email: 'rehash@test.local',
      password: 'Password123',
      emailVerified: true,
    });
    const firstHash = user.password;
    user.password = 'NewPass456';
    await user.save();
    expect(user.password).not.toBe(firstHash);
    expect(user.password).not.toBe('NewPass456');
  });
});

describe('User#comparePassword', () => {
  it('matches the correct password', async () => {
    const user = await User.create({
      username: 'cmp',
      email: 'cmp@test.local',
      password: 'Password123',
      emailVerified: true,
    });
    expect(await user.comparePassword('Password123')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const user = await User.create({
      username: 'cmp2',
      email: 'cmp2@test.local',
      password: 'Password123',
      emailVerified: true,
    });
    expect(await user.comparePassword('Wrong')).toBe(false);
  });
});

describe('User#toJSON', () => {
  it('strips password and bggCredentials, exposes derived flags', async () => {
    const user = await User.create({
      username: 'json',
      email: 'json@test.local',
      password: 'Password123',
      emailVerified: true,
      bggCredentials: { encryptedPassword: 'enc', connectedAt: new Date() },
    });
    const json = user.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.bggCredentials).toBeUndefined();
    expect(json.bggConnected).toBe(true);
    expect(json.bggInvalid).toBe(false);
    expect(json.bggConnectedAt).toBeInstanceOf(Date);
  });
});
