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
  // Defaults primero, luego spread de overrides — así un test puede pasar
  // cualquier campo del schema (eventoReminderHours, direccion, etc.) sin
  // tener que enumerarlo acá.
  const user = await User.create({
    username: `user_${suffix}`,
    email: `user_${suffix}@test.local`,
    password: 'Password123',
    emailVerified: true,
    isAdmin: false,
    isBanned: false,
    bannedReason: '',
    displayName: '',
    bggUsername: '',
    friends: [],
    ...overrides,
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
