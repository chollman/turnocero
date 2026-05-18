let counter = 0;

function nextSuffix() {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

/**
 * Returns a user object shaped like what the API sends.
 * Override any field via the argument.
 */
export function makeUser(overrides = {}) {
  const suffix = nextSuffix();
  return {
    _id: overrides._id || `mock-user-${suffix}`,
    username: overrides.username || `user${suffix}`,
    email: overrides.email || `${suffix}@test.local`,
    displayName: overrides.displayName ?? '',
    nombre: overrides.nombre ?? '',
    apellido: overrides.apellido ?? '',
    avatar: overrides.avatar ?? { url: '', publicId: '' },
    bggUsername: overrides.bggUsername ?? '',
    bggConnected: overrides.bggConnected ?? false,
    bggInvalid: overrides.bggInvalid ?? false,
    isAdmin: overrides.isAdmin ?? false,
    isBanned: overrides.isBanned ?? false,
    emailVerified: overrides.emailVerified ?? true,
    friends: overrides.friends || [],
    friendRequests: overrides.friendRequests || [],
    createdAt: overrides.createdAt || new Date().toISOString(),
    ...overrides,
  };
}

export const deletedUser = null; // sentinel meaning "populate returned no user"
