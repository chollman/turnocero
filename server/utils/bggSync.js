// Coordination primitives for the BGG plays sync engine.
//
// These exist so multiple concurrent triggers — e.g. several browser tabs
// hitting `/api/bgg/partidas/:user`, a `?refresh=1` racing with the probe's
// fire-and-forget, or the periodic 30-day reconcile — never overlap for the
// same user, and the total number of background syncs across the server is
// bounded.
//
//   withUserLock(key, fn)            — per-user mutex
//   tryAcquireReconcileSlot/release  — global cap of 3 reconciles
//   tryAcquireProbeSlot/release      — global cap of 10 probes
//   sleep(ms)                         — used for inter-page throttling in
//                                       background reconciles

const MAX_RECONCILES = 3;
const MAX_PROBES = 10;

const inFlight = new Map(); // key (lowercase bggUsername) → Promise

let activeReconciles = 0;
let activeProbes = 0;

// Runs `fn()` under a per-key mutex. If a promise is already in flight for
// this key, all callers receive the same promise (they share the result).
// The entry is removed once the promise settles, so the next call for the
// same key starts a fresh run.
//
// Intentionally has no TTL: the underlying work (a BGG fetch) is expected
// to either resolve in reasonable time or throw on network timeout. A TTL
// here would risk releasing the lock while the original work is still
// running, which would defeat the whole purpose.
function withUserLock(key, fn) {
  const k = String(key).toLowerCase();
  const pending = inFlight.get(k);
  if (pending) return pending;

  // Invoke fn synchronously so callers can observe side-effects (the
  // function is "running" the moment we return). A synchronous throw is
  // caught and converted to a rejected promise.
  let promise;
  try {
    promise = Promise.resolve(fn());
  } catch (err) {
    promise = Promise.reject(err);
  }
  inFlight.set(k, promise);
  // Use .then(onFulfilled, onRejected) instead of .finally so the cleanup
  // chain doesn't produce an unhandled rejection when fn() throws — the
  // original `promise` is what callers await, this branch is fire-and-forget.
  const cleanup = () => { if (inFlight.get(k) === promise) inFlight.delete(k); };
  promise.then(cleanup, cleanup);
  return promise;
}

function tryAcquireReconcileSlot() {
  if (activeReconciles >= MAX_RECONCILES) return false;
  activeReconciles++;
  return true;
}

function releaseReconcileSlot() {
  if (activeReconciles > 0) activeReconciles--;
}

function tryAcquireProbeSlot() {
  if (activeProbes >= MAX_PROBES) return false;
  activeProbes++;
  return true;
}

function releaseProbeSlot() {
  if (activeProbes > 0) activeProbes--;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exposed for tests only — production code should not depend on these.
function _resetForTests() {
  inFlight.clear();
  activeReconciles = 0;
  activeProbes = 0;
}

function _stats() {
  return { inFlight: inFlight.size, activeReconciles, activeProbes };
}

module.exports = {
  withUserLock,
  tryAcquireReconcileSlot,
  releaseReconcileSlot,
  tryAcquireProbeSlot,
  releaseProbeSlot,
  sleep,
  MAX_RECONCILES,
  MAX_PROBES,
  _resetForTests,
  _stats,
};
