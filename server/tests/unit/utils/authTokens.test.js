const {
  generateCode,
  generateUrlToken,
  hashToken,
  compareToken,
} = require('../../../utils/authTokens');

describe('utils/authTokens', () => {
  describe('generateCode', () => {
    it('returns a 6-digit numeric string', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateCode();
        expect(code).toMatch(/^\d{6}$/);
      }
    });

    it('zero-pads small numbers', () => {
      // We can't force the random value, but we can assert the constraint on many samples.
      const samples = Array.from({ length: 200 }, () => generateCode());
      samples.forEach((s) => expect(s.length).toBe(6));
    });
  });

  describe('generateUrlToken', () => {
    it('returns a 64-char hex string (32 bytes)', () => {
      const tok = generateUrlToken();
      expect(tok).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces distinct values across calls', () => {
      const set = new Set(Array.from({ length: 20 }, () => generateUrlToken()));
      expect(set.size).toBe(20);
    });
  });

  describe('hashToken', () => {
    it('produces stable SHA-256 hex for the same input', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'));
      expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });

    it('coerces non-strings via String()', () => {
      expect(hashToken(123)).toBe(hashToken('123'));
    });
  });

  describe('compareToken', () => {
    it('matches a token against its own hash', () => {
      const token = generateUrlToken();
      const hash = hashToken(token);
      expect(compareToken(token, hash)).toBe(true);
    });

    it('returns false on mismatch', () => {
      const hash = hashToken('expected');
      expect(compareToken('other', hash)).toBe(false);
    });

    it('returns false for missing token or hash', () => {
      expect(compareToken('', 'abc')).toBe(false);
      expect(compareToken('abc', '')).toBe(false);
      expect(compareToken(null, null)).toBe(false);
    });

    it('returns false for hashes of different lengths', () => {
      expect(compareToken('x', 'aa')).toBe(false);
    });
  });
});
