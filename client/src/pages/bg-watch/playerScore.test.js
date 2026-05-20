import { describe, it, expect } from 'vitest';
import { hasDisplayableScore } from './playerScore';

describe('hasDisplayableScore', () => {
  it('returns false for null, undefined, empty, whitespace', () => {
    expect(hasDisplayableScore(null)).toBe(false);
    expect(hasDisplayableScore(undefined)).toBe(false);
    expect(hasDisplayableScore('')).toBe(false);
    expect(hasDisplayableScore('   ')).toBe(false);
  });

  it('returns false for the literal string "null" (data-poisoning guard)', () => {
    expect(hasDisplayableScore('null')).toBe(false);
    expect(hasDisplayableScore('NULL')).toBe(false);
    expect(hasDisplayableScore('Null')).toBe(false);
    expect(hasDisplayableScore(' null ')).toBe(false);
  });

  it('returns false for the literal string "undefined"', () => {
    expect(hasDisplayableScore('undefined')).toBe(false);
    expect(hasDisplayableScore('UNDEFINED')).toBe(false);
  });

  it('returns true for real numeric scores (including 0 and negatives)', () => {
    expect(hasDisplayableScore('0')).toBe(true);
    expect(hasDisplayableScore('10')).toBe(true);
    expect(hasDisplayableScore('10.5')).toBe(true);
    expect(hasDisplayableScore('-7')).toBe(true);
    expect(hasDisplayableScore(0)).toBe(true);
    expect(hasDisplayableScore(42)).toBe(true);
  });

  it('returns true for non-numeric labels (BGG allows free-text scores)', () => {
    expect(hasDisplayableScore('high')).toBe(true);
    expect(hasDisplayableScore('A+')).toBe(true);
  });
});
