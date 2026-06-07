const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggPlayerOverlay = require("../../models/BggPlayerOverlay");
const { createAuthedUser, authHeader } = require("../helpers/auth");

// Seed a play for alice with the given players.
function seedPlay(playId, players, extra = {}) {
  return BggPlay.create({
    bggUsername: "alice",
    playId: String(playId),
    gameId: extra.gameId || "174430",
    gameName: extra.gameName || "Gloomhaven",
    date: extra.date || "2026-01-01",
    players,
    hash: `h${playId}`,
    ...extra,
  });
}

describe("GET /api/bgg/jugadores/:bggUsername/:playerKey — detalle de co-jugador", () => {
  it("403 si un usuario ajeno (no dueño/admin) lo pide", async () => {
    await createAuthedUser({ bggUsername: "alice" });
    const { token: otherToken } = await createAuthedUser({
      bggUsername: "carol",
    });
    await seedPlay(1, [{ username: "alice" }, { username: "bob" }]);

    const res = await request(app)
      .get(`/api/bgg/jugadores/alice/${  encodeURIComponent("k:u:bob")}`)
      .set(authHeader(otherToken));

    expect(res.status).toBe(403);
  });

  it("devuelve H2H, stats y partidas para un co-jugador por username", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    await seedPlay(1, [
      { username: "alice", win: true },
      { username: "bob", win: false },
    ]);
    await seedPlay(
      2,
      [
        { username: "alice", win: false },
        { username: "bob", win: true },
      ],
      { date: "2026-02-01" },
    );
    // Partida sin bob — no debe contar.
    await seedPlay(3, [{ username: "alice", win: true }], {
      date: "2026-03-01",
    });

    const res = await request(app)
      .get(`/api/bgg/jugadores/alice/${  encodeURIComponent("k:u:bob")}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.player.username).toBe("bob");
    expect(res.body.h2h).toMatchObject({
      ownerWins: 1,
      playerWins: 1,
      draws: 0,
    });
    expect(res.body.stats.total).toBe(2);
    expect(res.body.total).toBe(2);
    expect(res.body.plays).toHaveLength(2);
    // Orden por fecha desc.
    expect(res.body.plays[0].date).toBe("2026-02-01");
  });

  it("marca isLinked + linkedUser cuando el co-jugador es miembro TurnoCero", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    await createAuthedUser({ bggUsername: "bob", displayName: "Bob" });
    await seedPlay(1, [{ username: "alice" }, { username: "bob", name: "Bob" }]);

    const res = await request(app)
      .get(`/api/bgg/jugadores/alice/${  encodeURIComponent("k:u:bob")}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.player.isLinked).toBe(true);
    expect(res.body.player.linkedUser).toBeTruthy();
    expect(res.body.player.linkedUser.displayName).toBe("Bob");
  });

  it("funciona para un jugador cargado solo por nombre (sin username)", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    await seedPlay(1, [
      { username: "alice", win: false },
      { name: "Tía Marta", username: "" },
    ]);

    const res = await request(app)
      .get(
        `/api/bgg/jugadores/alice/${  encodeURIComponent("k:n:tía marta")}`,
      )
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.player.name).toBe("Tía Marta");
    expect(res.body.player.isLinked).toBe(false);
    expect(res.body.stats.total).toBe(1);
  });

  it("resuelve un overlay fusionado (o:<id>) y suma todas sus identidades", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    const overlay = await BggPlayerOverlay.create({
      ownerUsername: "alice",
      rawKeys: ["u:bob", "n:bobby"],
      nameOverride: "Roberto",
    });
    await seedPlay(1, [{ username: "alice" }, { username: "bob" }]);
    await seedPlay(2, [{ username: "alice" }, { name: "Bobby", username: "" }], {
      date: "2026-02-01",
    });

    const res = await request(app)
      .get(
        `/api/bgg/jugadores/alice/${ 
          encodeURIComponent(`o:${overlay._id}`)}`,
      )
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.player.name).toBe("Roberto");
    expect(res.body.stats.total).toBe(2);
  });

  it("expande un single-key reclamado por un overlay (fusión) vía k:", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    await BggPlayerOverlay.create({
      ownerUsername: "alice",
      rawKeys: ["u:bob", "n:bobby"],
    });
    await seedPlay(1, [{ username: "alice" }, { username: "bob" }]);
    await seedPlay(2, [{ username: "alice" }, { name: "Bobby", username: "" }], {
      date: "2026-02-01",
    });

    const res = await request(app)
      .get(`/api/bgg/jugadores/alice/${  encodeURIComponent("k:u:bob")}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBe(2);
  });

  it("404 para un overlay inexistente", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    const res = await request(app)
      .get(`/api/bgg/jugadores/alice/${  encodeURIComponent("o:64b0000000000000000000aa")}`)
      .set(authHeader(token));
    expect(res.status).toBe(404);
  });

  it("pagina las partidas", async () => {
    const { token } = await createAuthedUser({ bggUsername: "alice" });
    for (let i = 1; i <= 12; i++) {
      await seedPlay(i, [{ username: "alice" }, { username: "bob" }], {
        date: `2026-01-${String(i).padStart(2, "0")}`,
      });
    }

    const res = await request(app)
      .get(`/api/bgg/jugadores/alice/${  encodeURIComponent("k:u:bob")}`)
      .query({ page: 2 })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.page).toBe(2);
    expect(res.body.plays).toHaveLength(2); // 12 - 10
  });
});
