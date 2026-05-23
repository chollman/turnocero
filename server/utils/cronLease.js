// Helper para correr un job bajo lease distribuido (Mongo TTL doc).
// Garantiza que entre N instancias del server corriendo el mismo cron, solo
// una ejecuta el job por tick. Las otras reciben `acquired: false` y skipean.
//
// Patrón de uso:
//
//   const { withLease } = require("../utils/cronLease");
//   cron.schedule("0 * * * *", async () => {
//     const result = await withLease("myJob", async () => {
//       return await myJob.runOnce();
//     });
//     if (!result.acquired) return; // otra instancia lo agarró
//     logger.info("[myJob] done", result.value);
//   });
//
// Notas:
//   - `leaseMs` es el TTL del lock. Default 5 min. Si el job puede tardar
//     más, aumentalo — un lease que vence mientras el job sigue corriendo
//     permite que otra instancia lo agarre y procese duplicado.
//   - El lease se borra explícitamente al terminar (success o failure)
//     para no bloquear el próximo tick si terminó rápido. El TTL es solo
//     red de seguridad si el proceso muere mid-job.
//   - El acquire usa `findOneAndUpdate` con condición compuesta para que
//     sea atómico — un único document.update sin race.

const os = require("os");
const CronLease = require("../models/CronLease");

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const HOSTNAME = os.hostname();

async function tryAcquire(name, leaseMs) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);
  try {
    // Atomic: upsert si nadie tiene el lease O el que lo tiene ya venció.
    const result = await CronLease.findOneAndUpdate(
      {
        name,
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      {
        $set: {
          name,
          expiresAt,
          holder: `${HOSTNAME}:${process.pid}`,
          acquiredAt: now,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return result;
  } catch (err) {
    // Duplicate key (E11000): otra instancia lo agarró un microsegundo
    // antes que nosotros. Devolver null, el caller skip.
    if (err.code === 11000) return null;
    throw err;
  }
}

async function releaseLease(name, holder) {
  try {
    await CronLease.deleteOne({ name, holder });
  } catch {
    /* best-effort — si falla queda el TTL como red de seguridad */
  }
}

/**
 * Corre `fn()` bajo lease distribuido. Devuelve `{ acquired: true, value }`
 * si pudo agarrar el lock y ejecutó (con el return value de fn), o
 * `{ acquired: false }` si otra instancia ya lo tenía.
 *
 * Errores dentro de `fn` SÍ se propagan al caller — el lease se libera
 * antes de re-throw.
 */
async function withLease(name, fn, { leaseMs = DEFAULT_LEASE_MS } = {}) {
  const lease = await tryAcquire(name, leaseMs);
  if (!lease) return { acquired: false };
  const holder = lease.holder;
  try {
    const value = await fn();
    return { acquired: true, value };
  } finally {
    await releaseLease(name, holder);
  }
}

module.exports = { withLease, tryAcquire, releaseLease, DEFAULT_LEASE_MS };
