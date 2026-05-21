const { haversineKm, isValidCoord } = require('../../../utils/geo');

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(-34.6037, -58.3816, -34.6037, -58.3816)).toBe(0);
  });

  it('computes a known short distance (CABA → La Plata ≈ 56km)', () => {
    // Obelisco (-34.6037, -58.3816) → Centro La Plata (-34.9215, -57.9545)
    const km = haversineKm(-34.6037, -58.3816, -34.9215, -57.9545);
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(62);
  });

  it('computes a known medium distance (CABA → Rosario ≈ 280km)', () => {
    // Obelisco → Monumento a la Bandera (-32.9442, -60.6505)
    const km = haversineKm(-34.6037, -58.3816, -32.9442, -60.6505);
    expect(km).toBeGreaterThan(270);
    expect(km).toBeLessThan(295);
  });

  it('computes a known long distance (CABA → Madrid ≈ 10000km)', () => {
    const km = haversineKm(-34.6037, -58.3816, 40.4168, -3.7038);
    expect(km).toBeGreaterThan(9900);
    expect(km).toBeLessThan(10200);
  });

  it('handles antipodal points (≈ 20015km)', () => {
    const km = haversineKm(0, 0, 0, 180);
    expect(km).toBeGreaterThan(20000);
    expect(km).toBeLessThan(20030);
  });

  it('is symmetric (a→b === b→a)', () => {
    const ab = haversineKm(-34.6, -58.4, -32.9, -60.6);
    const ba = haversineKm(-32.9, -60.6, -34.6, -58.4);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('returns null when any coord is null', () => {
    expect(haversineKm(null, -58.4, -34.6, -58.4)).toBeNull();
    expect(haversineKm(-34.6, null, -34.6, -58.4)).toBeNull();
    expect(haversineKm(-34.6, -58.4, null, -58.4)).toBeNull();
    expect(haversineKm(-34.6, -58.4, -34.6, null)).toBeNull();
  });

  it('returns null when any coord is undefined or NaN', () => {
    expect(haversineKm(undefined, -58.4, -34.6, -58.4)).toBeNull();
    expect(haversineKm(NaN, -58.4, -34.6, -58.4)).toBeNull();
  });

  it('returns null for out-of-range coords', () => {
    expect(haversineKm(91, 0, 0, 0)).toBeNull();
    expect(haversineKm(0, 181, 0, 0)).toBeNull();
    expect(haversineKm(-91, 0, 0, 0)).toBeNull();
    expect(haversineKm(0, -181, 0, 0)).toBeNull();
  });
});

describe('isValidCoord', () => {
  it('accepts valid coords', () => {
    expect(isValidCoord(0, 0)).toBe(true);
    expect(isValidCoord(-34.6, -58.4)).toBe(true);
    expect(isValidCoord(90, 180)).toBe(true);
    expect(isValidCoord(-90, -180)).toBe(true);
  });

  it('rejects null/undefined/NaN', () => {
    expect(isValidCoord(null, 0)).toBe(false);
    expect(isValidCoord(0, undefined)).toBe(false);
    expect(isValidCoord(NaN, 0)).toBe(false);
  });

  it('rejects out-of-range', () => {
    expect(isValidCoord(91, 0)).toBe(false);
    expect(isValidCoord(0, 181)).toBe(false);
    expect(isValidCoord(-91, 0)).toBe(false);
    expect(isValidCoord(0, -181)).toBe(false);
  });

  it('rejects non-numeric types', () => {
    expect(isValidCoord('0', '0')).toBe(false);
    expect(isValidCoord({}, [])).toBe(false);
  });
});
