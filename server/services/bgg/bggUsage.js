// Tracker de uso de BGG. Dos señales:
//
//  1. Lecturas salientes (alto volumen): cada llamada a `fetchBgg` invoca
//     `noteRead(url)`, que incrementa un contador en memoria atado al
//     request vía AsyncLocalStorage. Al terminar la respuesta, el middleware
//     `bggUsageContext` llama `flushReads(ctx, userId)` y vuelca todo en un
//     único upsert sobre `BggUsageDaily`. Así no escribimos a Mongo por cada
//     llamada y resolvemos que `fetchBgg` no conoce al usuario que la disparó
//     (el store lo provee el ALS, el userId se lee del request al cerrar).
//
//  2. Mutaciones (bajo volumen): las rutas POST/PUT/DELETE de partidas y el
//     sync llaman `recordMutation` / `recordSync` directamente — son acciones
//     explícitas y autenticadas, así que las registramos de una.
//
// Nada de esto debe romper jamás una acción del usuario ni una lectura: todo
// va envuelto en try/catch y loguea un warn ante fallo, nunca propaga.

const { AsyncLocalStorage } = require("async_hooks");
const BggUsageDaily = require("../../models/BggUsageDaily");
const BggUsageEvent = require("../../models/BggUsageEvent");
const { dayKeyAR } = require("../../utils/dayKey");
const logger = require("../../utils/logger");

const usageStore = new AsyncLocalStorage();

// Clasifica una URL de la XML API de BGG en uno de los buckets conocidos.
// Pura y exportada para test.
function classifyEndpoint(url = "") {
  const u = String(url);
  if (u.includes("/search")) return "search";
  if (u.includes("/thing")) return "thing";
  if (u.includes("/collection")) return "collection";
  if (u.includes("/plays")) return "plays";
  return "other";
}

function createUsageContext() {
  return { reads: 0, byEndpoint: {} };
}

function runWithUsageContext(ctx, fn) {
  return usageStore.run(ctx, fn);
}

// Llamado desde fetchBgg. No-op si no hay request context (jobs en background,
// crons) — esas lecturas no se atribuyen a ningún usuario a propósito.
function noteRead(url) {
  const ctx = usageStore.getStore();
  if (!ctx) return;
  ctx.reads += 1;
  const ep = classifyEndpoint(url);
  ctx.byEndpoint[ep] = (ctx.byEndpoint[ep] || 0) + 1;
}

const MUT_FIELD = { create: "created", edit: "edited", delete: "deleted" };

async function flushReads(ctx, userId) {
  if (!ctx || ctx.reads <= 0) return;
  try {
    const inc = { reads: ctx.reads };
    for (const [k, v] of Object.entries(ctx.byEndpoint)) {
      inc[`readsByEndpoint.${k}`] = v;
    }
    await BggUsageDaily.updateOne(
      { day: dayKeyAR(), userId: userId || null },
      { $inc: inc },
      { upsert: true },
    );
  } catch (err) {
    logger.warn("[bggUsage] flushReads failed", { error: err.message });
  }
}

// Registra una mutación (alta/edición/borrado) de partida: un doc itemizado
// en BggUsageEvent + el contador agregado del día en BggUsageDaily.
async function recordMutation(user, action, fields = {}) {
  if (!user || !user._id || !MUT_FIELD[action]) return;
  try {
    const userId = user._id;
    const bggUsername = (user.bggUsername || "").toLowerCase();
    await Promise.all([
      BggUsageEvent.create({
        userId,
        bggUsername,
        action,
        playId: fields.playId != null ? String(fields.playId) : null,
        gameId: fields.gameId != null ? String(fields.gameId) : null,
        gameName: fields.gameName || null,
      }),
      BggUsageDaily.updateOne(
        { day: dayKeyAR(), userId },
        { $inc: { [`mutations.${MUT_FIELD[action]}`]: 1 } },
        { upsert: true },
      ),
    ]);
  } catch (err) {
    logger.warn("[bggUsage] recordMutation failed", { error: err.message });
  }
}

async function recordSync(user) {
  if (!user || !user._id) return;
  try {
    await BggUsageDaily.updateOne(
      { day: dayKeyAR(), userId: user._id },
      { $inc: { syncs: 1 } },
      { upsert: true },
    );
  } catch (err) {
    logger.warn("[bggUsage] recordSync failed", { error: err.message });
  }
}

module.exports = {
  usageStore,
  classifyEndpoint,
  createUsageContext,
  runWithUsageContext,
  noteRead,
  flushReads,
  recordMutation,
  recordSync,
};
