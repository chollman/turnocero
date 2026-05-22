const { canActInEvento } = require('../../../utils/eventoPermissions');

function evt({ author, registrations = [] }) {
  return { author, registrations };
}

describe('canActInEvento', () => {
  const owner = { _id: 'owner1', isAdmin: false };
  const admin = { _id: 'admin1', isAdmin: true };
  const confirmed = { _id: 'conf1', isAdmin: false };
  const pending = { _id: 'pend1', isAdmin: false };
  const rejected = { _id: 'rej1', isAdmin: false };
  const stranger = { _id: 'other1', isAdmin: false };
  const event = evt({
    author: 'owner1',
    registrations: [
      { user: 'conf1', status: 'confirmed' },
      { user: 'pend1', status: 'pending' },
      { user: 'rej1', status: 'rejected' },
    ],
  });

  it('returns false for null user (guest)', () => {
    expect(canActInEvento(event, null)).toBe(false);
  });

  it('returns false for null evento', () => {
    expect(canActInEvento(null, confirmed)).toBe(false);
  });

  it('returns true for site admin even without any relation to the event', () => {
    expect(canActInEvento(event, admin)).toBe(true);
  });

  it('returns true for the event author', () => {
    expect(canActInEvento(event, owner)).toBe(true);
  });

  it('returns true for a confirmed registrant', () => {
    expect(canActInEvento(event, confirmed)).toBe(true);
  });

  it('returns false for a pending registrant', () => {
    expect(canActInEvento(event, pending)).toBe(false);
  });

  it('returns false for a rejected registrant', () => {
    expect(canActInEvento(event, rejected)).toBe(false);
  });

  it('returns false for a stranger (no registration)', () => {
    expect(canActInEvento(event, stranger)).toBe(false);
  });

  it('handles evento with no registrations gracefully', () => {
    const e = evt({ author: 'owner1' });
    expect(canActInEvento(e, confirmed)).toBe(false);
    expect(canActInEvento(e, owner)).toBe(true);
  });

  it('compares ids as strings (works with ObjectId-like values)', () => {
    const objectIdLike = { toString: () => 'owner1' };
    const e = evt({ author: objectIdLike, registrations: [] });
    expect(canActInEvento(e, owner)).toBe(true);
  });
});
