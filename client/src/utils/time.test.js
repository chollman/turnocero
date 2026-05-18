import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTimeAgo } from './time';

describe('formatTimeAgo', () => {
  const NOW = new Date('2026-05-18T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "recién" for dates within 45 seconds', () => {
    expect(formatTimeAgo(new Date(NOW - 30 * 1000))).toBe('recién');
    expect(formatTimeAgo(new Date(NOW))).toBe('recién');
  });

  it('formats minutes for ranges under an hour', () => {
    expect(formatTimeAgo(new Date(NOW - 5 * 60 * 1000))).toMatch(/min/i);
  });

  it('formats hours for ranges under a day', () => {
    expect(formatTimeAgo(new Date(NOW - 3 * 3600 * 1000))).toMatch(/h|hor/i);
  });

  it('formats days for ranges under a week', () => {
    // 2 days ago in es-AR with numeric: 'auto' is "anteayer"; 3 days ago is "hace 3 días".
    expect(formatTimeAgo(new Date(NOW - 3 * 86400 * 1000))).toMatch(/d[ií]a/i);
  });

  it('formats months for ranges over 30 days', () => {
    expect(formatTimeAgo(new Date(NOW - 60 * 86400 * 1000))).toMatch(/mes/i);
  });

  it('formats years for ranges over 365 days', () => {
    expect(formatTimeAgo(new Date(NOW - 400 * 86400 * 1000))).toMatch(/a[ñn]o/i);
  });

  it('returns empty string for null/undefined/invalid', () => {
    expect(formatTimeAgo(null)).toBe('');
    expect(formatTimeAgo(undefined)).toBe('');
    expect(formatTimeAgo('not a date')).toBe('');
  });

  it('handles ISO strings as input', () => {
    const iso = new Date(NOW - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(iso)).toBeTruthy();
  });
});
