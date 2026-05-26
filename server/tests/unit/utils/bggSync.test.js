const {
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
} = require("../../../utils/bggSync");

function defer() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("utils/bggSync", () => {
  beforeEach(() => {
    _resetForTests();
  });

  // ── withUserLock ───────────────────────────────────────────────
  describe("withUserLock", () => {
    it("resolves with fn return value", async () => {
      const res = await withUserLock("alice", () => 42);
      expect(res).toBe(42);
    });

    it("lowercases the key", async () => {
      const d = defer();
      const fn = vi.fn(() => d.promise);
      const p1 = withUserLock("Alice", fn);
      const p2 = withUserLock("ALICE", fn);
      const p3 = withUserLock("alice", fn);
      d.resolve("ok");
      await Promise.all([p1, p2, p3]);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("reuses the in-flight promise for concurrent calls on the same key", async () => {
      const d = defer();
      const fn = vi.fn(() => d.promise);

      const p1 = withUserLock("bob", fn);
      const p2 = withUserLock("bob", fn);
      const p3 = withUserLock("bob", fn);

      d.resolve("shared");
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(r1).toBe("shared");
      expect(r2).toBe("shared");
      expect(r3).toBe("shared");
    });

    it("runs concurrent calls on different keys in parallel", async () => {
      const dA = defer();
      const dB = defer();
      const fnA = vi.fn(() => dA.promise);
      const fnB = vi.fn(() => dB.promise);

      const pA = withUserLock("ana", fnA);
      const pB = withUserLock("beto", fnB);

      // Both invocations happen immediately, before either resolves.
      expect(fnA).toHaveBeenCalledTimes(1);
      expect(fnB).toHaveBeenCalledTimes(1);

      dA.resolve("a");
      dB.resolve("b");
      await expect(pA).resolves.toBe("a");
      await expect(pB).resolves.toBe("b");
    });

    it("releases the lock after the promise resolves so subsequent calls start fresh", async () => {
      const fn = vi
        .fn()
        .mockResolvedValueOnce("first")
        .mockResolvedValueOnce("second");
      await withUserLock("cris", fn);
      await withUserLock("cris", fn);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("releases the lock after the promise rejects", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce("recovered");

      await expect(withUserLock("dani", fn)).rejects.toThrow("boom");
      await expect(withUserLock("dani", fn)).resolves.toBe("recovered");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("rejects all waiters when the in-flight promise rejects", async () => {
      const d = defer();
      const fn = () => d.promise;

      const p1 = withUserLock("eva", fn);
      const p2 = withUserLock("eva", fn);

      d.reject(new Error("shared failure"));
      await expect(p1).rejects.toThrow("shared failure");
      await expect(p2).rejects.toThrow("shared failure");
    });

    it("handles fn that throws synchronously (turns it into a rejected promise)", async () => {
      const fn = () => {
        throw new Error("sync throw");
      };
      await expect(withUserLock("feli", fn)).rejects.toThrow("sync throw");
      // Lock should be released — next call must invoke fn again.
      const fn2 = vi.fn().mockResolvedValue("ok");
      await expect(withUserLock("feli", fn2)).resolves.toBe("ok");
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  // ── reconcile slots ─────────────────────────────────────────────
  describe("reconcile slots", () => {
    it("acquires up to MAX_RECONCILES then refuses", () => {
      for (let i = 0; i < MAX_RECONCILES; i++) {
        expect(tryAcquireReconcileSlot()).toBe(true);
      }
      expect(tryAcquireReconcileSlot()).toBe(false);
      expect(_stats().activeReconciles).toBe(MAX_RECONCILES);
    });

    it("release frees a slot for re-acquisition", () => {
      for (let i = 0; i < MAX_RECONCILES; i++) tryAcquireReconcileSlot();
      expect(tryAcquireReconcileSlot()).toBe(false);
      releaseReconcileSlot();
      expect(tryAcquireReconcileSlot()).toBe(true);
    });

    it("release is safe to call when the counter is already 0", () => {
      releaseReconcileSlot();
      releaseReconcileSlot();
      expect(_stats().activeReconciles).toBe(0);
      // Still works normally afterward.
      expect(tryAcquireReconcileSlot()).toBe(true);
    });
  });

  // ── probe slots ─────────────────────────────────────────────────
  describe("probe slots", () => {
    it("acquires up to MAX_PROBES then refuses", () => {
      for (let i = 0; i < MAX_PROBES; i++) {
        expect(tryAcquireProbeSlot()).toBe(true);
      }
      expect(tryAcquireProbeSlot()).toBe(false);
      expect(_stats().activeProbes).toBe(MAX_PROBES);
    });

    it("release frees a slot for re-acquisition", () => {
      for (let i = 0; i < MAX_PROBES; i++) tryAcquireProbeSlot();
      expect(tryAcquireProbeSlot()).toBe(false);
      releaseProbeSlot();
      expect(tryAcquireProbeSlot()).toBe(true);
    });

    it("reconcile and probe slots are independent", () => {
      for (let i = 0; i < MAX_RECONCILES; i++) tryAcquireReconcileSlot();
      expect(tryAcquireReconcileSlot()).toBe(false);
      // Probes are unaffected.
      expect(tryAcquireProbeSlot()).toBe(true);
      expect(_stats().activeProbes).toBe(1);
    });
  });

  // ── sleep ───────────────────────────────────────────────────────
  describe("sleep", () => {
    it("resolves after the specified delay", async () => {
      vi.useFakeTimers();
      try {
        const p = sleep(500);
        let resolved = false;
        p.then(() => {
          resolved = true;
        });

        await vi.advanceTimersByTimeAsync(499);
        expect(resolved).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        expect(resolved).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("resolves with undefined", async () => {
      vi.useFakeTimers();
      try {
        const p = sleep(10);
        await vi.advanceTimersByTimeAsync(10);
        await expect(p).resolves.toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
