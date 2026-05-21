const {
  normalizeLocationInput,
  isEmptyLocation,
  locationForCreate,
} = require('../../../utils/locationHelpers');

describe('normalizeLocationInput', () => {
  it('returns undefined when input is null/undefined', () => {
    expect(normalizeLocationInput(null)).toBeUndefined();
    expect(normalizeLocationInput(undefined)).toBeUndefined();
  });

  it('normalizes a plain string to { texto, lat: null, lng: null }', () => {
    expect(normalizeLocationInput('Bar La Esquina')).toEqual({
      texto: 'Bar La Esquina', lat: null, lng: null,
    });
  });

  it('truncates texto to 300 chars', () => {
    const longText = 'a'.repeat(500);
    const result = normalizeLocationInput(longText);
    expect(result.texto.length).toBe(300);
  });

  it('parses JSON string input (FormData use case)', () => {
    const json = JSON.stringify({ texto: 'Florida 100', lat: -34.6, lng: -58.4 });
    expect(normalizeLocationInput(json)).toEqual({
      texto: 'Florida 100', lat: -34.6, lng: -58.4,
    });
  });

  it('falls back to string treatment if JSON parse fails', () => {
    // Empieza con { pero no es JSON válido.
    expect(normalizeLocationInput('{ broken')).toEqual({
      texto: '{ broken', lat: null, lng: null,
    });
  });

  it('passes through object input with valid coords', () => {
    expect(normalizeLocationInput({ texto: 'X', lat: -34.6, lng: -58.4 })).toEqual({
      texto: 'X', lat: -34.6, lng: -58.4,
    });
  });

  it('drops coords if any is out of range', () => {
    const result = normalizeLocationInput({ texto: 'X', lat: 999, lng: -58.4 });
    expect(result.texto).toBe('X');
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });

  it('drops coords if only one is provided', () => {
    const result = normalizeLocationInput({ texto: 'X', lat: -34.6 });
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });

  it('handles non-string non-object input by returning undefined', () => {
    expect(normalizeLocationInput(42)).toBeUndefined();
    expect(normalizeLocationInput(true)).toBeUndefined();
  });
});

describe('isEmptyLocation', () => {
  it('returns true for null/undefined/falsy', () => {
    expect(isEmptyLocation(null)).toBe(true);
    expect(isEmptyLocation(undefined)).toBe(true);
  });

  it('returns true for empty subdocument', () => {
    expect(isEmptyLocation({ texto: '', lat: null, lng: null })).toBe(true);
  });

  it('returns false when texto is non-empty', () => {
    expect(isEmptyLocation({ texto: 'X', lat: null, lng: null })).toBe(false);
  });

  it('returns false when coords are present (even without texto)', () => {
    expect(isEmptyLocation({ texto: '', lat: -34.6, lng: -58.4 })).toBe(false);
  });
});

describe('locationForCreate', () => {
  it('passes through non-empty input as-is', () => {
    const input = { texto: 'Bar Pepe' };
    const user = { texto: 'Mi casa', lat: -34.6, lng: -58.4 };
    const result = locationForCreate(input, user);
    expect(result.texto).toBe('Bar Pepe');
    expect(result.lat).toBeNull();
  });

  it('falls back to user.direccion when input is empty', () => {
    const user = { texto: 'Mi casa', lat: -34.6, lng: -58.4 };
    expect(locationForCreate({}, user)).toEqual({
      texto: 'Mi casa', lat: -34.6, lng: -58.4,
    });
    expect(locationForCreate(null, user)).toEqual({
      texto: 'Mi casa', lat: -34.6, lng: -58.4,
    });
    expect(locationForCreate({ texto: '', lat: null, lng: null }, user)).toEqual({
      texto: 'Mi casa', lat: -34.6, lng: -58.4,
    });
  });

  it('returns user.direccion with only texto if user has no coords', () => {
    const user = { texto: 'Mi casa', lat: null, lng: null };
    expect(locationForCreate({}, user)).toEqual({
      texto: 'Mi casa', lat: null, lng: null,
    });
  });

  it('returns user.direccion with only coords if user has no texto', () => {
    const user = { texto: '', lat: -34.6, lng: -58.4 };
    expect(locationForCreate({}, user)).toEqual({
      texto: '', lat: -34.6, lng: -58.4,
    });
  });

  it('returns the (empty) normalized input when both input and user are empty', () => {
    // `{}` normaliza a `{ texto: '', lat: null, lng: null }` y no hay fallback
    // posible — devuelve esa forma vacía como está.
    expect(locationForCreate({}, null)).toEqual({ texto: '', lat: null, lng: null });
    expect(locationForCreate({}, { texto: '', lat: null, lng: null }))
      .toEqual({ texto: '', lat: null, lng: null });
  });

  it('returns undefined when input is undefined and no user fallback', () => {
    expect(locationForCreate(undefined, null)).toBeUndefined();
    expect(locationForCreate(undefined, {})).toBeUndefined();
  });
});
