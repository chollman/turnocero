import { describe, it, expect } from 'vitest';
import {
  parseDate,
  dateParts,
  countdown,
  formatFee,
  formatDateLong,
  groupByMonth,
  MESES_LARGO,
  MESES_CORTO,
  DIAS_LARGO,
  DIAS_CORTO,
} from './eventoDate';

describe('parseDate', () => {
  it('returns null for falsy input', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('returns null for invalid date strings', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('parses ISO strings', () => {
    const d = parseDate('2026-06-13T17:00:00');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
  });

  it('passes through Date instances', () => {
    const input = new Date('2026-06-13');
    expect(parseDate(input)).toBe(input);
  });
});

describe('dateParts', () => {
  it('returns null for invalid input', () => {
    expect(dateParts(null)).toBeNull();
    expect(dateParts('bad')).toBeNull();
  });

  it('extracts day, month, year, weekday', () => {
    const p = dateParts('2026-06-13T17:00:00');
    expect(p.day).toBe(13);
    expect(p.month).toBe(MESES_CORTO[5]); // JUN
    expect(p.monthLong).toBe('Junio');
    expect(p.year).toBe(2026);
    expect(p.weekday).toBe(DIAS_CORTO[6]); // SÁB
    expect(p.weekdayLong).toBe('Sábado');
    expect(p.monthKey).toBe('2026-06');
  });

  it('formats time in 24h Argentine locale', () => {
    const p = dateParts('2026-06-13T09:05:00');
    expect(p.time).toMatch(/^09:05$/);
  });
});

describe('countdown', () => {
  const now = new Date('2026-05-20T12:00:00').getTime();

  it('returns past tone with elapsed days', () => {
    const c = countdown('2026-05-17T12:00:00', now);
    expect(c.tone).toBe('past');
    expect(c.text).toMatch(/hace 3 días/);
  });

  it('returns "finalizado" for very recent past', () => {
    const c = countdown('2026-05-20T11:50:00', now);
    expect(c.tone).toBe('past');
    expect(c.text).toBe('finalizado');
  });

  it('returns hours past for recent', () => {
    const c = countdown('2026-05-20T08:00:00', now);
    expect(c.tone).toBe('past');
    expect(c.text).toMatch(/hace 4h/);
  });

  it('returns urgent for less than 1 hour ahead', () => {
    const c = countdown('2026-05-20T12:30:00', now);
    expect(c.tone).toBe('urgent');
    expect(c.text).toMatch(/en 30 min/);
  });

  it('returns urgent for less than 24h ahead', () => {
    const c = countdown('2026-05-20T20:00:00', now);
    expect(c.tone).toBe('urgent');
    expect(c.text).toMatch(/en 8h/);
  });

  it('returns urgent for 1-3 days ahead', () => {
    const c = countdown('2026-05-22T12:00:00', now);
    expect(c.tone).toBe('urgent');
    expect(c.text).toMatch(/en 2 días/);
  });

  it('uses singular día for 1 day', () => {
    const c = countdown('2026-05-21T12:00:00', now);
    expect(c.text).toMatch(/^en 1 día$/);
  });

  it('returns soon for 4-14 days ahead', () => {
    const c = countdown('2026-05-30T12:00:00', now);
    expect(c.tone).toBe('soon');
    expect(c.text).toMatch(/en 10 días/);
  });

  it('returns normal in days for 15-60 days', () => {
    const c = countdown('2026-06-20T12:00:00', now);
    expect(c.tone).toBe('normal');
    expect(c.text).toMatch(/en 31 días/);
  });

  it('returns normal in weeks for 60+ days but < 12 weeks', () => {
    const c = countdown('2026-07-30T12:00:00', now);
    expect(c.tone).toBe('normal');
    expect(c.text).toMatch(/en \d+ semanas/);
  });

  it('returns normal in months for very far events', () => {
    const c = countdown('2027-05-20T12:00:00', now);
    expect(c.tone).toBe('normal');
    expect(c.text).toMatch(/en \d+ meses/);
  });

  it('handles invalid input', () => {
    expect(countdown(null, now)).toEqual({ text: '', tone: 'past' });
  });
});

describe('formatFee', () => {
  it('returns Gratis for 0/null/undefined', () => {
    expect(formatFee(0)).toBe('Gratis');
    expect(formatFee(null)).toBe('Gratis');
    expect(formatFee(undefined)).toBe('Gratis');
  });

  it('formats Argentine locale with dot thousands', () => {
    expect(formatFee(3500)).toMatch(/\$3\.500/);
    expect(formatFee(1500000)).toMatch(/\$1\.500\.000/);
  });

  it('coerces string numbers', () => {
    expect(formatFee('2500')).toMatch(/\$2\.500/);
  });
});

describe('formatDateLong', () => {
  it('returns empty string for invalid input', () => {
    expect(formatDateLong(null)).toBe('');
    expect(formatDateLong('bad')).toBe('');
  });

  it('formats full date with weekday, month long, year and time', () => {
    const out = formatDateLong('2026-06-13T17:00:00');
    expect(out).toContain('Sábado');
    expect(out).toContain('13');
    expect(out).toContain('Junio');
    expect(out).toContain('2026');
    expect(out).toContain('17:00');
  });
});

describe('groupByMonth', () => {
  it('groups events by year-month and sorts chronologically inside each group', () => {
    const events = [
      { _id: 'a', eventDate: '2026-06-13T17:00:00' },
      { _id: 'b', eventDate: '2026-05-30T15:00:00' },
      { _id: 'c', eventDate: '2026-05-15T20:00:00' },
      { _id: 'd', eventDate: '2026-06-07T14:00:00' },
    ];
    const groups = groupByMonth(events);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('2026-05');
    expect(groups[0].name).toBe('Mayo');
    expect(groups[0].events.map(e => e._id)).toEqual(['c', 'b']);
    expect(groups[1].key).toBe('2026-06');
    expect(groups[1].events.map(e => e._id)).toEqual(['d', 'a']);
  });

  it('skips events without parseable date', () => {
    const events = [
      { _id: 'a', eventDate: '2026-06-13' },
      { _id: 'b', eventDate: null },
      { _id: 'c', eventDate: 'invalid' },
    ];
    const groups = groupByMonth(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(1);
  });

  it('preserves order across years', () => {
    const events = [
      { _id: 'a', eventDate: '2027-01-01T00:00:00' },
      { _id: 'b', eventDate: '2026-12-31T00:00:00' },
    ];
    const groups = groupByMonth(events);
    expect(groups.map(g => g.key)).toEqual(['2026-12', '2027-01']);
  });
});

describe('constants', () => {
  it('have correct lengths', () => {
    expect(MESES_LARGO).toHaveLength(12);
    expect(MESES_CORTO).toHaveLength(12);
    expect(DIAS_LARGO).toHaveLength(7);
    expect(DIAS_CORTO).toHaveLength(7);
  });
});
