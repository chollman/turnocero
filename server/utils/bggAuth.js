const User = require('../models/User');
const { decrypt } = require('./encryption');

const BGG_LOGIN_URL = 'https://boardgamegeek.com/login/api/v1';
const SESSION_TTL = 15 * 60 * 1000; // 15 min
const sessionCache = new Map(); // userId(string) -> { cookie, ts }

/**
 * Calls BGG's internal login endpoint and returns a cookie string suitable
 * for subsequent authenticated requests. Throws { status: 401 } on invalid
 * credentials, { status: 502 } on BGG errors, { status: 400 } on bad input.
 */
async function loginToBgg(username, password) {
  if (!username || !password) {
    throw Object.assign(new Error('Username y password de BGG requeridos'), { status: 400 });
  }

  let res;
  try {
    res = await fetch(BGG_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Turnocero/1.0',
      },
      body: JSON.stringify({ credentials: { username, password } }),
    });
  } catch (e) {
    throw Object.assign(new Error(`No se pudo contactar BGG: ${e.message}`), { status: 502 });
  }

  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('Credenciales BGG inválidas'), { status: 401 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`BGG login respondió ${res.status}`), { status: 502 });
  }

  const setCookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [];

  const pairs = [];
  for (const raw of setCookies) {
    const first = raw.split(';')[0];
    if (first && first.includes('=')) pairs.push(first.trim());
  }
  if (pairs.length === 0) {
    throw Object.assign(new Error('BGG login no devolvió cookies'), { status: 502 });
  }
  return pairs.join('; ');
}

/**
 * Returns a valid BGG session cookie for the given Turnocero user. Uses an
 * in-memory cache (15 min TTL); on miss, re-logs in to BGG with the stored
 * credentials. Marks credentials as invalid if BGG rejects them.
 */
async function getSessionCookie(userId) {
  const key = String(userId);
  const cached = sessionCache.get(key);
  if (cached && Date.now() - cached.ts < SESSION_TTL) {
    return cached.cookie;
  }

  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  }
  if (!user.bggUsername) {
    throw Object.assign(new Error('Configurá tu username de BGG en el perfil'), { status: 400 });
  }
  const creds = user.bggCredentials;
  if (!creds || !creds.encryptedPassword) {
    throw Object.assign(new Error('BGG no está conectado'), { status: 400 });
  }
  if (creds.invalid) {
    throw Object.assign(
      new Error('Tu sesión BGG caducó. Volvé a ingresar tu password en el perfil.'),
      { status: 401 }
    );
  }

  let password;
  try {
    password = decrypt(creds.encryptedPassword);
  } catch (e) {
    throw Object.assign(
      new Error('No se pudieron descifrar las credenciales BGG (clave maestra inválida?)'),
      { status: 500 }
    );
  }

  try {
    const cookie = await loginToBgg(user.bggUsername, password);
    sessionCache.set(key, { cookie, ts: Date.now() });
    creds.lastValidatedAt = new Date();
    creds.invalid = false;
    await user.save();
    return cookie;
  } catch (e) {
    if (e.status === 401) {
      creds.invalid = true;
      try { await user.save(); } catch { /* non-fatal; just flag the user */ }
    }
    throw e;
  }
}

function clearSession(userId) {
  sessionCache.delete(String(userId));
}

module.exports = { loginToBgg, getSessionCookie, clearSession };
