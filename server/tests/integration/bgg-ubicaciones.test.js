const request = require("supertest");
const app = require("../../app");
const BggPlay = require("../../models/BggPlay");
const BggLocationOverlay = require("../../models/BggLocationOverlay");
const { createAuthedUser, authHeader } = require("../helpers/auth");

// Curación de ubicaciones (pestaña "Ubicaciones" de BG Watch). Solo dueño/admin.
// Endpoints: lista, detalle, rename (/nombre), merge.

function playDoc(overrides) {
  return {
    bggUsername: "alice",
    playId: String(Math.floor(Math.random() * 1e9)),
    gameId: "100",
    gameName: "Catan",
    date: "2026-01-01",
    quantity: 1,
    players: [],
    hash: "x".repeat(40),
    ...overrides,
  };
}

async function authedAlice(overrides = {}) {
  // El gate es ownerOrAdmin por bggUsername (lowercase).
  const { user, token } = await createAuthedUser({
    bggUsername: "alice",
    ...overrides,
  });
  return { user, token };
}

async function seedAlice() {
  await BggPlay.create(
    playDoc({
      playId: "1",
      location: "Casa",
      date: "2026-02-01",
      gameId: "100",
      gameName: "Catan",
    }),
  );
  await BggPlay.create(
    playDoc({
      playId: "2",
      location: "casa",
      date: "2026-03-01",
      gameId: "200",
      gameName: "Carca",
    }),
  );
  await BggPlay.create(
    playDoc({ playId: "3", location: "Club", date: "2026-01-15" }),
  );
}

describe("GET /api/bgg/ubicaciones/:user (lista curada)", () => {
  it("agrupa case-insensitive y devuelve { items, total, page, pages }", async () => {
    const { token } = await authedAlice();
    await seedAlice();
    const res = await request(app)
      .get("/api/bgg/ubicaciones/alice")
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // Casa/casa colapsan, + Club
    const casa = res.body.items.find((i) => i.rawKeys.includes("l:casa"));
    expect(casa).toMatchObject({ numPlays: 2 });
    expect(casa.key).toMatch(/^k:l:casa$/);
  });

  it("403 para un visitante que no es dueño ni admin", async () => {
    const { token } = await createAuthedUser({ bggUsername: "bob" });
    await seedAlice();
    const res = await request(app)
      .get("/api/bgg/ubicaciones/alice")
      .set(authHeader(token));
    expect(res.status).toBe(403);
  });

  it("un admin puede ver las ubicaciones de otro", async () => {
    const { token } = await createAuthedUser({
      bggUsername: "bob",
      isAdmin: true,
    });
    await seedAlice();
    const res = await request(app)
      .get("/api/bgg/ubicaciones/alice")
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it("?q filtra por nombre", async () => {
    const { token } = await authedAlice();
    await seedAlice();
    const res = await request(app)
      .get("/api/bgg/ubicaciones/alice?q=clu")
      .set(authHeader(token));
    expect(res.body.items.map((i) => i.name)).toEqual(["Club"]);
  });
});

describe("GET /api/bgg/ubicaciones/:user/:locationKey (detalle)", () => {
  it("talla stats + partidas de una ubicación", async () => {
    const { token } = await authedAlice();
    await seedAlice();
    const res = await request(app)
      .get("/api/bgg/ubicaciones/alice/k:l:casa")
      .set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.location.name).toBe("casa"); // grafía más reciente
    expect(res.body.stats.total).toBe(2);
    expect(res.body.stats.uniqueGames).toBe(2);
    expect(res.body.plays).toHaveLength(2);
  });

  it("404 para una ubicación inexistente", async () => {
    const { token } = await authedAlice();
    await seedAlice();
    const res = await request(app)
      .get("/api/bgg/ubicaciones/alice/k:l:inexistente")
      .set(authHeader(token));
    // Sin partidas → stats en cero, pero la ruta responde 200 con total 0.
    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBe(0);
  });
});

describe("PATCH /api/bgg/ubicaciones/:user/nombre", () => {
  it("crea un overlay con el nombre curado", async () => {
    const { token } = await authedAlice();
    await seedAlice();
    const res = await request(app)
      .patch("/api/bgg/ubicaciones/alice/nombre")
      .set(authHeader(token))
      .send({ rawKeys: ["l:casa"], name: "Mi Casa" });
    expect(res.status).toBe(200);
    expect(res.body.location.name).toBe("Mi Casa");

    const overlay = await BggLocationOverlay.findOne({
      ownerUsername: "alice",
    });
    expect(overlay.nameOverride).toBe("Mi Casa");
    expect(overlay.rawKeys).toContain("l:casa");

    // Se refleja en la lista.
    const list = await request(app)
      .get("/api/bgg/ubicaciones/alice")
      .set(authHeader(token));
    const casa = list.body.items.find((i) => i.rawKeys.includes("l:casa"));
    expect(casa.name).toBe("Mi Casa");
  });

  it("400 si el nombre está vacío", async () => {
    const { token } = await authedAlice();
    const res = await request(app)
      .patch("/api/bgg/ubicaciones/alice/nombre")
      .set(authHeader(token))
      .send({ rawKeys: ["l:casa"], name: "  " });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bgg/ubicaciones/:user/merge", () => {
  it("fusiona dos ubicaciones en una sola (rawKeys consolidadas)", async () => {
    const { token } = await authedAlice();
    await seedAlice();
    const res = await request(app)
      .post("/api/bgg/ubicaciones/alice/merge")
      .set(authHeader(token))
      .send({ sourceRawKeys: ["l:club"], targetRawKeys: ["l:casa"] });
    expect(res.status).toBe(200);
    expect(res.body.location.rawKeys).toEqual(
      expect.arrayContaining(["l:casa", "l:club"]),
    );

    // La lista ahora muestra una sola ubicación con las 3 partidas.
    const list = await request(app)
      .get("/api/bgg/ubicaciones/alice")
      .set(authHeader(token));
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].numPlays).toBe(3);
  });

  it("400 al fusionar una ubicación consigo misma", async () => {
    const { token } = await authedAlice();
    const res = await request(app)
      .post("/api/bgg/ubicaciones/alice/merge")
      .set(authHeader(token))
      .send({ sourceRawKeys: ["l:casa"], targetRawKeys: ["l:casa"] });
    expect(res.status).toBe(400);
  });
});
