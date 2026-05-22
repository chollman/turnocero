const express = require("express");
const router = express.Router();
const { XMLParser } = require("fast-xml-parser");
const { protect } = require("../middleware/auth");
const { requireSection } = require("../middleware/sectionGate");
const { getSessionCookie, clearSession } = require("../utils/bggAuth");
const User = require("../models/User");
const BggGame = require("../models/BggGame");
const BggCollection = require("../models/BggCollection");
const BggPlay = require("../models/BggPlay");
const { computePlayHash } = require("../utils/bggHash");
const { escapeRegex } = require("../utils/regex");
const {
  withUserLock,
  sleep,
  tryAcquireProbeSlot,
  releaseProbeSlot,
  tryAcquireReconcileSlot,
  releaseReconcileSlot,
} = require("../utils/bggSync");

const PROBE_THROTTLE_MS = 5 * 60 * 1000; // 5 min between background probes
const FULL_RECONCILE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days between background full reconciles
const MANUAL_REFRESH_COOLDOWN_MS = 60 * 1000; // 1 min between manual "Actualizar" button clicks per panel

// Server-enforced cooldown for the "Actualizar" button on BG Watch panels.
// Persisted in User.bggSync.lastManualRefresh{Partidas,Coleccion}At so the
// cooldown survives page reloads and is uniform across clients. The button
// only renders for the profile owner (or admin) on the client, but these
// helpers gate the endpoint regardless of auth — a direct curl hit with
// ?refresh=1 is throttled too. Returns 0 when refresh is allowed, otherwise
// the milliseconds remaining.
async function getManualRefreshRemainingMs(bggUsername, panel) {
  if (!bggUsername) return 0;
  const field =
    panel === "partidas"
      ? "bggSync.lastManualRefreshPartidasAt"
      : "bggSync.lastManualRefreshColeccionAt";
  const user = await User.findOne({ bggUsername })
    .collation({ locale: "en", strength: 2 })
    .select(field)
    .lean();
  if (!user) return 0; // no Turnocero user owns this bggUsername — can't persist, allow
  const last =
    panel === "partidas"
      ? user.bggSync?.lastManualRefreshPartidasAt
      : user.bggSync?.lastManualRefreshColeccionAt;
  if (!last) return 0;
  const elapsed = Date.now() - new Date(last).getTime();
  return elapsed >= MANUAL_REFRESH_COOLDOWN_MS
    ? 0
    : MANUAL_REFRESH_COOLDOWN_MS - elapsed;
}

async function stampManualRefresh(bggUsername, panel) {
  if (!bggUsername) return;
  const field =
    panel === "partidas"
      ? "bggSync.lastManualRefreshPartidasAt"
      : "bggSync.lastManualRefreshColeccionAt";
  await User.updateOne(
    { bggUsername },
    { $set: { [field]: new Date() } },
  ).collation({ locale: "en", strength: 2 });
}

router.use(requireSection("bgwatch"));

// Persistent cache pattern: memoria → Mongo → BGG.
// `BggGame` stores the immutable bits (name, image, thumbnail, year, players)
// once per gameId and is shared across all users. The in-memory `cache` Map
// below is kept as an L1 layer to avoid repeated Mongo round-trips within a
// short window. For future entities (collection, plays) follow the same
// pattern: add a model + a `resolveXxx` helper.
const BGG_API = "https://boardgamegeek.com/xmlapi2";
const BGG_GEEKPLAY = "https://boardgamegeek.com/geekplay.php";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos (el botón "Actualizar" del cliente bypassa esto con ?refresh=1)
const cache = new Map();

function getCached(key, ttl = CACHE_TTL) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

function clearPartidasCache(bggUsername) {
  const prefix = `partidas:${String(bggUsername).toLowerCase()}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// Clears every cached artifact specific to one BGG username: in-memory
// plays (all pages/filters), in-memory collection, OG metadata, and the
// persistent `BggCollection` Mongo doc. Called when a user reconnects
// their BGG account so subsequent reads come fresh from BGG and don't
// show stale state from a previous session. Returns a Promise — callers
// should await to ensure Mongo deletion has settled before the next read.
async function clearUserCache(bggUsername) {
  const lower = String(bggUsername).toLowerCase();
  cache.delete(`coleccion:${lower}`);
  cache.delete(`og:${lower}`);
  clearPartidasCache(bggUsername);
  await Promise.all([
    BggCollection.deleteOne({ bggUsername: lower }),
    BggPlay.deleteMany({ bggUsername: lower }),
  ]);
}

async function fetchBgg(url) {
  const headers = { "User-Agent": "Turnocero/1.0" };
  if (process.env.BGG_API_KEY)
    headers.Authorization = `Bearer ${process.env.BGG_API_KEY}`;

  let res = await fetch(url, { headers });

  if (res.status === 202) {
    // BGG encola el pedido — reintentar una vez después de 2s
    await new Promise((r) => {
      setTimeout(r, 2000);
    });
    res = await fetch(url, { headers });
  }

  if (!res.ok) {
    const err = new Error(`BGG responded with ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.text();
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

const GAME_CACHE_TTL = 30 * 60 * 1000; // 30 minutos

// ── Game resolution helpers (memoria → Mongo → BGG) ──────────────────
function parseGameItem(item) {
  const nameRaw = item.name;
  const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
  const primary = nameArr.find((n) => n["@_type"] === "primary") || nameArr[0];
  const thumb =
    typeof item.thumbnail === "string"
      ? item.thumbnail
      : item.thumbnail?.["#text"] || null;
  const img =
    typeof item.image === "string" ? item.image : item.image?.["#text"] || null;
  return {
    id: Number(item["@_id"]),
    name: primary?.["@_value"] || "",
    thumbnail: thumb || null,
    image: img || null,
    year: item.yearpublished?.["@_value"]
      ? Number(item.yearpublished["@_value"])
      : null,
    minPlayers: item.minplayers?.["@_value"]
      ? Number(item.minplayers["@_value"])
      : null,
    maxPlayers: item.maxplayers?.["@_value"]
      ? Number(item.maxplayers["@_value"])
      : null,
  };
}

function gameDocToObject(doc) {
  return {
    id: doc.gameId,
    name: doc.name,
    thumbnail: doc.thumbnail,
    image: doc.image,
    year: doc.yearPublished,
    minPlayers: doc.minPlayers,
    maxPlayers: doc.maxPlayers,
  };
}

async function persistGame(game) {
  await BggGame.updateOne(
    { gameId: game.id },
    {
      $set: {
        name: game.name,
        thumbnail: game.thumbnail,
        image: game.image,
        yearPublished: game.year,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        lastFetchedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

async function resolveGame(gameId) {
  const id = Number(gameId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const cached = getCached(`game:${id}`, GAME_CACHE_TTL);
  if (cached) return cached;

  const doc = await BggGame.findOne({ gameId: id }).lean();
  if (doc) {
    const game = gameDocToObject(doc);
    setCached(`game:${id}`, game);
    return game;
  }

  const xml = await fetchBgg(`${BGG_API}/thing?id=${id}&type=boardgame`);
  const parsed = parser.parse(xml);
  const item = parsed?.items?.item;
  if (!item) return null;
  const game = parseGameItem(item);
  await persistGame(game);
  setCached(`game:${id}`, game);
  return game;
}

async function resolveGamesBatch(gameIds) {
  const ids = [
    ...new Set(
      (gameIds || [])
        .map((g) => Number(g))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  const result = new Map();
  if (ids.length === 0) return result;

  const missingAfterMemory = [];
  for (const id of ids) {
    const cached = getCached(`game:${id}`, GAME_CACHE_TTL);
    if (cached) result.set(id, cached);
    else missingAfterMemory.push(id);
  }
  if (missingAfterMemory.length === 0) return result;

  const docs = await BggGame.find({
    gameId: { $in: missingAfterMemory },
  }).lean();
  const foundInMongo = new Set();
  for (const doc of docs) {
    const game = gameDocToObject(doc);
    result.set(doc.gameId, game);
    setCached(`game:${doc.gameId}`, game);
    foundInMongo.add(doc.gameId);
  }
  const stillMissing = missingAfterMemory.filter((id) => !foundInMongo.has(id));
  if (stillMissing.length === 0) return result;

  const CHUNK_SIZE = 20;
  for (let i = 0; i < stillMissing.length; i += CHUNK_SIZE) {
    const chunk = stillMissing.slice(i, i + CHUNK_SIZE);
    try {
      const thingXml = await fetchBgg(`${BGG_API}/thing?id=${chunk.join(",")}`);
      const thingParsed = parser.parse(thingXml);
      const thingItems = thingParsed?.items?.item;
      if (!thingItems) {
        console.warn(
          `[bgg/resolveGamesBatch] /thing returned no items for ids: ${chunk.join(",")}`,
        );
        continue;
      }
      const arr = Array.isArray(thingItems) ? thingItems : [thingItems];
      for (const item of arr) {
        const game = parseGameItem(item);
        if (!Number.isFinite(game.id) || game.id <= 0) continue;
        await persistGame(game);
        setCached(`game:${game.id}`, game);
        result.set(game.id, game);
      }
    } catch (e) {
      console.warn(
        `[bgg/resolveGamesBatch] /thing batch failed for ids ${chunk.join(",")}: ${e.message || e}`,
      );
    }
  }

  return result;
}

// ── Collection resolution helper (memoria → Mongo[TTL 6h] → BGG) ─────
const COLLECTION_MONGO_TTL = 6 * 60 * 60 * 1000; // 6 horas

function parseCollectionXml(xml) {
  const parsed = parser.parse(xml);
  const root = parsed?.items;
  if (!root) return null;
  const rawItems = root.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  return items.map((item) => {
    const stats = item.stats || {};
    const rating = stats.rating || {};
    return {
      id: item["@_objectid"],
      name:
        typeof item.name === "object"
          ? (item.name["#text"] ?? item.name["@_sortindex"])
          : item.name,
      thumbnail: item.thumbnail || null,
      image: item.image || null,
      yearPublished: item.yearpublished ? Number(item.yearpublished) : null,
      userRating:
        rating["@_value"] && rating["@_value"] !== "N/A"
          ? Number(rating["@_value"])
          : null,
      bggRating: rating.average?.["@_value"]
        ? Number(rating.average["@_value"])
        : null,
      numPlays: item.numplays ? Number(item.numplays) : 0,
    };
  });
}

async function resolveCollection(bggUsername, opts = {}) {
  const { forceRefresh = false } = opts;
  const lower = bggUsername.toLowerCase();
  const cacheKey = `coleccion:${lower}`;

  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const doc = await BggCollection.findOne({ bggUsername: lower }).lean();
    if (
      doc &&
      Date.now() - doc.lastFetchedAt.getTime() < COLLECTION_MONGO_TTL
    ) {
      setCached(cacheKey, doc.games);
      return doc.games;
    }
  }

  const xml = await fetchBgg(
    `${BGG_API}/collection?username=${encodeURIComponent(bggUsername)}&own=1&stats=1`,
  );
  const games = parseCollectionXml(xml);
  if (!games) {
    const err = new Error("Usuario de BGG no encontrado o sin colección");
    err.status = 404;
    throw err;
  }

  await BggCollection.updateOne(
    { bggUsername: lower },
    { $set: { games, lastFetchedAt: new Date() } },
    { upsert: true },
  );
  setCached(cacheKey, games);
  return games;
}

// ── Play parsing + full-sync helpers ─────────────────────────────────
function parsePlay(play) {
  const playerNode = play.players?.player;
  const playersArr = playerNode
    ? Array.isArray(playerNode)
      ? playerNode
      : [playerNode]
    : [];
  const commentsRaw = play.comments;
  const comments =
    typeof commentsRaw === "string"
      ? commentsRaw
      : commentsRaw?.["#text"] || null;
  return {
    playId: String(play["@_id"]),
    date: play["@_date"] || null,
    gameName: play.item?.["@_name"] || null,
    gameId: play.item?.["@_objectid"] ? String(play.item["@_objectid"]) : null,
    gameThumbnail: null,
    quantity: play["@_quantity"] ? Number(play["@_quantity"]) : 1,
    duration: play["@_length"] ? Number(play["@_length"]) : null,
    location: play["@_location"] || null,
    incomplete: play["@_incomplete"] === "1" || play["@_incomplete"] === 1,
    nowinstats: play["@_nowinstats"] === "1" || play["@_nowinstats"] === 1,
    comments: comments || null,
    players: playersArr.map((p) => ({
      name: p["@_name"] || null,
      username: p["@_username"] || null,
      userid: p["@_userid"] ? Number(p["@_userid"]) : null,
      position: p["@_startposition"] || null,
      color: p["@_color"] || null,
      score:
        p["@_score"] !== undefined && p["@_score"] !== ""
          ? String(p["@_score"])
          : null,
      win: p["@_win"] === "1" || p["@_win"] === 1,
      new: p["@_new"] === "1" || p["@_new"] === 1,
      rating:
        p["@_rating"] && p["@_rating"] !== "0" ? Number(p["@_rating"]) : null,
    })),
  };
}

// Returns null when the XML has no <plays> root (used to signal "BGG user
// not found"). Returns { plays, total } otherwise — `total` is 0 for users
// with no plays but who exist on BGG.
function parsePlaysXml(xml) {
  const parsed = parser.parse(xml);
  const root = parsed?.plays;
  if (!root) return null;
  const rawPlays = root.play || [];
  const arr = Array.isArray(rawPlays) ? rawPlays : [rawPlays];
  return {
    plays: arr.map(parsePlay),
    total: root["@_total"] ? Number(root["@_total"]) : arr.length,
  };
}

// Re-shape an internal play (playId) to the API contract (id) used by the
// existing /partidas response and React keys.
function playToApi(p) {
  return {
    id: p.playId,
    date: p.date,
    gameName: p.gameName,
    gameId: p.gameId,
    gameThumbnail: p.gameThumbnail,
    quantity: p.quantity,
    duration: p.duration,
    location: p.location,
    incomplete: p.incomplete,
    nowinstats: p.nowinstats,
    comments: p.comments,
    players: p.players,
  };
}

const SYNC_MAX_PAGES = 200; // safety: ~6000 plays
const RECONCILE_INTER_PAGE_MS = 500;

// Idempotent, non-destructive sync of a user's plays with BGG. Replaces the
// old syncPlaysFull, which wiped BggPlay before refetching — that had an
// inconsistency window and lost data if BGG failed mid-sync.
//
// Walks /plays?username=X&page=N, upserting by playId. Uses the locally
// stored `hash` field to skip writes when content is unchanged.
//
// Options:
//   full        — if false, exits as soon as an entire page already matches
//                 locally (used by the drift-detection probe in reconcile
//                 dirigido). If true, walks every page. Default: false.
//   background  — if true, sleeps RECONCILE_INTER_PAGE_MS between pages so
//                 a large user's reconcile doesn't spike outbound traffic.
//                 Default: false.
//
// Delete detection:
//   full=true   — anything local that wasn't seen in the walk is deleted.
//   full=false  — only local plays whose date is strictly greater than the
//                 oldest seen date are deleted (conservative boundary: if a
//                 BGG date spans the early-exit page boundary, we don't
//                 risk wrongly deleting it).
//
// Returns { inserted, updated, deleted, total, pages }.
async function reconcileFull(
  bggUsername,
  { full = false, background = false } = {},
) {
  const lower = bggUsername.toLowerCase();
  const seen = new Set();
  let inserted = 0;
  let updated = 0;
  let total = 0;
  let pages = 0;
  let minSeenDate = null;

  for (let page = 1; page <= SYNC_MAX_PAGES; page++) {
    const xml = await fetchBgg(
      `${BGG_API}/plays?username=${encodeURIComponent(bggUsername)}&page=${page}`,
    );
    const parsed = parsePlaysXml(xml);
    if (!parsed) {
      const err = new Error("Usuario de BGG no encontrado");
      err.status = 404;
      throw err;
    }
    const { plays, total: pageTotal } = parsed;
    total = pageTotal;
    pages = page;
    if (plays.length === 0) break;

    const gameIds = [...new Set(plays.map((p) => p.gameId).filter(Boolean))];
    let gamesMap = new Map();
    try {
      gamesMap = await resolveGamesBatch(gameIds);
    } catch {
      /* best-effort */
    }

    // Build per-play docs with hash; look up local hashes for the same IDs.
    const pagePlayIds = plays.map((p) => p.playId);
    const localDocs = await BggPlay.find(
      { bggUsername: lower, playId: { $in: pagePlayIds } },
      { playId: 1, hash: 1 },
    ).lean();
    const localHashByPlayId = new Map(localDocs.map((d) => [d.playId, d.hash]));

    const ops = [];
    let allMatch = true;
    for (const p of plays) {
      seen.add(p.playId);
      if (p.date && (!minSeenDate || p.date < minSeenDate))
        minSeenDate = p.date;

      const doc = {
        ...p,
        bggUsername: lower,
        gameThumbnail: p.gameId
          ? gamesMap.get(Number(p.gameId))?.thumbnail || null
          : null,
      };
      doc.hash = computePlayHash(doc);

      const localHash = localHashByPlayId.get(p.playId);
      if (!localHash) {
        ops.push({
          updateOne: {
            filter: { bggUsername: lower, playId: p.playId },
            update: { $set: doc },
            upsert: true,
          },
        });
        inserted++;
        allMatch = false;
      } else if (localHash !== doc.hash) {
        ops.push({
          updateOne: {
            filter: { bggUsername: lower, playId: p.playId },
            update: { $set: doc },
            upsert: false,
          },
        });
        updated++;
        allMatch = false;
      }
      // else: identical content, nothing to write.
    }

    if (ops.length > 0) {
      await BggPlay.bulkWrite(ops, { ordered: false });
    }

    if (!full && allMatch) break;
    if (seen.size >= total) break;
    if (background) await sleep(RECONCILE_INTER_PAGE_MS);
  }

  // Delete detection.
  let deleted = 0;
  const seenIds = [...seen];
  if (full) {
    // Walked everything — anything not seen is gone.
    const result = await BggPlay.deleteMany({
      bggUsername: lower,
      playId: { $nin: seenIds },
    });
    deleted = result.deletedCount || 0;
  } else if (minSeenDate) {
    // Conservative: only delete plays strictly newer than the oldest date
    // we saw. Anything at exactly minSeenDate might span the early-exit
    // page boundary, so leave it for a future full reconcile to settle.
    const result = await BggPlay.deleteMany({
      bggUsername: lower,
      date: { $gt: minSeenDate },
      playId: { $nin: seenIds },
    });
    deleted = result.deletedCount || 0;
  }

  return { inserted, updated, deleted, total, pages };
}

// Cheap drift-detection probe. One request to BGG. If the `total` count
// matches what we have locally and the 30 most-recent plays all have
// matching hashes, we're in sync (the common case). Otherwise:
//   - count mismatch → delegate to reconcileFull({ full: false }) to walk
//     pages until we find an already-synced page boundary.
//   - count matches but some hashes differ → upsert just those plays
//     (covers in-place edits to recent plays).
//
// Returns { outcome, inserted, updated, deleted, total } where outcome is
// 'no_drift' | 'edits_only' | 'reconciled'. Throws on BGG failure (caller
// should mark the outcome as 'failed').
async function probe(bggUsername) {
  const lower = bggUsername.toLowerCase();
  const xml = await fetchBgg(
    `${BGG_API}/plays?username=${encodeURIComponent(bggUsername)}&page=1`,
  );
  const parsed = parsePlaysXml(xml);
  if (!parsed) {
    const err = new Error("Usuario de BGG no encontrado");
    err.status = 404;
    throw err;
  }
  const { plays, total: remoteTotal } = parsed;
  const localTotal = await BggPlay.countDocuments({ bggUsername: lower });

  if (remoteTotal !== localTotal) {
    const result = await reconcileFull(bggUsername, {
      full: false,
      background: false,
    });
    return { outcome: "reconciled", ...result };
  }

  // Same count — check the 30 most-recent plays for in-place edits.
  if (plays.length === 0) {
    return {
      outcome: "no_drift",
      inserted: 0,
      updated: 0,
      deleted: 0,
      total: remoteTotal,
    };
  }

  const pagePlayIds = plays.map((p) => p.playId);
  const localDocs = await BggPlay.find(
    { bggUsername: lower, playId: { $in: pagePlayIds } },
    { playId: 1, hash: 1 },
  ).lean();
  const localHashByPlayId = new Map(localDocs.map((d) => [d.playId, d.hash]));

  // Determine which plays need writing before resolving game thumbnails
  // (saves a BGG request when nothing's changed).
  const dirty = [];
  let inserted = 0;
  let updated = 0;
  for (const p of plays) {
    const baseDoc = { ...p, bggUsername: lower, gameThumbnail: null };
    const hash = computePlayHash(baseDoc);
    const localHash = localHashByPlayId.get(p.playId);
    if (!localHash) {
      dirty.push({ play: p, hash, kind: "insert" });
      inserted++;
    } else if (localHash !== hash) {
      dirty.push({ play: p, hash, kind: "update" });
      updated++;
    }
  }

  if (dirty.length === 0) {
    return {
      outcome: "no_drift",
      inserted: 0,
      updated: 0,
      deleted: 0,
      total: remoteTotal,
    };
  }

  // Resolve thumbnails just for the dirty plays.
  const dirtyGameIds = [
    ...new Set(dirty.map((d) => d.play.gameId).filter(Boolean)),
  ];
  let gamesMap = new Map();
  try {
    gamesMap = await resolveGamesBatch(dirtyGameIds);
  } catch {
    /* best-effort */
  }

  const ops = dirty.map(({ play, hash, kind }) => {
    const doc = {
      ...play,
      bggUsername: lower,
      gameThumbnail: play.gameId
        ? gamesMap.get(Number(play.gameId))?.thumbnail || null
        : null,
      hash,
    };
    return {
      updateOne: {
        filter: { bggUsername: lower, playId: play.playId },
        update: { $set: doc },
        upsert: kind === "insert",
      },
    };
  });
  await BggPlay.bulkWrite(ops, { ordered: false });
  return {
    outcome: "edits_only",
    inserted,
    updated,
    deleted: 0,
    total: remoteTotal,
  };
}

// Persists the probe outcome on the user document. Best-effort — failures
// here don't propagate (the probe itself already succeeded or failed).
//
// User.bggUsername is stored verbatim (case-preserved). BggPlay.bggUsername
// is normalized lowercase. Callers may pass either casing, so we match
// case-insensitively via Mongo collation.
async function stampProbeOutcome(bggUsername, outcome) {
  try {
    await User.updateOne(
      { bggUsername },
      {
        $set: {
          "bggSync.lastProbedAt": new Date(),
          "bggSync.lastProbeOutcome": outcome,
        },
      },
      { collation: { locale: "en", strength: 2 } },
    );
  } catch (err) {
    console.warn(`[bgg/probe] stamp failed for ${bggUsername}: ${err.message}`);
  }
}

// Fire-and-forget probe wrapped with: per-user lock, global slot cap, and
// outcome stamping. Returns nothing — never await this from a request
// handler.
function triggerBackgroundProbe(bggUsername) {
  if (!tryAcquireProbeSlot()) return;
  withUserLock(bggUsername, () => probe(bggUsername))
    .then((result) => stampProbeOutcome(bggUsername, result.outcome))
    .catch((err) => {
      console.warn(
        `[bgg/probe] background failed for ${bggUsername}: ${err.message}`,
      );
      return stampProbeOutcome(bggUsername, "failed");
    })
    .finally(() => releaseProbeSlot());
}

// Stamps a successful full reconcile on the user document. Best-effort.
// Updates all four bggSync timing fields so the next /bg-watch visit
// neither re-triggers a probe (within PROBE_THROTTLE_MS) nor a periodic
// reconcile (within FULL_RECONCILE_INTERVAL_MS).
//
// Case-insensitive match (collation strength 2) — see stampProbeOutcome.
async function stampReconcileResult(bggUsername, result) {
  try {
    const now = new Date();
    await User.updateOne(
      { bggUsername },
      {
        $set: {
          "bggSync.lastFullSyncAt": now,
          "bggSync.lastFullSyncCount": result.total,
          "bggSync.lastProbedAt": now,
          "bggSync.lastProbeOutcome": "reconciled",
        },
      },
      { collation: { locale: "en", strength: 2 } },
    );
  } catch (err) {
    console.warn(
      `[bgg/reconcile] stamp failed for ${bggUsername}: ${err.message}`,
    );
  }
}

// Fire-and-forget full reconcile in the background. Used by autosync on
// bgg-connect (first time a user attaches their BGG account) and by the
// periodic 30-day refresh (Slice 6). Returns true if the slot was acquired
// and the work was scheduled, false if the global cap is full (in which
// case the next trigger for this user will try again).
function triggerBackgroundReconcile(bggUsername) {
  if (!tryAcquireReconcileSlot()) return false;
  withUserLock(bggUsername, () =>
    reconcileFull(bggUsername, { full: true, background: true }),
  )
    .then((result) => stampReconcileResult(bggUsername.toLowerCase(), result))
    .catch((err) => {
      console.warn(
        `[bgg/reconcile] background failed for ${bggUsername}: ${err.message}`,
      );
    })
    .finally(() => releaseReconcileSlot());
  return true;
}

// Fetches plays from BGG narrowed by game + date so we can confirm
// geekplay.php actually persisted the mutation (it can silently 200
// without writing). Returns the parsed play (enriched with thumbnail)
// if BGG has it with the expected playId, or null if not.
//
// NOTE: BGG's /xmlapi2/plays does NOT support filtering by play id.
// The `id` query param is the GAME (thing) id. To pinpoint a single
// play we narrow with id=gameId + mindate=date + maxdate=date, then
// scan the result for the expected playId.
//
// One retry at 600ms because BGG's plays index can lag a hair behind
// a fresh geekplay POST.
async function verifyPlayOnBgg(bggUsername, playId, { gameId, playdate } = {}) {
  const params = new URLSearchParams({ username: bggUsername });
  if (gameId) params.set("id", String(gameId));
  if (playdate) {
    params.set("mindate", playdate);
    params.set("maxdate", playdate);
  }
  const url = `${BGG_API}/plays?${params.toString()}`;
  console.log(`[bgg/verify] GET ${url} (looking for playId=${playId})`);

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
      console.log(
        `[bgg/verify] attempt ${attempt + 1}: ${parsed.plays.length} play(s) returned, none matched playId=${playId}`,
      );
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

// Upserts a BggPlay from a play already parsed off the BGG XML response.
// Use this after verifyPlayOnBgg succeeds — the doc matches what BGG has,
// not what the client sent.
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

// Quita artículos al inicio para normalizar el match — "The LOOP" matchea
// igual que "LOOP" para el bucket de relevancia. Aproxima lo que BGG hace
// con `sortindex` en su web (ignora "The", "A", "An").
function stripLeadingArticle(s) {
  return s.replace(/^(the|a|an)\s+/i, "");
}

// Bucket de relevancia (más bajo = mejor match) sobre el nombre normalizado.
// Aproxima el ranking server-side de BGG sin depender del endpoint web
// gateado por Cloudflare. NO replica el factor de popularidad (no tenemos
// numowned/numratings en cache) — el tiebreak es nombre más corto + año desc.
function scoreSearchMatch(name, query) {
  const normalized = stripLeadingArticle(name).toLowerCase();
  const q = query.toLowerCase();
  if (normalized === q) return 0; // match exacto
  // Prefijo con separador típico: "LOOP: ..." / "LOOP - ..." / "LOOP's ..."
  if (
    normalized.startsWith(`${q} `) ||
    normalized.startsWith(`${q}:`) ||
    normalized.startsWith(`${q}-`) ||
    normalized.startsWith(`${q}'`) ||
    normalized.startsWith(`${q},`)
  )
    return 1;
  // Palabra completa en cualquier posición (word boundary)
  if (new RegExp(`\\b${escapeRegex(q)}\\b`, "i").test(normalized)) return 2;
  // Subcadena
  if (normalized.includes(q)) return 3;
  return 4;
}

// GET /api/bgg/search?q=<query>
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 3) return res.json([]);

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const xml = await fetchBgg(
      `${BGG_API}/search?query=${encodeURIComponent(q)}&type=boardgame`,
    );
    const parsed = parser.parse(xml);

    const root = parsed?.items;
    if (!root) return res.json([]);

    const rawItems = root.item || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const results = items
      .map((item) => {
        const nameRaw = item.name;
        const nameArr = Array.isArray(nameRaw) ? nameRaw : [nameRaw];
        const primary =
          nameArr.find((n) => n["@_type"] === "primary") || nameArr[0];
        const name = primary?.["@_value"] || "";
        const year = item.yearpublished?.["@_value"]
          ? Number(item.yearpublished["@_value"])
          : null;
        return {
          id: Number(item["@_id"]),
          name,
          year,
          thumbnail: null,
          image: null,
        };
      })
      .filter((g) => g.name)
      // Ranking por relevancia (bucket de match → nombre corto → año desc).
      // xmlapi2/search no devuelve los items en ningún orden útil; este sort
      // los pone más cerca del orden que BGG usa en su autocomplete (que está
      // gateado por Cloudflare desde Node, ver historia de PR).
      .sort((a, b) => {
        const sa = scoreSearchMatch(a.name, q);
        const sb = scoreSearchMatch(b.name, q);
        if (sa !== sb) return sa - sb;
        if (a.name.length !== b.name.length)
          return a.name.length - b.name.length;
        return (b.year || 0) - (a.year || 0);
      })
      .slice(0, 30);

    // Batch-resolve thumbnails + images (memoria → Mongo → BGG, compartido entre usuarios)
    if (results.length > 0) {
      try {
        const gamesMap = await resolveGamesBatch(results.map((g) => g.id));
        results.forEach((g) => {
          const game = gamesMap.get(g.id);
          g.thumbnail = game?.thumbnail || null;
          g.image = game?.image || null;
        });
      } catch {
        // thumbnails son opcionales, no bloqueamos el resultado
      }
    }

    setCached(cacheKey, results);
    res.json(results);
  } catch (err) {
    res.status(502).json({ message: "No se pudo conectar con BGG" });
  }
});

// GET /api/bgg/game/:id
router.get("/game/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || id <= 0)
    return res.status(400).json({ message: "Invalid game ID" });

  try {
    const game = await resolveGame(id);
    if (!game) return res.status(404).json({ message: "Juego no encontrado" });
    res.json(game);
  } catch (err) {
    if (err.status === 404)
      return res.status(404).json({ message: "Juego no encontrado" });
    res.status(502).json({ message: "No se pudo conectar con BGG" });
  }
});

// GET /api/bgg/coleccion/:bggUsername
router.get("/coleccion/:bggUsername", async (req, res) => {
  const { bggUsername } = req.params;
  const forceRefresh = req.query.refresh === "1";

  // Server-side cooldown for the manual "Actualizar" button (60s per panel).
  // Applies to anyone hitting ?refresh=1 — the client only shows the button
  // to owner/admin, but we throttle here regardless of auth.
  if (forceRefresh) {
    const remaining = await getManualRefreshRemainingMs(
      bggUsername,
      "coleccion",
    );
    if (remaining > 0) {
      res.setHeader("X-Refresh-Cooldown-Ms", String(remaining));
      return res.status(429).json({
        message: `Esperá ${Math.ceil(remaining / 1000)}s antes de actualizar.`,
        retryAfterMs: remaining,
      });
    }
    await stampManualRefresh(bggUsername, "coleccion");
  }

  try {
    const collection = await resolveCollection(bggUsername, { forceRefresh });
    const remaining = await getManualRefreshRemainingMs(
      bggUsername,
      "coleccion",
    );
    res.setHeader("X-Refresh-Cooldown-Ms", String(remaining));
    res.json(collection);
  } catch (err) {
    if (err.status === 404) {
      return res
        .status(404)
        .json({ message: err.message || "Usuario de BGG no encontrado" });
    }
    res.status(502).json({ message: "No se pudo conectar con BGG" });
  }
});

// GET /api/bgg/partidas/:bggUsername
const PAGE_SIZE = 10;
const BGG_PAGE_SIZE = 30;
const PAGES_PER_BGG = BGG_PAGE_SIZE / PAGE_SIZE; // 3 client pages per BGG page

// Aggregates per-game stats for the user — used by the /bg-watch/:user/juego/:gameId
// view to show stats over the entire history instead of just the visible page.
// "Owner" is the player whose username matches `bggUsername` case-insensitively
// (BGG returns the account holder among the play's players).
//
// Returns { wins, rated, avgDuration, lastDate } where rated is the number of
// plays in which we could identify the owner (plays without a matching player
// are excluded from the win rate denominator).
async function computeGameStats(lowerBggUsername, gameId) {
  // $reduce gives us a deterministic "owner found?" sentinel (`null` means
  // no player whose username matches `bggUsername`). $arrayElemAt on an
  // empty array is supposed to return null too, but its interaction with
  // downstream $ne/$eq turned out brittle in practice — $reduce is
  // explicit about producing a null when no match exists.
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername, gameId: String(gameId) } },
    {
      $project: {
        duration: 1,
        date: 1,
        ownerMatch: {
          $reduce: {
            input: { $ifNull: ["$players", []] },
            initialValue: null,
            in: {
              $cond: [
                {
                  $eq: [
                    { $toLower: { $ifNull: ["$$this.username", ""] } },
                    lowerBggUsername,
                  ],
                },
                { win: { $eq: ["$$this.win", true] } },
                "$$value",
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        rated: {
          $sum: { $cond: [{ $ne: ["$ownerMatch", null] }, 1, 0] },
        },
        wins: {
          $sum: { $cond: [{ $eq: ["$ownerMatch.win", true] }, 1, 0] },
        },
        avgDuration: {
          $avg: { $cond: [{ $gt: ["$duration", 0] }, "$duration", null] },
        },
        lastDate: { $max: "$date" },
      },
    },
  ]);
  if (!agg.length) {
    return { wins: 0, rated: 0, avgDuration: null, lastDate: null };
  }
  const row = agg[0];
  return {
    wins: row.wins || 0,
    rated: row.rated || 0,
    avgDuration: row.avgDuration != null ? Math.round(row.avgDuration) : null,
    lastDate: row.lastDate || null,
  };
}

// Aggregates the user's BggPlay docs into a per-game played-counts list,
// summing `quantity` per gameId. Returns one entry per game the user has
// played (in their log), sorted by numPlays desc. Powers the "Por juego"
// view in PartidasPanel — replaces the collection-derived list, which
// missed plays of unowned games and broke for users with private
// collections.
async function computePlayedGames(lowerBggUsername) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername, gameId: { $ne: null } } },
    {
      $group: {
        _id: "$gameId",
        numPlays: { $sum: { $ifNull: ["$quantity", 1] } },
        name: { $last: "$gameName" },
        thumbnail: { $last: "$gameThumbnail" },
      },
    },
    { $sort: { numPlays: -1, _id: 1 } },
  ]);
  return agg.map((row) => ({
    id: row._id,
    name: row.name || null,
    thumbnail: row.thumbnail || null,
    numPlays: row.numPlays,
  }));
}

// Aggregates the user's BggPlay docs to find the single most-played game,
// summing `quantity` per gameId. Returns null when there are no plays with
// a gameId. Designed for the stats card on /bg-watch/:user — only called on
// the unfiltered page=1 request.
async function computeTopPlayedGame(lowerBggUsername) {
  const agg = await BggPlay.aggregate([
    { $match: { bggUsername: lowerBggUsername, gameId: { $ne: null } } },
    {
      $group: {
        _id: "$gameId",
        count: { $sum: { $ifNull: ["$quantity", 1] } },
        name: { $last: "$gameName" },
        thumbnail: { $last: "$gameThumbnail" },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 1 },
  ]);
  if (!agg.length || !agg[0].count) return null;
  const top = agg[0];
  return {
    id: top._id,
    name: top.name || null,
    thumbnail: top.thumbnail || null,
    numPlays: top.count,
  };
}

// GET /api/bgg/juegos-jugados/:bggUsername — list of games the user has
// played, derived from BggPlay aggregation. Returns [] when the user has
// no plays in Mongo so the client can fall back to the collection-derived
// list (only useful for users on the L1/L3 fallback path; for synced
// users the server-derived list is authoritative).
router.get("/juegos-jugados/:bggUsername", async (req, res) => {
  const { bggUsername } = req.params;
  const lower = bggUsername.toLowerCase();
  try {
    const items = await computePlayedGames(lower);
    res.json(items);
  } catch (err) {
    console.error(
      `[bgg/juegos-jugados] aggregation failed for ${lower}:`,
      err.message,
    );
    res
      .status(500)
      .json({ message: "No se pudieron computar los juegos jugados" });
  }
});

router.get("/partidas/:bggUsername", async (req, res) => {
  const { bggUsername } = req.params;
  const lower = bggUsername.toLowerCase();
  const clientPage = Math.max(1, parseInt(req.query.page) || 1);

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const mindate = dateRe.test(req.query.mindate || "")
    ? req.query.mindate
    : null;
  const maxdate = dateRe.test(req.query.maxdate || "")
    ? req.query.maxdate
    : null;
  const gameId = /^\d+$/.test(req.query.id || "") ? req.query.id : null;
  const forceRefresh = req.query.refresh === "1";

  // Server-side cooldown for the manual "Actualizar" button (60s per panel).
  // Applies regardless of auth — client only shows the button to owner/admin.
  if (forceRefresh) {
    const remaining = await getManualRefreshRemainingMs(
      bggUsername,
      "partidas",
    );
    if (remaining > 0) {
      res.setHeader("X-Refresh-Cooldown-Ms", String(remaining));
      return res.status(429).json({
        message: `Esperá ${Math.ceil(remaining / 1000)}s antes de actualizar.`,
        retryAfterMs: remaining,
      });
    }
    await stampManualRefresh(bggUsername, "partidas");
  }

  // Set the current cooldown header on the response once, here. All
  // res.json(...) paths below inherit it automatically. If we just stamped
  // (forceRefresh path), this returns ~MANUAL_REFRESH_COOLDOWN_MS; otherwise
  // it reflects whatever cooldown was previously active (or 0).
  const cooldownRemaining = await getManualRefreshRemainingMs(
    bggUsername,
    "partidas",
  );
  res.setHeader("X-Refresh-Cooldown-Ms", String(cooldownRemaining));

  // L2: serve from Mongo if this user has been synced.
  const hasMongoData = await BggPlay.exists({ bggUsername: lower });

  if (hasMongoData) {
    if (forceRefresh) {
      // User explicitly asked for fresh data — run the probe synchronously
      // so the response reflects any changes from BGG.
      try {
        const result = await withUserLock(bggUsername, () =>
          probe(bggUsername),
        );
        await stampProbeOutcome(lower, result.outcome);
      } catch (e) {
        console.warn(
          `[bgg/partidas] sync probe failed for ${lower}: ${e.message || e}`,
        );
        await stampProbeOutcome(lower, "failed");
      }
    } else {
      // Background sync with 5-min probe throttle. Doesn't block the
      // response. Skipped if no Turnocero User owns this BGG username —
      // the probe is an owner-driven maintenance task; we don't sync
      // plays for strangers an anonymous visitor happens to be looking
      // at.
      //
      // When a probe is due, we pick the path based on lastFullSyncAt:
      //   - If a full reconcile is overdue (> 30 days, or never ran),
      //     trigger a full reconcile instead of the lightweight probe.
      //     This covers the blind spot of edits to plays older than the
      //     30 most recent (which the page-1 probe can't detect).
      //   - Otherwise, trigger the cheap probe.
      // The two are mutually exclusive so they never race on the per-
      // user lock.
      const u = await User.findOne({ bggUsername: lower })
        .select("bggSync.lastProbedAt bggSync.lastFullSyncAt")
        .lean();
      if (u) {
        const lastProbed = u.bggSync?.lastProbedAt;
        const lastFullSync = u.bggSync?.lastFullSyncAt;
        const probeDue =
          !lastProbed ||
          Date.now() - new Date(lastProbed).getTime() > PROBE_THROTTLE_MS;
        if (probeDue) {
          const reconcileOverdue =
            !lastFullSync ||
            Date.now() - new Date(lastFullSync).getTime() >
              FULL_RECONCILE_INTERVAL_MS;
          if (reconcileOverdue) {
            triggerBackgroundReconcile(bggUsername);
          } else {
            triggerBackgroundProbe(bggUsername);
          }
        }
      }
    }

    const filter = { bggUsername: lower };
    if (mindate || maxdate) {
      filter.date = {};
      if (mindate) filter.date.$gte = mindate;
      if (maxdate) filter.date.$lte = maxdate;
    }
    if (gameId) filter.gameId = String(gameId);

    const isUnfilteredFirstPage =
      clientPage === 1 && !mindate && !maxdate && !gameId;

    const [total, docs, topGame, gameStats] = await Promise.all([
      BggPlay.countDocuments(filter),
      BggPlay.find(filter)
        .sort({ date: -1, playId: -1 })
        .skip((clientPage - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      isUnfilteredFirstPage
        ? computeTopPlayedGame(lower)
        : Promise.resolve(undefined),
      // Per-game stats over the full history — only when filtered by gameId
      // (the /bg-watch/:user/juego/:gameId view).
      gameId ? computeGameStats(lower, gameId) : Promise.resolve(undefined),
    ]);

    const response = {
      total,
      page: clientPage,
      pageSize: PAGE_SIZE,
      plays: docs.map(playToApi),
    };
    if (isUnfilteredFirstPage) response.topGame = topGame;
    if (gameId) response.gameStats = gameStats;
    return res.json(response);
  }

  // L1 / L3 fallback: no Mongo data yet — serve from BGG (with in-memory cache).
  //
  // If a Turnocero User owns this bggUsername (case-insensitive match), kick
  // off a background reconcile so they stop falling through this path on
  // future visits. This is the self-healing branch that catches users who
  // connected BGG before the autosync-on-connect was deployed (Phase 5), or
  // whose autosync failed and was never retried manually. The reconcile is
  // fire-and-forget — the current request still serves the L1/L3 cache as
  // before so the user sees data immediately.
  const ownerForBackfill = await User.findOne({ bggUsername: lower })
    .collation({ locale: "en", strength: 2 })
    .select("_id")
    .lean();
  if (ownerForBackfill) triggerBackgroundReconcile(bggUsername);

  const bggPage = Math.ceil(clientPage / PAGES_PER_BGG);
  const offsetWithinBgg = ((clientPage - 1) % PAGES_PER_BGG) * PAGE_SIZE;
  const cacheKey = `partidas:${lower}:bgg:${bggPage}:${mindate || "-"}:${maxdate || "-"}:${gameId || "-"}`;

  if (!forceRefresh) {
    const cachedFull = getCached(cacheKey);
    if (cachedFull) {
      return res.json({
        total: cachedFull.total,
        page: clientPage,
        pageSize: PAGE_SIZE,
        plays: cachedFull.plays.slice(
          offsetWithinBgg,
          offsetWithinBgg + PAGE_SIZE,
        ),
      });
    }
  }

  try {
    const params = new URLSearchParams({
      username: bggUsername,
      page: String(bggPage),
    });
    if (mindate) params.set("mindate", mindate);
    if (maxdate) params.set("maxdate", maxdate);
    if (gameId) params.set("id", gameId);
    const xml = await fetchBgg(`${BGG_API}/plays?${params.toString()}`);
    const parsed = parsePlaysXml(xml);
    if (!parsed)
      return res.status(404).json({ message: "Usuario de BGG no encontrado" });
    const { plays: parsedInternal, total } = parsed;

    // Enrich thumbnails via the shared BggGame cache (no per-user data here)
    const uniqueGameIds = [
      ...new Set(parsedInternal.map((p) => p.gameId).filter(Boolean)),
    ];
    const gamesMap = await resolveGamesBatch(uniqueGameIds);
    parsedInternal.forEach((p) => {
      if (p.gameId)
        p.gameThumbnail = gamesMap.get(Number(p.gameId))?.thumbnail || null;
    });

    const apiPlays = parsedInternal.map(playToApi);
    const fullPageData = { total, plays: apiPlays };
    setCached(cacheKey, fullPageData);

    res.json({
      total,
      page: clientPage,
      pageSize: PAGE_SIZE,
      plays: apiPlays.slice(offsetWithinBgg, offsetWithinBgg + PAGE_SIZE),
    });
  } catch (err) {
    if (err.status === 404)
      return res.status(404).json({ message: "Usuario de BGG no encontrado" });
    res.status(502).json({ message: "No se pudo conectar con BGG" });
  }
});

// Build geekplay.php form body. If `playId` is set, it's an edit; otherwise create.
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

async function submitToGeekplay(user, form, label) {
  let cookie;
  try {
    cookie = await getSessionCookie(user._id);
  } catch (e) {
    throw Object.assign(e, { status: e.status || 500 });
  }

  const formBody = form.toString();
  console.log(`[bgg/geekplay ${label}] POST body: ${formBody}`);

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
    console.warn(
      `[bgg/geekplay ${label}] HTTP ${bggRes.status}:`,
      text.slice(0, 500),
    );
    throw Object.assign(new Error(`BGG respondió ${bggRes.status}`), {
      status: 502,
    });
  }

  const text = await bggRes.text();
  console.log(
    `[bgg/geekplay ${label}] HTTP ${bggRes.status} body: ${text.slice(0, 500)}`,
  );
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  return payload;
}

// GET /api/bgg/og/:bggUsername — public OG metadata for /bg-watch/:username crawlers.
// Returns displayName (Turnocero user if connected), play count, collection size,
// and the user's top-played game with thumbnail. Cached 30 min per username.
router.get("/og/:bggUsername", async (req, res) => {
  const { bggUsername } = req.params;
  const cacheKey = `og:${bggUsername.toLowerCase()}`;
  const cached = getCached(cacheKey, 30 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    // Look up the Turnocero user by bggUsername (case-insensitive) for displayName.
    const userDoc = await User.findOne({
      bggUsername: new RegExp(`^${escapeRegex(bggUsername)}$`, "i"),
    })
      .select("username displayName")
      .lean();
    const displayName =
      userDoc?.displayName || userDoc?.username || bggUsername;

    // Fetch BGG collection (top-played game + total games owned).
    let juegos = null;
    let topGame = null;
    try {
      const collXml = await fetchBgg(
        `${BGG_API}/collection?username=${encodeURIComponent(bggUsername)}&own=1&stats=1`,
      );
      const parsedColl = parser.parse(collXml);
      const root = parsedColl?.items;
      if (root) {
        const rawItems = root.item || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];
        juegos = items.length;
        let maxPlays = 0;
        for (const item of items) {
          const plays = item.numplays ? Number(item.numplays) : 0;
          if (plays > maxPlays) {
            maxPlays = plays;
            topGame = {
              name:
                typeof item.name === "object" ? item.name["#text"] : item.name,
              thumbnail: item.thumbnail || null,
              numPlays: plays,
            };
          }
        }
      }
    } catch {
      // Swallow — partial data is better than 500 for crawlers.
    }

    // Fetch total play count (BGG plays API returns it as @_total).
    let partidas = null;
    try {
      const playsXml = await fetchBgg(
        `${BGG_API}/plays?username=${encodeURIComponent(bggUsername)}&page=1`,
      );
      const parsedPlays = parser.parse(playsXml);
      const total = parsedPlays?.plays?.["@_total"];
      partidas = total ? Number(total) : null;
    } catch {
      // Swallow.
    }

    if (juegos === null && partidas === null) {
      return res.status(404).json({});
    }

    const data = { displayName, bggUsername, partidas, juegos, topGame };
    setCached(cacheKey, data);
    res.json(data);
  } catch {
    res.status(500).json({});
  }
});

// POST /api/bgg/sync — full reconciliation of the authenticated user's BGG
// plays. Walks every page, upserting by playId and detecting deletes by
// diffing against local IDs. Non-destructive: if BGG fails mid-walk, what
// was already upserted stays valid and the next run picks up where this
// left off.
//
// Used by the "Reconciliar all con BGG" button as a manual fallback for
// edits to old plays that the lightweight probe misses.
router.post("/sync", protect, async (req, res) => {
  try {
    const user = req.user;
    if (!user.bggUsername) {
      return res
        .status(400)
        .json({ message: "Configurá tu username de BGG en el perfil" });
    }

    const result = await withUserLock(user.bggUsername, () =>
      reconcileFull(user.bggUsername, { full: true, background: false }),
    );

    // Persist sync metadata on the user — see stampReconcileResult for the
    // shared semantics; same fields are mirrored here for the sync path.
    if (!user.bggSync) user.bggSync = {};
    const now = new Date();
    user.bggSync.lastFullSyncAt = now;
    user.bggSync.lastFullSyncCount = result.total;
    user.bggSync.lastProbedAt = now;
    user.bggSync.lastProbeOutcome = "reconciled";
    await user.save();

    // Drop the in-memory plays cache so subsequent reads come from Mongo
    clearPartidasCache(user.bggUsername);

    res.json({
      success: true,
      lastFullSyncAt: user.bggSync.lastFullSyncAt,
      inserted: result.inserted,
      updated: result.updated,
      deleted: result.deleted,
      total: result.total,
      pages: result.pages,
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: "Usuario de BGG no encontrado" });
    }
    console.error("BGG full sync failed:", err);
    res
      .status(502)
      .json({ message: err.message || "No se pudo sincronizar con BGG" });
  }
});

// POST /api/bgg/partidas — create a play in BGG. The flow is BGG-first:
// submit to geekplay.php, then verify the play exists on BGG by fetching
// it back, then mirror to Mongo using BGG's canonical representation.
// If any step fails the response is 502 and Mongo is left untouched.
router.post("/partidas", protect, async (req, res) => {
  try {
    const user = req.user;
    if (!user.bggUsername) {
      return res
        .status(400)
        .json({ message: "Configurá tu username de BGG en el perfil" });
    }
    const validationError = validatePlayBody(req.body);
    if (validationError)
      return res.status(400).json({ message: validationError });

    const form = buildPlayForm(req.body, null);
    let payload;
    try {
      payload = await submitToGeekplay(user, form, "POST");
    } catch (e) {
      return res.status(e.status || 500).json({ message: e.message });
    }

    const newPlayId = payload.playid || payload.numplays || null;
    if (!newPlayId) {
      console.warn("[bgg/POST] geekplay returned no playid:", payload);
      return res.status(502).json({
        message: "BGG no devolvió un ID de partida. La partida no se guardó.",
      });
    }

    const verified = await verifyPlayOnBgg(user.bggUsername, newPlayId, {
      gameId: req.body.objectid,
      playdate: req.body.playdate,
    });
    if (!verified) {
      return res.status(502).json({
        message:
          "BGG no confirmó la partida después de guardarla. Intentá de nuevo.",
      });
    }

    clearPartidasCache(user.bggUsername);

    // Only mirror to Mongo if this user is already in Mongo-served mode
    // (i.e. has done a full sync). Otherwise the GET fallback to BGG will
    // pick up the new play on its next call.
    const lower = user.bggUsername.toLowerCase();
    if (await BggPlay.exists({ bggUsername: lower })) {
      try {
        await upsertPlayFromBgg(user.bggUsername, verified);
      } catch (e) {
        console.warn("[bgg/POST] mirror to Mongo failed:", e.message);
      }
    }

    res.json({
      success: true,
      playid: String(newPlayId),
      play: playToApi(verified),
    });
  } catch (err) {
    console.error("Create play failed:", err);
    res
      .status(500)
      .json({ message: err.message || "Error al crear la partida" });
  }
});

// DELETE /api/bgg/partidas/:playId — delete a play from BGG. Verifies the
// play is actually gone from BGG before removing the Mongo mirror.
router.delete("/partidas/:playId", protect, async (req, res) => {
  try {
    const user = req.user;
    if (!user.bggUsername) {
      return res
        .status(400)
        .json({ message: "Configurá tu username de BGG en el perfil" });
    }
    const { playId } = req.params;
    if (!/^\d+$/.test(String(playId))) {
      return res.status(400).json({ message: "ID de partida inválido" });
    }

    // We need gameId + date to narrow the verification query. Look up the
    // existing play in our Mongo mirror; if the user hasn't synced yet we
    // skip narrowing and the verify call walks the unfiltered plays list
    // (acceptable fallback — DELETE on a never-synced user is rare).
    const lower = user.bggUsername.toLowerCase();
    const existing = await BggPlay.findOne({
      bggUsername: lower,
      playId: String(playId),
    }).lean();
    const verifyOpts = existing
      ? { gameId: existing.gameId, playdate: existing.date }
      : {};

    const form = new URLSearchParams();
    form.set("ajax", "1");
    form.set("action", "delete");
    form.set("playid", String(playId));
    form.set("finalize", "1");
    form.set("B1", "Yes");

    try {
      await submitToGeekplay(user, form, "DELETE");
    } catch (e) {
      return res.status(e.status || 500).json({ message: e.message });
    }

    const stillThere = await verifyPlayOnBgg(
      user.bggUsername,
      playId,
      verifyOpts,
    );
    if (stillThere) {
      return res.status(502).json({
        message: "BGG no confirmó el borrado de la partida. Intentá de nuevo.",
      });
    }

    clearPartidasCache(user.bggUsername);
    try {
      await BggPlay.deleteOne({
        bggUsername: user.bggUsername.toLowerCase(),
        playId: String(playId),
      });
    } catch (e) {
      console.warn("[bgg/DELETE] mirror to Mongo failed:", e.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete play failed:", err);
    res
      .status(500)
      .json({ message: err.message || "Error al eliminar la partida" });
  }
});

// PUT /api/bgg/partidas/:playId — edit an existing play in BGG. Same
// BGG-first verification flow as POST.
router.put("/partidas/:playId", protect, async (req, res) => {
  try {
    const user = req.user;
    if (!user.bggUsername) {
      return res
        .status(400)
        .json({ message: "Configurá tu username de BGG en el perfil" });
    }
    const { playId } = req.params;
    if (!/^\d+$/.test(String(playId))) {
      return res.status(400).json({ message: "ID de partida inválido" });
    }
    const validationError = validatePlayBody(req.body);
    if (validationError)
      return res.status(400).json({ message: validationError });

    const form = buildPlayForm(req.body, playId);
    try {
      await submitToGeekplay(user, form, "PUT");
    } catch (e) {
      return res.status(e.status || 500).json({ message: e.message });
    }

    const verified = await verifyPlayOnBgg(user.bggUsername, playId, {
      gameId: req.body.objectid,
      playdate: req.body.playdate,
    });
    if (!verified) {
      return res.status(502).json({
        message: "BGG no confirmó la edición de la partida. Intentá de nuevo.",
      });
    }

    clearPartidasCache(user.bggUsername);
    const lower = user.bggUsername.toLowerCase();
    if (await BggPlay.exists({ bggUsername: lower })) {
      try {
        await upsertPlayFromBgg(user.bggUsername, verified);
      } catch (e) {
        console.warn("[bgg/PUT] mirror to Mongo failed:", e.message);
      }
    }

    res.json({ success: true, playid: playId, play: playToApi(verified) });
  } catch (err) {
    console.error("Edit play failed:", err);
    res
      .status(500)
      .json({ message: err.message || "Error al editar la partida" });
  }
});

module.exports = router;
// Exposed for other routes (e.g. auth's bgg-connect handler) that need to
// invalidate the per-user in-memory cache after relevant mutations.
module.exports.clearUserCache = clearUserCache;
// Exposed so other routes can kick off an initial / periodic full reconcile
// in the background after a relevant event (BGG connect, scheduled refresh).
module.exports.triggerBackgroundReconcile = triggerBackgroundReconcile;
// Exposed for routes that necesitan hidratar metadata de un juego BGG
// (e.g. POST /api/eventos/:id/ludoteca, que recibe solo bggGameId del cliente
// y completa name/thumbnail/year server-side).
module.exports.resolveGame = resolveGame;
// Internal: clear the in-memory L1 cache. Tests use this to isolate runs.
module.exports.__resetCache = () => cache.clear();
