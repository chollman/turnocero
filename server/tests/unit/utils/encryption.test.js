const crypto = require('crypto');

describe('utils/encryption', () => {
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.BGG_CREDS_KEY;
    // Clear module cache so getKey() re-reads the env var.
    delete require.cache[require.resolve('../../../utils/encryption')];
  });

  afterEach(() => {
    process.env.BGG_CREDS_KEY = originalKey;
    delete require.cache[require.resolve('../../../utils/encryption')];
  });

  function freshModule() {
    return require('../../../utils/encryption');
  }

  it('roundtrips utf-8 plaintext', () => {
    const { encrypt, decrypt } = freshModule();
    const payload = 'hola mundo · ñandú 🎲';
    const ct = encrypt(payload);
    expect(ct).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(decrypt(ct)).toBe(payload);
  });

  it('encrypts to a different ciphertext each time (random IV)', () => {
    const { encrypt } = freshModule();
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
  });

  it('returns empty string for empty/nullish input on encrypt', () => {
    const { encrypt } = freshModule();
    expect(encrypt('')).toBe('');
    expect(encrypt(null)).toBe('');
    expect(encrypt(undefined)).toBe('');
  });

  it('returns empty string for empty/nullish input on decrypt', () => {
    const { decrypt } = freshModule();
    expect(decrypt('')).toBe('');
    expect(decrypt(null)).toBe('');
    expect(decrypt(undefined)).toBe('');
  });

  it('throws on tampered ciphertext (auth tag fails)', () => {
    const { encrypt, decrypt } = freshModule();
    const ct = encrypt('secret');
    const [iv, tag, enc] = ct.split(':');
    // Flip last byte of ciphertext
    const tamperedHex = enc.slice(0, -2) + (enc.slice(-2) === '00' ? '01' : '00');
    expect(() => decrypt(`${iv}:${tag}:${tamperedHex}`)).toThrow();
  });

  it('throws on malformed payload (wrong number of segments)', () => {
    const { decrypt } = freshModule();
    expect(() => decrypt('abc:def')).toThrow(/format/);
    expect(() => decrypt('one-segment')).toThrow(/format/);
  });

  it('throws clearly when BGG_CREDS_KEY is missing or invalid', () => {
    process.env.BGG_CREDS_KEY = '';
    delete require.cache[require.resolve('../../../utils/encryption')];
    const { encrypt } = freshModule();
    expect(() => encrypt('x')).toThrow(/BGG_CREDS_KEY/);

    process.env.BGG_CREDS_KEY = 'short';
    delete require.cache[require.resolve('../../../utils/encryption')];
    const m2 = freshModule();
    expect(() => m2.encrypt('x')).toThrow(/64-character hex/);

    process.env.BGG_CREDS_KEY = 'z'.repeat(64); // non-hex
    delete require.cache[require.resolve('../../../utils/encryption')];
    const m3 = freshModule();
    expect(() => m3.encrypt('x')).toThrow();
  });

  it('decrypt fails when the key changes between encrypt and decrypt', () => {
    const { encrypt } = freshModule();
    const ct = encrypt('rotate-me');
    process.env.BGG_CREDS_KEY = crypto.randomBytes(32).toString('hex');
    delete require.cache[require.resolve('../../../utils/encryption')];
    const { decrypt } = freshModule();
    expect(() => decrypt(ct)).toThrow();
  });
});
