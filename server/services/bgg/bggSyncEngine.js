// Motor de sincronización entre BggPlay (Mongo local) y BGG remoto.
// (memory: feedback-bgg-sync-engine, feedback-user-lock-semantics,
// feedback-bgg-username-case)
//
// Reemplaza al wipe-and-refetch destructivo previo a Phase 4. Estrategia:
//
//   1. probe(): un fetch barato a /plays?page=1 que detecta drift por count
//      o por hash de las 30 partidas más recientes.
//        - count mismatch → reconcileFull({ full: false })
//        - same count, dirty hashes → upsert solo las dirty
//        - sin cambios → no_drift
//
//   2. reconcileFull(): walk page-by-page con dos modos:
//        - full=true: recorre todas las páginas, deletes anything not seen.
//        - full=false: corta al encontrar una página entera ya sincronizada;
//          deletes conservativos (solo plays cuya date sea estrictamente
//          mayor a la oldest date vista — evita borrar plays que crucen el
//          page boundary del early exit).
//
//   3. triggerBackgroundProbe(): fire-and-forget con per-user lock (vía
//      withUserLock) + global slot cap (tryAcquireProbeSlot). Stampa
//      User.bggSync.lastProbedAt / lastProbeOutcome.
//
//   4. triggerBackgroundReconcile(): fire-and-forget similar, con slot cap
//      diferente (MAX_RECONCILES=3). Stampa los 4 campos de timing en
//      bggSync para evitar re-trigger inmediato.
//
// Casing: User.bggUsername se guarda case-preserved, BggPlay.bggUsername se
// normaliza a lowercase. Los reads y updates a User usan collation
// strength=2 para matchear case-insensitive (memory: feedback-bgg-username-case).

const BggPlay = require("../../models/BggPlay");
const BggCollection = require("../../models/BggCollection");
const BggUserGame = require("../../models/BggUserGame");
const User = require("../../models/User");
const logger = require("../../utils/logger");
const { computePlayHash } = require("../../utils/bggHash");
const {
  withUserLock,
  sleep,
  tryAcquireProbeSlot,
  releaseProbeSlot,
  tryAcquireReconcileSlot,
  releaseReconcileSlot,
} = require("../../utils/bggSync");
const { clearL1Cache } = require("./bggCache");
const { parsePlaysXml } = require("./bggParse");
const { BGG_API, fetchBgg, resolveGamesBatch } = require("./bggResolve");

// Tunables — quedan acá para que tests puedan re-importarlos y assert
// contra los mismos valores que produce el módulo.
const PROBE_THROTTLE_MS = 5 * 60 * 1000; // legacy: throttle de background probes. Ya NO es el gate de /partidas (ahora unificado a AUTO_REFRESH_STALE_MS). triggerBackgroundProbe sigue disponible como primitiva.
const FULL_RECONCILE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días entre full reconciles periódicos
const SYNC_MAX_PAGES = 200; // safety cap: ~6000 plays (BGG sirve 30/page)
const RECONCILE_INTER_PAGE_MS = 500; // throttle inter-página en background
const AUTO_REFRESH_STALE_MS = 3 * 60 * 60 * 1000; // 3 h: refresco sincrónico al entrar (dueño/admin)

// Orquesta la invalidación de cache L1 (in-memory) + L2 (Mongo persistente)
// para un usuario. Se llama desde auth/bgg-connect cuando el usuario cambia
// o re-conecta su BGG account, así reads subsiguientes vienen fresh.
//
// Async — los callers deben await para asegurar que las deletes de Mongo
// hayan settled antes del próximo read.
async function clearUserCache(bggUsername) {
  const lower = String(bggUsername).toLowerCase();
  clearL1Cache(bggUsername);
  await Promise.all([
    BggCollection.deleteOne({ bggUsername: lower }),
    BggPlay.deleteMany({ bggUsername: lower }),
    // El cache materializado "Mis juegos" deriva de las dos de arriba — wipe +
    // marca sucia para que se reconstruya de cero en la próxima lectura.
    BggUserGame.deleteMany({ bggUsername: lower }),
    User.updateOne(
      { bggUsername: lower },
      { $set: { "bggSync.userGamesBuiltAt": null } },
      { collation: { locale: "en", strength: 2 } },
    ),
  ]);
}

// Idempotent, non-destructive sync de las partidas de un user con BGG.
// Reemplaza al syncPlaysFull viejo (que wipeaba BggPlay antes del refetch
// — una ventana de inconsistencia que perdía data si BGG fallaba mid-sync).
//
// Walks /plays?username=X&page=N, upserting por playId. Usa el campo `hash`
// almacenado localmente para saltear writes cuando el contenido no cambió.
//
// Options:
//   full        — si false, sale apenas una página entera matchea local
//                 (usado por el drift-detection probe en reconcile dirigido).
//                 Si true, walks every page. Default: false.
//   background  — si true, sleeps RECONCILE_INTER_PAGE_MS entre páginas para
//                 que un user grande no spikee outbound traffic. Default: false.
//
// Delete detection:
//   full=true   — anything local que no se vio en el walk se borra.
//   full=false  — solo borra plays locales cuya date sea estrictamente mayor
//                 que la oldest date vista (boundary conservador: si una BGG
//                 date cae en el borde de la early-exit page, no la borramos).
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
      // else: contenido idéntico, nada que escribir.
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
    // Conservative: solo borra plays estrictamente más nuevas que la oldest
    // date que vimos. Cualquier cosa exactamente en minSeenDate podría caer
    // en el page boundary del early exit; la dejamos para un futuro full
    // reconcile.
    const result = await BggPlay.deleteMany({
      bggUsername: lower,
      date: { $gt: minSeenDate },
      playId: { $nin: seenIds },
    });
    deleted = result.deletedCount || 0;
  }

  return { inserted, updated, deleted, total, pages };
}

// Cheap drift-detection probe. Un request a BGG. Si el `total` count matchea
// el local y los 30 plays más recientes tienen los hashes esperados, estamos
// sync (el caso común). Si no:
//   - count mismatch → delegamos a reconcileFull({ full: false }) que walks
//     páginas hasta encontrar un page boundary ya sincronizado.
//   - count matches pero algunos hashes difieren → upsert solo esas plays
//     (cubre edits in-place sobre plays recientes).
//
// Returns { outcome, inserted, updated, deleted, total } donde outcome es
// 'no_drift' | 'edits_only' | 'reconciled'. Tira en falla de BGG (el caller
// debería stamp el outcome como 'failed').
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

  // Determinamos cuáles plays necesitan write antes de resolver thumbnails
  // (ahorra un BGG request si nada cambió).
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

  // Resolve thumbnails solo para las plays dirty.
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

// Persists el outcome del probe sobre el User doc. Best-effort — falla acá
// no propaga (el probe en sí ya tuvo éxito o falló).
//
// User.bggUsername se guarda case-preserved. BggPlay.bggUsername se normaliza
// lowercase. Los callers pueden pasar cualquier casing, así que matcheamos
// case-insensitive via Mongo collation (memory: feedback-bgg-username-case).
async function stampProbeOutcome(bggUsername, outcome) {
  try {
    const $set = {
      "bggSync.lastProbedAt": new Date(),
      "bggSync.lastProbeOutcome": outcome,
    };
    // no_drift no cambió nada; edits_only/reconciled sí → invalidamos el cache
    // materializado "Mis juegos" para que se reconstruya en la próxima lectura.
    if (outcome === "edits_only" || outcome === "reconciled") {
      $set["bggSync.userGamesBuiltAt"] = null;
    }
    await User.updateOne(
      { bggUsername },
      { $set },
      { collation: { locale: "en", strength: 2 } },
    );
  } catch (err) {
    logger.warn("[bgg/probe] stamp failed", {
      bggUsername,
      error: err.message,
    });
  }
}

// Fire-and-forget probe envuelto con: per-user lock, global slot cap, y
// outcome stamping. No devuelve nada — nunca await desde un request handler.
function triggerBackgroundProbe(bggUsername) {
  if (!tryAcquireProbeSlot()) return;
  withUserLock(bggUsername, () => probe(bggUsername))
    .then((result) => stampProbeOutcome(bggUsername, result.outcome))
    .catch((err) => {
      logger.warn("[bgg/probe] background failed", {
        bggUsername,
        error: err.message,
      });
      return stampProbeOutcome(bggUsername, "failed");
    })
    .finally(() => releaseProbeSlot());
}

// Stampa un full reconcile exitoso sobre el User doc. Best-effort.
// Actualiza los 4 campos de bggSync timing así la próxima visita a /bg-watch
// no re-dispara probe (dentro de PROBE_THROTTLE_MS) ni reconcile periódico
// (dentro de FULL_RECONCILE_INTERVAL_MS).
//
// Match case-insensitive (collation strength 2) — ver stampProbeOutcome.
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
          // Un reconcile completo pudo cambiar partidas → invalidar el cache
          // materializado "Mis juegos".
          "bggSync.userGamesBuiltAt": null,
        },
      },
      { collation: { locale: "en", strength: 2 } },
    );
  } catch (err) {
    logger.warn("[bgg/reconcile] stamp failed", {
      bggUsername,
      error: err.message,
    });
  }
}

// Fire-and-forget full reconcile en background. Usado por autosync en
// bgg-connect (primera vez que un user attachea su BGG account) y por el
// periodic refresh de 30 días (Slice 6). Returns true si el slot se agarró
// y el work se schedulu, false si el global cap está full (en cuyo caso el
// próximo trigger reintentará).
function triggerBackgroundReconcile(bggUsername) {
  if (!tryAcquireReconcileSlot()) return false;
  withUserLock(bggUsername, () =>
    reconcileFull(bggUsername, { full: true, background: true }),
  )
    .then((result) => stampReconcileResult(bggUsername.toLowerCase(), result))
    .catch((err) => {
      logger.warn("[bgg/reconcile] background failed", {
        bggUsername,
        error: err.message,
      });
    })
    .finally(() => releaseReconcileSlot());
  return true;
}

// Decide qué acción de sync corresponde en un read de /partidas, según la
// antigüedad del último probe y quién mira. Función pura (sin I/O) para poder
// testear la tabla de verdad sin Mongo — el route handler ejecuta la acción.
//
//   - Dueño/admin viendo su propio perfil + último probe > 3 h → probe
//     SINCRÓNICO esta request (datos frescos en la misma respuesta). Si además
//     el reconcile completo está vencido (>30 d), se dispara en background
//     (nunca sincrónico: recorre todas las páginas y bloquearía la carga).
//   - Cualquier viewer + último probe > 5 min → background (no bloquea), igual
//     que el comportamiento histórico.
//   - Probe reciente (<5 min) → nada, se sirve de Mongo.
function decidePlaysSyncAction({
  lastProbedAt,
  lastFullSyncAt,
  now,
  viewerIsOwner,
}) {
  // Solo el dueño/admin dispara refrescos. Un no-dueño mirando el perfil NO
  // gatilla nada: la frescura depende de las visitas del propio dueño, el botón
  // manual (?refresh=1) y el reconcile periódico de 30 d.
  if (!viewerIsOwner) return { sync: false, background: null };

  const probeAge = lastProbedAt
    ? now - new Date(lastProbedAt).getTime()
    : Infinity;

  // Un único umbral: a lo sumo un refresco cada AUTO_REFRESH_STALE_MS (3 h).
  // Debajo de eso se sirve de Mongo sin pegarle a BGG. (Antes había además un
  // probe en background cada 5 min que reseteaba lastProbedAt y hacía que el
  // gate de 3 h nunca se alcanzara — esa es la causa del "se actualiza más
  // seguido que 3 h".)
  if (probeAge <= AUTO_REFRESH_STALE_MS) {
    return { sync: false, background: null };
  }

  // Datos viejos (>3 h): probe SINCRÓNICO → datos frescos en esta visita. Si
  // además el reconcile completo está vencido (>30 d), se dispara en background
  // (es pesado, nunca sincrónico — recorre todas las páginas).
  const reconcileOverdue =
    !lastFullSyncAt ||
    now - new Date(lastFullSyncAt).getTime() > FULL_RECONCILE_INTERVAL_MS;
  return { sync: true, background: reconcileOverdue ? "reconcile" : null };
}

module.exports = {
  // Tunables
  PROBE_THROTTLE_MS,
  FULL_RECONCILE_INTERVAL_MS,
  SYNC_MAX_PAGES,
  RECONCILE_INTER_PAGE_MS,
  AUTO_REFRESH_STALE_MS,
  // Cache invalidation
  clearUserCache,
  // Core sync
  reconcileFull,
  probe,
  // Stamping helpers (expuestos para tests y para callers que necesiten
  // stamp manualmente — el handler de /partidas?refresh=1 lo hace)
  stampProbeOutcome,
  stampReconcileResult,
  // Background triggers
  triggerBackgroundProbe,
  triggerBackgroundReconcile,
  // Decisión de sync para reads de /partidas (pura, testeable)
  decidePlaysSyncAction,
};
