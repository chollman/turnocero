const User = require("../../../../models/User");
const {
  MANUAL_REFRESH_COOLDOWN_MS,
  getManualRefreshRemainingMs,
  stampManualRefresh,
} = require("../../../../services/bgg/bggCooldown");

async function makeUser(overrides = {}) {
  return User.create({
    username: `u${Math.floor(Math.random() * 1e9)}`,
    email: `${Math.random()}@x.com`,
    password: "Passw0rd!aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    isVerified: true,
    bggUsername: "alice",
    ...overrides,
  });
}

describe("getManualRefreshRemainingMs", () => {
  it("devuelve 0 si bggUsername es vacío/null", async () => {
    expect(await getManualRefreshRemainingMs("", "partidas")).toBe(0);
    expect(await getManualRefreshRemainingMs(null, "partidas")).toBe(0);
  });

  it("devuelve 0 si no hay user con ese bggUsername", async () => {
    expect(await getManualRefreshRemainingMs("nadie", "partidas")).toBe(0);
  });

  it("devuelve 0 si el user nunca refrescó (sin stamp)", async () => {
    await makeUser();
    expect(await getManualRefreshRemainingMs("alice", "partidas")).toBe(0);
  });

  it("devuelve ms restantes si el stamp es reciente", async () => {
    await makeUser({
      bggSync: {
        lastManualRefreshPartidasAt: new Date(Date.now() - 30000), // 30s atrás
      },
    });
    const remaining = await getManualRefreshRemainingMs("alice", "partidas");
    expect(remaining).toBeGreaterThan(28000);
    expect(remaining).toBeLessThanOrEqual(MANUAL_REFRESH_COOLDOWN_MS);
  });

  it("devuelve 0 si el stamp ya expiró (>60s)", async () => {
    await makeUser({
      bggSync: {
        lastManualRefreshPartidasAt: new Date(Date.now() - 90 * 1000), // 90s atrás
      },
    });
    expect(await getManualRefreshRemainingMs("alice", "partidas")).toBe(0);
  });

  it("es case-insensitive (collation strength 2)", async () => {
    await makeUser({
      bggUsername: "MixedCase",
      bggSync: {
        lastManualRefreshPartidasAt: new Date(Date.now() - 10000),
      },
    });
    // input lowercase debe matchear MixedCase.
    const remaining = await getManualRefreshRemainingMs(
      "mixedcase",
      "partidas",
    );
    expect(remaining).toBeGreaterThan(0);
  });

  it("respeta el panel: partidas y coleccion son cooldowns independientes", async () => {
    await makeUser({
      bggSync: {
        lastManualRefreshPartidasAt: new Date(Date.now() - 10000), // 10s atrás
        // sin lastManualRefreshColeccionAt
      },
    });
    expect(
      await getManualRefreshRemainingMs("alice", "partidas"),
    ).toBeGreaterThan(0);
    expect(await getManualRefreshRemainingMs("alice", "coleccion")).toBe(0);
  });
});

describe("stampManualRefresh", () => {
  it("setea el field específico del panel", async () => {
    const u = await makeUser();
    await stampManualRefresh("alice", "partidas");
    const refreshed = await User.findById(u._id);
    expect(refreshed.bggSync?.lastManualRefreshPartidasAt).toBeInstanceOf(Date);
    expect(refreshed.bggSync?.lastManualRefreshColeccionAt).toBeFalsy();
  });

  it("no toca el otro panel", async () => {
    const u = await makeUser({
      bggSync: {
        lastManualRefreshColeccionAt: new Date("2020-01-01"),
      },
    });
    await stampManualRefresh("alice", "partidas");
    const refreshed = await User.findById(u._id);
    expect(
      refreshed.bggSync.lastManualRefreshColeccionAt.toISOString(),
    ).toMatch(/^2020-01-01/);
    expect(refreshed.bggSync.lastManualRefreshPartidasAt).toBeInstanceOf(Date);
  });

  it("es case-insensitive en el update", async () => {
    const u = await makeUser({ bggUsername: "MixedCase" });
    await stampManualRefresh("mixedcase", "partidas");
    const refreshed = await User.findById(u._id);
    expect(refreshed.bggSync?.lastManualRefreshPartidasAt).toBeInstanceOf(Date);
  });

  it("no tira si bggUsername es vacío", async () => {
    await expect(stampManualRefresh("", "partidas")).resolves.toBeUndefined();
    await expect(stampManualRefresh(null, "partidas")).resolves.toBeUndefined();
  });
});
