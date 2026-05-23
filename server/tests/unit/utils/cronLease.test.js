const CronLease = require("../../../models/CronLease");
const { withLease, tryAcquire } = require("../../../utils/cronLease");

beforeEach(async () => {
  // Aunque tests/setup.js hace deleteMany por afterEach, en algunos casos
  // ya empezó el siguiente test antes del wipe — limpiamos defensivamente.
  await CronLease.deleteMany({});
});

describe("withLease", () => {
  it("ejecuta fn y devuelve { acquired: true, value }", async () => {
    const fn = vi.fn(async () => "ok");
    const result = await withLease("job1", fn);
    expect(result).toEqual({ acquired: true, value: "ok" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("borra el lease al terminar exitosamente", async () => {
    await withLease("job-cleanup", async () => "done");
    const remaining = await CronLease.findOne({ name: "job-cleanup" });
    expect(remaining).toBeNull();
  });

  it("dos calls concurrentes — solo uno gana el lease", async () => {
    // Tomar el lease ANTES del segundo call (resolve nunca = job nunca termina,
    // así el lease se queda activo).
    let releaseFirst;
    const firstPromise = withLease("contended", async () => {
      await new Promise((r) => {
        releaseFirst = r;
      });
      return "first";
    });

    // Esperar un tick para que el primer call haya hecho el findOneAndUpdate.
    await new Promise((r) => {
      setImmediate(r);
    });

    const secondResult = await withLease("contended", async () => "second");
    expect(secondResult).toEqual({ acquired: false });

    // Liberar el primero.
    releaseFirst();
    const firstResult = await firstPromise;
    expect(firstResult).toEqual({ acquired: true, value: "first" });
  });

  it("libera el lease incluso si fn tira", async () => {
    await expect(
      withLease("erroring", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const remaining = await CronLease.findOne({ name: "erroring" });
    expect(remaining).toBeNull();
  });

  it("respeta leaseMs en el expiresAt persistido", async () => {
    let captured = null;
    await withLease(
      "with-ttl",
      async () => {
        captured = await CronLease.findOne({ name: "with-ttl" });
      },
      { leaseMs: 10 * 60 * 1000 },
    );
    const expiresIn = captured.expiresAt.getTime() - captured.acquiredAt.getTime();
    expect(expiresIn).toBeGreaterThanOrEqual(9 * 60 * 1000);
    expect(expiresIn).toBeLessThanOrEqual(11 * 60 * 1000);
  });

  it("tras expiry del lease, otro caller puede agarrarlo", async () => {
    // Crear lease ya vencido manualmente.
    await CronLease.create({
      name: "expired",
      expiresAt: new Date(Date.now() - 1000),
      holder: "ghost",
    });

    const acquired = await tryAcquire("expired", 60 * 1000);
    expect(acquired).not.toBeNull();
    expect(acquired.holder).not.toBe("ghost");
  });
});

describe("tryAcquire", () => {
  it("graba holder con hostname:pid", async () => {
    const lease = await tryAcquire("holder-test", 60 * 1000);
    expect(lease.holder).toMatch(/:\d+$/); // "hostname:pid"
  });
});
