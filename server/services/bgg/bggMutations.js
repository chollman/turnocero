// Mutations contra BGG via `geekplay.php` (POST/PUT/DELETE de partidas).
//
// El XML API público de BGG es read-only. Para escribir hablamos al
// endpoint interno `geekplay.php` — el mismo que usa la web UI — con un
// session cookie obtenido vía POST a /login/api/v1 (ver utils/bggAuth.js).
//
// CAVEAT (memory: feedback-bgg-write-quirks):
// - `/xmlapi2/plays?id=` es game-id, NO play-id. Para verificar una sola
//   play necesitamos narrow con id=gameId + mindate/maxdate + escanear
//   por playId.
// - `geekplay.php` con `action=delete` SIN `finalize=1`+`B1=Yes` devuelve
//   HTML de confirmación silenciosamente (200 OK pero no borra nada).
// - `geekplay.php` puede devolver 200 + JSON con success:0 (mutación que
//   "no falló pero tampoco persistió"). El flujo correcto es BGG-first:
//   1. submitToGeekplay → si 200, asumimos que pudo persistir
//   2. verifyPlayOnBgg → re-fetcheo de /plays para confirmar
//   3. solo si verifica, escribimos a Mongo via upsertPlayFromBgg
//
// El espejo a Mongo es opcional: si el user nunca corrió sync (no tiene
// BggPlay docs) lo skippeamos para no semi-poblar la colección y forzar
// expectativas inconsistentes con sync. Una vez que el user sincroniza
// por primera vez, las mutations sí lo actualizan.

const BggPlay = require("../../models/BggPlay");
const logger = require("../../utils/logger");
const httpError = require("../../utils/httpError");
const { computePlayHash } = require("../../utils/bggHash");
const { sleep } = require("../../utils/bggSync");
const { getSessionCookie, clearSession } = require("../../utils/bggAuth");
const { parsePlaysXml } = require("./bggParse");
const { BGG_API, fetchBgg, resolveGame } = require("./bggResolve");
const { invalidateOwnerDerived } = require("./bggInvalidate");

const BGG_GEEKPLAY = "https://boardgamegeek.com/geekplay.php";

// Construye el form body para geekplay.php. Si `playId` está seteado es
// edit (PUT), si no, create (POST). El shape exacto del body es lo que
// la web UI envía (action=save, version=2, players[i][...]). Cualquier
// campo opcional ausente se omite — geekplay rechaza con HTTP 400 si le
// mandás campos vacíos con expectativa de presencia.
function buildPlayForm(body, playId = null) {
  const {
    objectid,
    playdate,
    length,
    location,
    quantity = 1,
    comments,
    incomplete = false,
    nowinstats = false,
    players = [],
  } = body;

  const qty = Math.max(1, Math.min(99, parseInt(quantity) || 1));
  const len =
    length != null && length !== "" ? Math.max(0, parseInt(length) || 0) : null;

  const form = new URLSearchParams();
  form.set("ajax", "1");
  form.set("action", "save");
  form.set("version", "2");
  form.set("objecttype", "thing");
  if (playId) form.set("playid", String(playId));
  form.set("objectid", String(objectid));
  form.set("playdate", String(playdate));
  if (len != null) form.set("length", String(len));
  if (location) form.set("location", String(location).slice(0, 100));
  form.set("quantity", String(qty));
  if (comments) form.set("comments", String(comments).slice(0, 1000));
  form.set("incomplete", incomplete ? "1" : "0");
  form.set("nowinstats", nowinstats ? "1" : "0");

  players.forEach((p, i) => {
    const idx = `players[${i}]`;
    if (p.name) form.set(`${idx}[name]`, String(p.name).slice(0, 100));
    if (p.username)
      form.set(`${idx}[username]`, String(p.username).slice(0, 50));
    form.set(`${idx}[position]`, String(p.position ?? i + 1));
    if (p.color) form.set(`${idx}[color]`, String(p.color).slice(0, 30));
    if (p.score != null && p.score !== "")
      form.set(`${idx}[score]`, String(p.score).slice(0, 30));
    form.set(`${idx}[new]`, p.new ? "1" : "0");
    if (p.rating != null && Number(p.rating) > 0)
      form.set(`${idx}[rating]`, String(p.rating));
    form.set(`${idx}[win]`, p.win ? "1" : "0");
  });

  return form;
}

// Valida el body de POST/PUT /partidas antes de armar el form. Devuelve
// un string con el error en castellano si algo está mal, null si está OK.
function validatePlayBody(body) {
  if (!/^\d+$/.test(String(body.objectid || ""))) {
    return "ID de juego inválido";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.playdate || ""))) {
    return "Fecha inválida (formato YYYY-MM-DD)";
  }
  if (!Array.isArray(body.players)) {
    return "Lista de jugadores inválida";
  }
  return null;
}

// POST a geekplay.php con el session cookie del user. Re-tira errors
// con `.status` para que el HTTP handler arriba pueda devolver el código
// adecuado:
//   401/403 → session inválida (limpiamos cache, frontend redirige a /perfil)
//   500     → error obteniendo cookie (BGG_CREDS_KEY mal, decryption falla)
//   502     → fetch network blip o BGG !ok
//
// `label` solo es para los logs ("POST" | "PUT" | "DELETE").
async function submitToGeekplay(user, form, label) {
  let cookie;
  try {
    cookie = await getSessionCookie(user._id);
  } catch (e) {
    throw Object.assign(e, { status: e.status || 500 });
  }

  const formBody = form.toString();
  logger.info(`[bgg/geekplay ${label}] POST`, { body: formBody });

  let bggRes;
  try {
    bggRes = await fetch(BGG_GEEKPLAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
        "User-Agent": "Turnocero/1.0",
        Origin: "https://boardgamegeek.com",
        Referer: "https://boardgamegeek.com/",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: formBody,
    });
  } catch (e) {
    throw Object.assign(new Error(`No se pudo contactar BGG: ${e.message}`), {
      status: 502,
    });
  }

  if (bggRes.status === 401 || bggRes.status === 403) {
    clearSession(user._id);
    throw Object.assign(
      new Error("Sesión BGG inválida. Reconectá en /perfil."),
      { status: 401 },
    );
  }
  if (!bggRes.ok) {
    const text = await bggRes.text().catch(() => "");
    logger.warn(`[bgg/geekplay ${label}] non-ok response`, {
      status: bggRes.status,
      body: text.slice(0, 500),
    });
    throw Object.assign(new Error(`BGG respondió ${bggRes.status}`), {
      status: 502,
    });
  }

  const text = await bggRes.text();
  logger.info(`[bgg/geekplay ${label}] response`, {
    status: bggRes.status,
    body: text.slice(0, 500),
  });
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  return payload;
}

// Fetchea plays de BGG narrowed por game + date para confirmar que
// geekplay.php efectivamente persistió la mutación (puede silently 200
// sin escribir). Devuelve la play parseada (con thumbnail resuelto) si
// BGG la tiene con el playId esperado, o null si no.
//
// NOTA: BGG's /xmlapi2/plays NO soporta filtrar por play id. El query
// param `id` es el GAME (thing) id. Para identificar una sola play
// narrow-eamos con id=gameId + mindate=date + maxdate=date, después
// scaneamos el result por el playId esperado.
//
// Un retry a 600ms porque el índice de plays de BGG puede laggear un
// pelo respecto de un POST fresco a geekplay.
async function verifyPlayOnBgg(bggUsername, playId, { gameId, playdate } = {}) {
  const params = new URLSearchParams({ username: bggUsername });
  if (gameId) params.set("id", String(gameId));
  if (playdate) {
    params.set("mindate", playdate);
    params.set("maxdate", playdate);
  }
  const url = `${BGG_API}/plays?${params.toString()}`;
  logger.info("[bgg/verify] GET", { url, playId });

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(600);
    let xml;
    try {
      xml = await fetchBgg(url);
    } catch (e) {
      // Network/upstream blip — retry once, then give up.
      if (attempt === 0) continue;
      const err = new Error(
        `No se pudo verificar la partida en BGG: ${e.message}`,
      );
      err.status = 502;
      throw err;
    }
    const parsed = parsePlaysXml(xml);
    if (!parsed) continue;
    const play = parsed.plays.find((p) => p.playId === String(playId));
    if (!play) {
      logger.info("[bgg/verify] no match this attempt", {
        attempt: attempt + 1,
        playsReturned: parsed.plays.length,
        playId,
      });
      continue;
    }

    let thumbnail = null;
    if (play.gameId) {
      try {
        const game = await resolveGame(play.gameId);
        thumbnail = game?.thumbnail || null;
      } catch {
        /* best-effort */
      }
    }
    return { ...play, gameThumbnail: thumbnail };
  }
  return null;
}

// Upserts un BggPlay de la play ya parseada del XML response de BGG.
// Usar tras verifyPlayOnBgg success — el doc matchea lo que BGG tiene,
// NO lo que el cliente mandó (geekplay puede mutar fields silenciosamente
// — ej. quantity normalizado, comments con whitespace trimmed).
async function upsertPlayFromBgg(bggUsername, parsedPlay) {
  const lower = bggUsername.toLowerCase();
  const doc = { ...parsedPlay, bggUsername: lower };
  doc.hash = computePlayHash(doc);
  await BggPlay.updateOne(
    { bggUsername: lower, playId: doc.playId },
    { $set: doc },
    { upsert: true },
  );
  return doc;
}

// Flujo completo de CREAR una partida (BGG-first): valida → arma form →
// submit a geekplay → confirma con verifyPlayOnBgg → espeja a Mongo (si el
// user ya sincronizó) → invalida los caches derivados. Devuelve
// `{ playid, verified }`. Lanza httpError en cada fallo (igual que el handler
// inline previo). Lo comparten `POST /partidas` y `POST /partidas/compartida`.
async function createPlay(user, body) {
  if (!user.bggUsername) {
    throw httpError(400, "Configurá tu username de BGG en el perfil");
  }
  const validationError = validatePlayBody(body);
  if (validationError) throw httpError(400, validationError);

  const form = buildPlayForm(body, null);
  let payload;
  try {
    payload = await submitToGeekplay(user, form, "POST");
  } catch (e) {
    throw httpError(e.status || 500, e.message);
  }

  const newPlayId = payload.playid || payload.numplays || null;
  if (!newPlayId) {
    logger.warn("[bgg/createPlay] geekplay returned no playid", { payload });
    throw httpError(
      502,
      "BGG no devolvió un ID de partida. La partida no se guardó.",
    );
  }

  const verified = await verifyPlayOnBgg(user.bggUsername, newPlayId, {
    gameId: body.objectid,
    playdate: body.playdate,
  });
  if (!verified) {
    throw httpError(
      502,
      "BGG no confirmó la partida después de guardarla. Intentá de nuevo.",
    );
  }

  const lower = user.bggUsername.toLowerCase();
  if (await BggPlay.exists({ bggUsername: lower })) {
    try {
      await upsertPlayFromBgg(user.bggUsername, verified);
    } catch (e) {
      logger.warn("[bgg/createPlay] mirror to Mongo failed", {
        error: e.message,
      });
    }
  }

  await invalidateOwnerDerived(user.bggUsername);

  return { playid: String(newPlayId), verified };
}

module.exports = {
  BGG_GEEKPLAY,
  buildPlayForm,
  validatePlayBody,
  submitToGeekplay,
  verifyPlayOnBgg,
  upsertPlayFromBgg,
  createPlay,
};
