import { describe, it, expect } from 'vitest';
import { hashStringToInt, hashToBrandColor, AVATAR_PALETTE } from './hash';

describe('hashStringToInt', () => {
  it('is deterministic for the same input', () => {
    expect(hashStringToInt('abc')).toBe(hashStringToInt('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashStringToInt('a')).not.toBe(hashStringToInt('b'));
  });

  it('returns 0 for empty string', () => {
    expect(hashStringToInt('')).toBe(0);
  });

  it('handles long inputs without crashing', () => {
    expect(typeof hashStringToInt('x'.repeat(10000))).toBe('number');
  });
});

describe('hashToBrandColor', () => {
  it('returns one of the brand-palette CSS vars', () => {
    for (let i = 0; i < 50; i++) {
      const color = hashToBrandColor(`user-${i}`);
      expect(AVATAR_PALETTE).toContain(color);
    }
  });

  it('returns the same color for the same key (stable per user)', () => {
    expect(hashToBrandColor('user-1')).toBe(hashToBrandColor('user-1'));
    expect(hashToBrandColor('5f1a2b3c4d5e6f7a8b9c0d1e')).toBe(
      hashToBrandColor('5f1a2b3c4d5e6f7a8b9c0d1e'),
    );
  });
});
