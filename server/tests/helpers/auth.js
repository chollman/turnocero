const jwt = require('jsonwebtoken');
const User = require('../../models/User');

let counter = 0;

function nextSuffix() {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

/**
 * Create a verified User in the DB and return its JWT.
 * Override any field via the `overrides` arg.
 */
async function createUser(overrides = {}) {
  const suffix = nextSuffix();
  const user = await User.create({
    username: overrides.username || `user_${suffix}`,
    email: overrides.email || `user_${suffix}@test.local`,
    password: overrides.password || 'Password123',
    emailVerified: overrides.emailVerified !== false,
    isAdmin: !!overrides.isAdmin,
    isBanned: !!overrides.isBanned,
    bannedReason: overrides.bannedReason || '',
    displayName: overrides.displayName || '',
    bggUsername: overrides.bggUsername || '',
    friends: overrides.friends || [],
  });
  return user;
}

function tokenFor(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

async function createAuthedUser(overrides = {}) {
  const user = await createUser(overrides);
  return { user, token: tokenFor(user) };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createUser, createAuthedUser, tokenFor, authHeader };
