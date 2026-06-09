const request = require("supertest");
const app = require("../../app");
const Table = require("../../models/Table");
const Notification = require("../../models/Notification");
const { createUser, createAuthedUser, tokenFor } = require("../helpers/auth");
const { createTable } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

// Enable every section so route-level gating doesn't interfere with payload tests.
async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

describe("POST /api/tables", () => {
  it("creates a public table with the caller as host (empty players)", async () => {
    const { user, token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        location: "BA",
        privacy: "public",
      });
    expect(res.status).toBe(201);
    expect(res.body.host._id).toBe(user._id.toString());
    expect(res.body.players).toEqual([]);
    expect(res.body.status).toBe("open");
    expect(res.body.privacy).toBe("public");
  });

  it("400s on missing required fields", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    const res = await request(app).post("/api/tables").send({});
    expect(res.status).toBe(401);
  });

  it("persists tags and rules when provided", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        privacy: "public",
        tags: ["Estrategia", "120-180min"],
        rules: "Sin alianzas. Llegar 10 min antes.",
      });
    expect(res.status).toBe(201);
    expect(res.body.tags).toEqual(["Estrategia", "120-180min"]);
    expect(res.body.rules).toBe("Sin alianzas. Llegar 10 min antes.");
  });

  it("defaults tags=[] and rules='' when omitted", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(201);
    expect(res.body.tags).toEqual([]);
    expect(res.body.rules).toBe("");
  });

  it("400s when more than 5 tags are sent", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        tags: ["a", "b", "c", "d", "e", "f"],
      });
    expect(res.status).toBe(400);
  });

  it("400s when rules exceed 500 chars", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        rules: "x".repeat(501),
      });
    expect(res.status).toBe(400);
  });

  // ── Tutorial mode (Paso 5 — sección "Andá preparado") ──────────────
  it("default tutorialMode is 'auto' when not provided (retrocompat)", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(201);
    expect(res.body.tutorialMode).toBe("auto");
    expect(res.body.tutorialVideoId).toBeNull();
  });

  it("persists tutorialMode='none' when provided", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        tutorialMode: "none",
      });
    expect(res.status).toBe(201);
    expect(res.body.tutorialMode).toBe("none");
  });

  it("persists tutorialMode='manual' + videoId when both provided", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        tutorialMode: "manual",
        tutorialVideoId: "dQw4w9WgXcQ",
      });
    expect(res.status).toBe(201);
    expect(res.body.tutorialMode).toBe("manual");
    expect(res.body.tutorialVideoId).toBe("dQw4w9WgXcQ");
  });

  it("400s when tutorialMode='manual' without tutorialVideoId", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        tutorialMode: "manual",
      });
    expect(res.status).toBe(400);
  });

  it("400s when tutorialVideoId is malformed", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        tutorialMode: "manual",
        tutorialVideoId: "short",
      });
    expect(res.status).toBe(400);
  });

  it("400s when tutorialMode is not in enum", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        tutorialMode: "bogus",
      });
    expect(res.status).toBe(400);
  });

  it("strips stale videoId when mode is non-manual", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        tutorialMode: "auto",
        tutorialVideoId: "dQw4w9WgXcQ", // se ignora
      });
    expect(res.status).toBe(201);
    expect(res.body.tutorialMode).toBe("auto");
    expect(res.body.tutorialVideoId).toBeNull();
  });

  // ── bgaUrl (Paso 5 — sub-bloque Board Game Arena) ────────────────
  it("defaults bgaUrl to null when not provided", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(201);
    expect(res.body.bgaUrl).toBeNull();
  });

  it("persists a valid bgaUrl from boardgamearena.com", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        bgaUrl: "https://boardgamearena.com/gamepanel?game=catan",
      });
    expect(res.status).toBe(201);
    expect(res.body.bgaUrl).toBe(
      "https://boardgamearena.com/gamepanel?game=catan",
    );
  });

  it("normalizes empty bgaUrl string to null", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        bgaUrl: "",
      });
    expect(res.status).toBe(201);
    expect(res.body.bgaUrl).toBeNull();
  });

  it("400s on bgaUrl from a different domain", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        bgaUrl: "https://otrositio.com/x",
      });
    expect(res.status).toBe(400);
  });

  it("400s on bgaUrl that does not look like a URL", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 7 * 86400000).toISOString(),
        maxPlayers: 4,
        bgaUrl: "not a url",
      });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tables", () => {
  it("upcomingTotal counts only future mesas; total counts both past and future", async () => {
    const host = await createUser();
    await createTable(host, {
      boardGame: "Past mesa",
      date: new Date(Date.now() - 86400000),
    });
    await createTable(host, {
      boardGame: "Future mesa",
      date: new Date(Date.now() + 7 * 86400000),
    });
    const res = await request(app).get("/api/tables");
    expect(res.status).toBe(200);
    // Both mesas listed (past + future are non-cancelled).
    expect(res.body.total).toBe(2);
    // But only the future one is "active" capacity-wise.
    expect(res.body.upcomingTotal).toBe(1);
  });

  it("returns public tables for anon visitors (no private)", async () => {
    const host = await createUser();
    await createTable(host, { boardGame: "Public 1", privacy: "public" });
    await createTable(host, { boardGame: "Private", privacy: "private" });
    const res = await request(app).get("/api/tables");
    expect(res.status).toBe(200);
    expect(res.body.tables.length).toBe(1);
    expect(res.body.tables[0].boardGame).toBe("Public 1");
  });

  it("returns both public and private tables for authenticated users", async () => {
    const host = await createUser();
    await createTable(host, { boardGame: "Public", privacy: "public" });
    await createTable(host, { boardGame: "Private", privacy: "private" });
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get("/api/tables")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.tables.length).toBe(2);
  });

  it("excludes cancelled tables", async () => {
    const host = await createUser();
    const t = await createTable(host);
    t.status = "cancelled";
    await t.save();
    const res = await request(app).get("/api/tables");
    expect(res.body.tables.length).toBe(0);
  });

  it("supports ?search by boardGame substring", async () => {
    const host = await createUser();
    await createTable(host, { boardGame: "Wingspan" });
    await createTable(host, { boardGame: "Catán" });
    const res = await request(app).get("/api/tables?search=wing");
    expect(res.body.tables.length).toBe(1);
    expect(res.body.tables[0].boardGame).toBe("Wingspan");
  });

  it("populates host with avatar (so client <Avatar> works)", async () => {
    const host = await createUser({ username: "thehost" });
    await createTable(host);
    const res = await request(app).get("/api/tables");
    expect(res.body.tables[0].host._id).toBe(host._id.toString());
    expect(res.body.tables[0].host.avatar).toBeDefined();
  });
});

describe("POST /api/tables/:id/join", () => {
  it("public table: directly adds the user", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "public", maxPlayers: 4 });
    const { user, token } = await createAuthedUser();

    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const refreshed = await Table.findById(table._id);
    expect(refreshed.players.map((p) => p.toString())).toContain(
      user._id.toString(),
    );
  });

  it('flips status to "full" when joining the last seat', async () => {
    const host = await createUser();
    const existing = await createUser();
    const table = await createTable(host, {
      privacy: "public",
      maxPlayers: 2,
      players: [existing._id],
    });
    const { token } = await createAuthedUser();

    await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);
    const refreshed = await Table.findById(table._id);
    expect(refreshed.status).toBe("full");
  });

  it("private table: adds to pendingRequests instead of players", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      privacy: "private",
      maxPlayers: 4,
    });
    const { user, token } = await createAuthedUser();

    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const refreshed = await Table.findById(table._id);
    expect(refreshed.players.map((p) => p.toString())).not.toContain(
      user._id.toString(),
    );
    expect(refreshed.pendingRequests.map((p) => p.toString())).toContain(
      user._id.toString(),
    );
  });

  it("private join persists a join_request notif with the requester as actor", async () => {
    await enableAllSections();
    const host = await createUser();
    const table = await createTable(host, {
      privacy: "private",
      maxPlayers: 4,
    });
    const { user, token } = await createAuthedUser();

    await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);

    const notif = await Notification.findOne({
      recipient: host._id,
      type: "join_request",
      tableId: table._id.toString(),
    });
    expect(notif).not.toBeNull();
    expect(notif.actors.length).toBe(1);
    expect(notif.actors[0].userId).toBe(user._id.toString());
  });

  it("400s when the host tries to join their own table", async () => {
    const host = await createUser();
    const table = await createTable(host);
    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(400);
  });

  it("400s when joining a full table", async () => {
    const host = await createUser();
    const p1 = await createUser();
    const p2 = await createUser();
    const table = await createTable(host, {
      maxPlayers: 2,
      players: [p1._id, p2._id],
    });
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("400s when already joined", async () => {
    const host = await createUser();
    const { user, token } = await createAuthedUser();
    const table = await createTable(host, { players: [user._id] });
    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/tables/:id/leave", () => {
  it("removes the caller from players and flips status full → open", async () => {
    const host = await createUser();
    const p1 = await createUser();
    const { user, token } = await createAuthedUser();
    const table = await createTable(host, {
      maxPlayers: 2,
      players: [p1._id, user._id],
    });
    expect(table.status).toBe("full");

    const res = await request(app)
      .post(`/api/tables/${table._id}/leave`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const refreshed = await Table.findById(table._id);
    expect(refreshed.players.map((p) => p.toString())).not.toContain(
      user._id.toString(),
    );
    expect(refreshed.status).toBe("open");
  });
});

describe("GET /api/tables — distance computation", () => {
  // Coords de referencia.
  const obelisco = { lat: -34.6037, lng: -58.3816 };
  const laPlata = { lat: -34.9215, lng: -57.9545 }; // ~56 km del Obelisco
  const rosario = { lat: -32.9442, lng: -60.6505 }; // ~280 km del Obelisco

  async function setupTables() {
    const host = await createUser();
    const t1 = await createTable(host, {
      boardGame: "Catán",
      location: { texto: "Obelisco", ...obelisco },
    });
    const t2 = await createTable(host, {
      boardGame: "Carcassonne",
      location: { texto: "La Plata", ...laPlata },
    });
    const t3 = await createTable(host, {
      boardGame: "Brass",
      location: { texto: "Rosario", ...rosario },
    });
    const t4 = await createTable(host, {
      boardGame: "Wingspan",
      location: { texto: "Sin coords" }, // sin lat/lng
    });
    return { host, t1, t2, t3, t4 };
  }

  it("includes distanceKm for each table when the user has direccion coords", async () => {
    await setupTables();
    const user = await createUser();
    user.direccion = { texto: "Obelisco", ...obelisco };
    await user.save();

    const res = await request(app)
      .get("/api/tables")
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    const byGame = Object.fromEntries(
      res.body.tables.map((t) => [t.boardGame, t.distanceKm]),
    );
    expect(byGame["Catán"]).toBeCloseTo(0, 1);
    expect(byGame.Carcassonne).toBeGreaterThan(50);
    expect(byGame.Carcassonne).toBeLessThan(62);
    expect(byGame.Brass).toBeGreaterThan(270);
    expect(byGame.Brass).toBeLessThan(295);
    expect(byGame.Wingspan).toBeNull(); // sin coords
  });

  it("returns distanceKm: null on all tables when user has no direccion", async () => {
    await setupTables();
    const user = await createUser(); // sin direccion seteada
    const res = await request(app)
      .get("/api/tables")
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    res.body.tables.forEach((t) => expect(t.distanceKm).toBeNull());
  });

  it("filters by ?maxDistanceKm and excludes tables without coords", async () => {
    await setupTables();
    const user = await createUser();
    user.direccion = { texto: "Obelisco", ...obelisco };
    await user.save();

    // Solo Catán (0km) y Carcassonne (~56km) entran dentro de 100km. Brass (~280) y Wingspan (sin coords) afuera.
    const res = await request(app)
      .get("/api/tables")
      .query({ maxDistanceKm: 100 })
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    const games = res.body.tables.map((t) => t.boardGame).sort();
    expect(games).toEqual(["Carcassonne", "Catán"]);
    expect(res.body.total).toBe(2);
  });

  it("ignores ?maxDistanceKm when the user has no direccion (falls back to normal listing)", async () => {
    await setupTables();
    const user = await createUser(); // sin direccion
    const res = await request(app)
      .get("/api/tables")
      .query({ maxDistanceKm: 10 })
      .set("Authorization", `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(200);
    expect(res.body.tables.length).toBe(4); // sin filtro aplicado
  });

  it('treats invalid maxDistanceKm (negative, zero, NaN) as "no filter"', async () => {
    await setupTables();
    const user = await createUser();
    user.direccion = { texto: "Obelisco", ...obelisco };
    await user.save();

    for (const value of [-5, 0, "abc"]) {
      const res = await request(app)
        .get("/api/tables")
        .query({ maxDistanceKm: value })
        .set("Authorization", `Bearer ${tokenFor(user)}`);
      expect(res.status).toBe(200);
      expect(res.body.tables.length).toBe(4);
    }
  });
});

describe("POST /api/tables — location subdocument", () => {
  it("persists location as { texto, lat, lng } when sent as object", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        location: {
          texto: "Av. Corrientes 1234",
          lat: -34.6037,
          lng: -58.3816,
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.location).toEqual({
      texto: "Av. Corrientes 1234",
      lat: -34.6037,
      lng: -58.3816,
    });
  });

  it("normalizes legacy string location to { texto, lat: null, lng: null }", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        location: "Mi casa",
      });
    expect(res.status).toBe(201);
    expect(res.body.location).toEqual({
      texto: "Mi casa",
      lat: null,
      lng: null,
    });
  });

  it("drops invalid coords but keeps texto", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        location: { texto: "Algo", lat: 999, lng: -58.3 }, // lat fuera de rango
      });
    expect(res.status).toBe(201);
    expect(res.body.location.texto).toBe("Algo");
    expect(res.body.location.lat).toBeNull();
    expect(res.body.location.lng).toBeNull();
  });
});

describe("POST /api/tables — fallback a user.direccion cuando no se especifica location", () => {
  it("hereda la direccion del perfil si el host no manda location", async () => {
    const { user, token } = await createAuthedUser();
    user.direccion = {
      texto: "Av. Corrientes 1234, CABA",
      lat: -34.6037,
      lng: -58.3816,
    };
    await user.save();

    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        // sin location
      });
    expect(res.status).toBe(201);
    expect(res.body.location).toEqual({
      texto: "Av. Corrientes 1234, CABA",
      lat: -34.6037,
      lng: -58.3816,
    });
  });

  it("hereda direccion del perfil cuando se manda location vacía", async () => {
    const { user, token } = await createAuthedUser();
    user.direccion = { texto: "Florida 100", lat: -34.6, lng: -58.4 };
    await user.save();

    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        location: { texto: "", lat: null, lng: null },
      });
    expect(res.status).toBe(201);
    expect(res.body.location.texto).toBe("Florida 100");
    expect(res.body.location.lat).toBe(-34.6);
    expect(res.body.location.lng).toBe(-58.4);
  });

  it("NO hereda si el host especificó alguna parte de location", async () => {
    const { user, token } = await createAuthedUser();
    user.direccion = { texto: "Perfil", lat: -34.6, lng: -58.4 };
    await user.save();

    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
        location: { texto: "Bar de Pepe" }, // sin coords pero con texto
      });
    expect(res.status).toBe(201);
    expect(res.body.location.texto).toBe("Bar de Pepe");
    expect(res.body.location.lat).toBeNull();
    expect(res.body.location.lng).toBeNull();
  });

  it("crea mesa sin ubicación si ni el host ni el perfil tienen direccion", async () => {
    const { token } = await createAuthedUser(); // sin direccion
    const res = await request(app)
      .post("/api/tables")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boardGame: "Catán",
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(201);
    expect(res.body.location).toEqual({ texto: "", lat: null, lng: null });
  });
});

describe("PUT /api/tables/:id (host only)", () => {
  it("host can update fields", async () => {
    const host = await createUser();
    const table = await createTable(host, { location: "old" });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
        location: "new place",
        description: "fresh",
      });
    expect(res.status).toBe(200);
    // `location` ahora es un subdocumento { texto, lat, lng }.
    // Strings legacy entrantes se normalizan al nuevo shape.
    expect(res.body.location).toEqual({
      texto: "new place",
      lat: null,
      lng: null,
    });
    expect(res.body.description).toBe("fresh");
  });

  it("non-host gets 403", async () => {
    const host = await createUser();
    const table = await createTable(host);
    const { token } = await createAuthedUser();
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: new Date().toISOString(), maxPlayers: 4 });
    expect(res.status).toBe(403);
  });

  it("partial update of tags and rules", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      tags: ["Estrategia"],
      rules: "Old rules",
    });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
        tags: ["Cooperativo", "Largo"],
        rules: "New rules",
      });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(["Cooperativo", "Largo"]);
    expect(res.body.rules).toBe("New rules");
  });

  it("preserves tags/rules when not sent in PUT body", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      tags: ["Estrategia"],
      rules: "Preserved",
    });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(["Estrategia"]);
    expect(res.body.rules).toBe("Preserved");
  });

  it("updates tutorialMode + clears videoId when switching from manual to auto", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      tutorialMode: "manual",
      tutorialVideoId: "dQw4w9WgXcQ",
    });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
        tutorialMode: "auto",
      });
    expect(res.status).toBe(200);
    expect(res.body.tutorialMode).toBe("auto");
    expect(res.body.tutorialVideoId).toBeNull();
  });

  it("preserves tutorialMode + videoId when not sent in PUT body", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      tutorialMode: "manual",
      tutorialVideoId: "dQw4w9WgXcQ",
    });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(200);
    expect(res.body.tutorialMode).toBe("manual");
    expect(res.body.tutorialVideoId).toBe("dQw4w9WgXcQ");
  });

  it("400s on PUT with manual mode but no videoId", async () => {
    const host = await createUser();
    const table = await createTable(host);
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
        tutorialMode: "manual",
      });
    expect(res.status).toBe(400);
  });

  it("PUT updates bgaUrl when provided", async () => {
    const host = await createUser();
    const table = await createTable(host);
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
        bgaUrl: "https://boardgamearena.com/gamepanel?game=catan",
      });
    expect(res.status).toBe(200);
    expect(res.body.bgaUrl).toBe(
      "https://boardgamearena.com/gamepanel?game=catan",
    );
  });

  it("PUT can clear bgaUrl by sending empty string", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      bgaUrl: "https://boardgamearena.com/x",
    });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
        bgaUrl: "",
      });
    expect(res.status).toBe(200);
    expect(res.body.bgaUrl).toBeNull();
  });

  it("PUT preserves bgaUrl when not sent in body", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      bgaUrl: "https://boardgamearena.com/x",
    });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(200);
    expect(res.body.bgaUrl).toBe("https://boardgamearena.com/x");
  });

  it("400s on PUT with invalid bgaUrl domain", async () => {
    const host = await createUser();
    const table = await createTable(host);
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 14 * 86400000).toISOString(),
        maxPlayers: 4,
        bgaUrl: "https://otrositio.com/x",
      });
    expect(res.status).toBe(400);
  });

  it("400s when reducing maxPlayers below current player count", async () => {
    const host = await createUser();
    const p1 = await createUser();
    const p2 = await createUser();
    const table = await createTable(host, {
      maxPlayers: 4,
      players: [p1._id, p2._id],
    });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ date: new Date().toISOString(), maxPlayers: 1 });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/tables/:id (cancel)", () => {
  it('host can cancel (sets status to "cancelled", excludes from list)', async () => {
    const host = await createUser();
    const table = await createTable(host);
    const res = await request(app)
      .delete(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(200);

    const refreshed = await Table.findById(table._id);
    expect(refreshed.status).toBe("cancelled");

    const list = await request(app).get("/api/tables");
    expect(
      list.body.tables.find((t) => t._id === String(table._id)),
    ).toBeUndefined();
  });
});

describe("GET /api/tables/:id/og (OG metadata for crawlers)", () => {
  it("public table → returns game image + metadata (no auth)", async () => {
    const host = await createUser({ displayName: "Ana" });
    const table = await createTable(host, {
      boardGame: "Wingspan",
      bggImage: "https://cf.geekdo-images.com/wingspan-high.jpg",
      bggThumbnail: "https://cf.geekdo-images.com/wingspan-thumb.jpg",
      maxPlayers: 4,
    });
    const res = await request(app).get(`/api/tables/${table._id}/og`);
    expect(res.status).toBe(200);
    expect(res.body.boardGame).toBe("Wingspan");
    // Prefiere la imagen de alta resolución sobre el thumbnail.
    expect(res.body.image).toBe("https://cf.geekdo-images.com/wingspan-high.jpg");
    expect(res.body.host).toBe("Ana");
    expect(res.body.seats).toBe(5); // maxPlayers + host
  });

  it("falls back to bggThumbnail when there is no bggImage", async () => {
    const host = await createUser();
    const table = await createTable(host, {
      bggImage: null,
      bggThumbnail: "https://cf.geekdo-images.com/thumb.jpg",
    });
    const res = await request(app).get(`/api/tables/${table._id}/og`);
    expect(res.status).toBe(200);
    expect(res.body.image).toBe("https://cf.geekdo-images.com/thumb.jpg");
  });

  it("private table → 404 with empty body", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "private" });
    const res = await request(app).get(`/api/tables/${table._id}/og`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });

  it("friends table → 404 with empty body", async () => {
    const host = await createUser();
    const table = await createTable(host, { privacy: "friends" });
    const res = await request(app).get(`/api/tables/${table._id}/og`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });

  it("cancelled table → 404 with empty body", async () => {
    const host = await createUser();
    const table = await createTable(host, { status: "cancelled" });
    const res = await request(app).get(`/api/tables/${table._id}/og`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });

  it("nonexistent table → 404 with empty body", async () => {
    const res = await request(app).get(
      `/api/tables/${"a".repeat(24)}/og`,
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });
});

// Mesa "finalizada" (date pasada) → freeze para todos menos admin. Chat,
// comments, fotos y ratings siguen abiertos (otras suites los cubren).
describe("Past mesa freeze (date < now)", () => {
  const pastDate = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

  it("PUT /:id → 403 para el host cuando la mesa ya pasó", async () => {
    const host = await createUser();
    const table = await createTable(host, { date: pastDate() });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 4,
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/finalizada/i);
  });

  it("PUT /:id → admin SÍ puede editar una mesa pasada", async () => {
    const host = await createUser();
    const { token } = await createAuthedUser({ isAdmin: true });
    const table = await createTable(host, { date: pastDate() });
    const res = await request(app)
      .put(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        date: new Date(Date.now() + 86400000).toISOString(),
        maxPlayers: 5,
      });
    expect(res.status).toBe(200);
    expect(res.body.maxPlayers).toBe(5);
  });

  it("DELETE /:id → 403 para el host cuando la mesa ya pasó", async () => {
    const host = await createUser();
    const table = await createTable(host, { date: pastDate() });
    const res = await request(app)
      .delete(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(403);
  });

  it("DELETE /:id → admin SÍ puede cancelar una mesa pasada", async () => {
    const host = await createUser();
    const { token } = await createAuthedUser({ isAdmin: true });
    const table = await createTable(host, { date: pastDate() });
    const res = await request(app)
      .delete(`/api/tables/${table._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("POST /:id/join → 403 sobre mesa pasada para no-admin", async () => {
    const host = await createUser();
    const table = await createTable(host, { date: pastDate() });
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/finalizada/i);
  });

  it("POST /:id/leave → 403 sobre mesa pasada para participante normal", async () => {
    const host = await createUser();
    const { user, token } = await createAuthedUser();
    const table = await createTable(host, {
      date: pastDate(),
      players: [user._id],
    });
    const res = await request(app)
      .post(`/api/tables/${table._id}/leave`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("DELETE /:id/request → 403 sobre mesa pasada para el solicitante", async () => {
    const host = await createUser();
    const { user, token } = await createAuthedUser();
    const table = await createTable(host, {
      date: pastDate(),
      pendingRequests: [user._id],
    });
    const res = await request(app)
      .delete(`/api/tables/${table._id}/request`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("POST /:id/requests/:userId/accept → 403 para el host en mesa pasada", async () => {
    const host = await createUser();
    const requester = await createUser();
    const table = await createTable(host, {
      date: pastDate(),
      privacy: "private",
      pendingRequests: [requester._id],
    });
    const res = await request(app)
      .post(`/api/tables/${table._id}/requests/${requester._id}/accept`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(403);
  });

  it("POST /:id/requests/:userId/reject → 403 para el host en mesa pasada", async () => {
    const host = await createUser();
    const requester = await createUser();
    const table = await createTable(host, {
      date: pastDate(),
      privacy: "private",
      pendingRequests: [requester._id],
    });
    const res = await request(app)
      .post(`/api/tables/${table._id}/requests/${requester._id}/reject`)
      .set("Authorization", `Bearer ${tokenFor(host)}`);
    expect(res.status).toBe(403);
  });

  it("chat sigue abierto en mesa pasada (POST /:id/messages 201)", async () => {
    const host = await createUser();
    const table = await createTable(host, { date: pastDate() });
    const res = await request(app)
      .post(`/api/tables/${table._id}/messages`)
      .set("Authorization", `Bearer ${tokenFor(host)}`)
      .send({ content: "buen reseña post-game" });
    expect(res.status).toBe(201);
  });
});

describe("Privacy 'friends'", () => {
  async function setupFriendship() {
    const host = await createUser();
    const friend = await createUser();
    host.friends = [friend._id];
    friend.friends = [host._id];
    await host.save();
    await friend.save();
    return { host, friend };
  }

  describe("GET /api/tables (listado)", () => {
    it("oculta mesas 'friends' a no-amigos del host", async () => {
      const { host } = await setupFriendship();
      await createTable(host, {
        boardGame: "Friends-only",
        privacy: "friends",
      });
      await createTable(host, { boardGame: "Public", privacy: "public" });
      const { token: strangerToken } = await createAuthedUser();
      const res = await request(app)
        .get("/api/tables")
        .set("Authorization", `Bearer ${strangerToken}`);
      const games = res.body.tables.map((t) => t.boardGame);
      expect(games).toContain("Public");
      expect(games).not.toContain("Friends-only");
    });

    it("muestra mesas 'friends' a amigos del host", async () => {
      const { host, friend } = await setupFriendship();
      await createTable(host, {
        boardGame: "Friends-only",
        privacy: "friends",
      });
      const res = await request(app)
        .get("/api/tables")
        .set("Authorization", `Bearer ${tokenFor(friend)}`);
      const games = res.body.tables.map((t) => t.boardGame);
      expect(games).toContain("Friends-only");
    });

    it("el host siempre ve su propia mesa 'friends'", async () => {
      const host = await createUser();
      await createTable(host, {
        boardGame: "Mine",
        privacy: "friends",
      });
      const res = await request(app)
        .get("/api/tables")
        .set("Authorization", `Bearer ${tokenFor(host)}`);
      expect(res.body.tables.map((t) => t.boardGame)).toContain("Mine");
    });

    it("oculta 'friends' a anónimos", async () => {
      const host = await createUser();
      await createTable(host, { privacy: "friends" });
      const res = await request(app).get("/api/tables");
      expect(res.body.tables).toHaveLength(0);
    });
  });

  describe("GET /api/tables/:id", () => {
    it("404 a no-amigos", async () => {
      const { host } = await setupFriendship();
      const table = await createTable(host, { privacy: "friends" });
      const { token } = await createAuthedUser();
      const res = await request(app)
        .get(`/api/tables/${table._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it("404 a anónimos", async () => {
      const host = await createUser();
      const table = await createTable(host, { privacy: "friends" });
      const res = await request(app).get(`/api/tables/${table._id}`);
      expect(res.status).toBe(404);
    });

    it("200 a amigos del host", async () => {
      const { host, friend } = await setupFriendship();
      const table = await createTable(host, { privacy: "friends" });
      const res = await request(app)
        .get(`/api/tables/${table._id}`)
        .set("Authorization", `Bearer ${tokenFor(friend)}`);
      expect(res.status).toBe(200);
    });

    it("200 a players aunque no sean amigos", async () => {
      const host = await createUser();
      const { user, token } = await createAuthedUser();
      const table = await createTable(host, {
        privacy: "friends",
        players: [user._id],
      });
      const res = await request(app)
        .get(`/api/tables/${table._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/tables/:id/join", () => {
    it("join directo (no pendingRequests) para un amigo", async () => {
      const { host, friend } = await setupFriendship();
      const table = await createTable(host, { privacy: "friends" });
      const res = await request(app)
        .post(`/api/tables/${table._id}/join`)
        .set("Authorization", `Bearer ${tokenFor(friend)}`);
      expect(res.status).toBe(200);
      expect(res.body.requested).toBe(false);
      const refreshed = await Table.findById(table._id);
      expect(refreshed.players.map((p) => p.toString())).toContain(
        friend._id.toString(),
      );
      expect(refreshed.pendingRequests).toHaveLength(0);
    });

    it("404 a un no-amigo que intenta joinear", async () => {
      const { host } = await setupFriendship();
      const table = await createTable(host, { privacy: "friends" });
      const { token } = await createAuthedUser();
      const res = await request(app)
        .post(`/api/tables/${table._id}/join`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/tables/:id/follow", () => {
    it("400 al intentar seguir una mesa 'friends'", async () => {
      const { host, friend } = await setupFriendship();
      const table = await createTable(host, { privacy: "friends" });
      const res = await request(app)
        .post(`/api/tables/${table._id}/follow`)
        .set("Authorization", `Bearer ${tokenFor(friend)}`);
      expect(res.status).toBe(400);
    });

    it("400 al intentar seguir una mesa privada", async () => {
      const host = await createUser();
      const table = await createTable(host, { privacy: "private" });
      const { token } = await createAuthedUser();
      const res = await request(app)
        .post(`/api/tables/${table._id}/follow`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it("200 al seguir una mesa pública", async () => {
      const host = await createUser();
      const table = await createTable(host, { privacy: "public" });
      const { token } = await createAuthedUser();
      const res = await request(app)
        .post(`/api/tables/${table._id}/follow`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.isFollowing).toBe(true);
    });
  });

  describe("GET /api/tables/showcase + /top-games", () => {
    it("showcase solo cuenta y muestra mesas públicas", async () => {
      const host = await createUser();
      await createTable(host, { boardGame: "Pub", privacy: "public" });
      await createTable(host, { boardGame: "Priv", privacy: "private" });
      await createTable(host, { boardGame: "Friends", privacy: "friends" });
      const res = await request(app).get("/api/tables/showcase");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      if (res.body.table) {
        expect(res.body.table.boardGame).toBe("Pub");
      }
    });

    it("top-games excluye juegos solo presentes en mesas no públicas", async () => {
      const host = await createUser();
      await createTable(host, { boardGame: "PublicGame", privacy: "public" });
      await createTable(host, { boardGame: "PrivateGame", privacy: "private" });
      await createTable(host, { boardGame: "FriendsGame", privacy: "friends" });
      const res = await request(app).get("/api/tables/top-games");
      expect(res.status).toBe(200);
      const games = res.body.map((g) => g.game);
      expect(games).toContain("PublicGame");
      expect(games).not.toContain("PrivateGame");
      expect(games).not.toContain("FriendsGame");
    });
  });

  describe("POST /api/tables (validator)", () => {
    it("acepta privacy='friends'", async () => {
      const { token } = await createAuthedUser();
      const res = await request(app)
        .post("/api/tables")
        .set("Authorization", `Bearer ${token}`)
        .send({
          boardGame: "Catán",
          date: new Date(Date.now() + 7 * 86400000).toISOString(),
          maxPlayers: 4,
          privacy: "friends",
        });
      expect(res.status).toBe(201);
      expect(res.body.privacy).toBe("friends");
    });

    it("400 a privacy='invalid'", async () => {
      const { token } = await createAuthedUser();
      const res = await request(app)
        .post("/api/tables")
        .set("Authorization", `Bearer ${token}`)
        .send({
          boardGame: "Catán",
          date: new Date(Date.now() + 7 * 86400000).toISOString(),
          maxPlayers: 4,
          privacy: "invalid",
        });
      expect(res.status).toBe(400);
    });
  });
});

describe("Notificación 'player_joined'", () => {
  const Notification = require("../../models/Notification");

  it("mesa pública: el host recibe 'player_joined' cuando alguien se une", async () => {
    const host = await createUser();
    const { user: joiner, token } = await createAuthedUser();
    const table = await createTable(host, { privacy: "public", maxPlayers: 4 });

    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const notifs = await Notification.find({ type: "player_joined" });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].recipient.toString()).toBe(host._id.toString());
    expect(notifs[0].tableId).toBe(table._id.toString());
    expect(notifs[0].tableName).toBe(table.boardGame);
    expect(notifs[0].lastJoinerUsername).toBe(joiner.username);
    expect(notifs[0].count).toBe(1);
  });

  it("mesa 'friends': el host recibe 'player_joined' cuando un amigo se une", async () => {
    const host = await createUser();
    const { user: friend, token } = await createAuthedUser();
    host.friends = [friend._id];
    friend.friends = [host._id];
    await host.save();
    await friend.save();
    const table = await createTable(host, {
      privacy: "friends",
      maxPlayers: 4,
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const notifs = await Notification.find({ type: "player_joined" });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].recipient.toString()).toBe(host._id.toString());
    expect(notifs[0].lastJoinerUsername).toBe(friend.username);
  });

  it("mesa privada: NO se emite 'player_joined' (sigue siendo join_request)", async () => {
    const host = await createUser();
    const { token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "private",
      maxPlayers: 4,
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.requested).toBe(true);

    const joinedNotifs = await Notification.find({ type: "player_joined" });
    expect(joinedNotifs).toHaveLength(0);
    const requestNotifs = await Notification.find({ type: "join_request" });
    expect(requestNotifs).toHaveLength(1);
  });

  it("agrega múltiples joins en una única notif con count incrementado", async () => {
    const host = await createUser();
    const { token: token1 } = await createAuthedUser();
    const { token: token2 } = await createAuthedUser();
    const table = await createTable(host, { privacy: "public", maxPlayers: 4 });

    await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token1}`);
    await request(app)
      .post(`/api/tables/${table._id}/join`)
      .set("Authorization", `Bearer ${token2}`);

    const notifs = await Notification.find({ type: "player_joined" });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].count).toBe(2);
  });
});

describe("Notificación 'player_left'", () => {
  const Notification = require("../../models/Notification");

  it("mesa pública: el host recibe 'player_left' cuando alguien se va", async () => {
    const host = await createUser();
    const { user: leaver, token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "public",
      players: [leaver._id],
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/leave`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const notifs = await Notification.find({ type: "player_left" });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].recipient.toString()).toBe(host._id.toString());
    expect(notifs[0].tableName).toBe(table.boardGame);
    expect(notifs[0].lastLeaverUsername).toBe(leaver.username);
    expect(notifs[0].count).toBe(1);
  });

  it("mesa 'friends': el host también recibe 'player_left'", async () => {
    const host = await createUser();
    const { user: leaver, token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "friends",
      players: [leaver._id],
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/leave`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const notifs = await Notification.find({ type: "player_left" });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].lastLeaverUsername).toBe(leaver.username);
  });

  it("mesa privada: el host también recibe 'player_left' (le costó aceptarlo)", async () => {
    const host = await createUser();
    const { user: leaver, token } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "private",
      players: [leaver._id],
    });

    const res = await request(app)
      .post(`/api/tables/${table._id}/leave`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const notifs = await Notification.find({ type: "player_left" });
    expect(notifs).toHaveLength(1);
  });

  it("agrega varias salidas en una sola notif con count incrementado", async () => {
    const host = await createUser();
    const { user: leaver1, token: t1 } = await createAuthedUser();
    const { user: leaver2, token: t2 } = await createAuthedUser();
    const table = await createTable(host, {
      privacy: "public",
      players: [leaver1._id, leaver2._id],
    });

    await request(app)
      .post(`/api/tables/${table._id}/leave`)
      .set("Authorization", `Bearer ${t1}`);
    await request(app)
      .post(`/api/tables/${table._id}/leave`)
      .set("Authorization", `Bearer ${t2}`);

    const notifs = await Notification.find({ type: "player_left" });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].count).toBe(2);
    expect(notifs[0].lastLeaverUsername).toBe(leaver2.username);
  });
});

describe("Notificaciones — gating por privacy", () => {
  const Notification = require("../../models/Notification");

  describe("POST /:id/leave → spot_opened", () => {
    it("mesa pública: notifica a cada follower", async () => {
      const host = await createUser();
      const follower1 = await createUser();
      const follower2 = await createUser();
      const { user: player, token } = await createAuthedUser();
      const table = await createTable(host, {
        privacy: "public",
        maxPlayers: 4,
        players: [player._id],
        followers: [follower1._id, follower2._id],
      });
      const res = await request(app)
        .post(`/api/tables/${table._id}/leave`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      const notifs = await Notification.find({ type: "spot_opened" });
      const recipientIds = notifs.map((n) => n.recipient.toString()).sort();
      expect(recipientIds).toEqual(
        [follower1._id.toString(), follower2._id.toString()].sort(),
      );
    });

    it("mesa friends: NO notifica spot_opened a followers legacy", async () => {
      const host = await createUser();
      const follower = await createUser();
      const { user: player, token } = await createAuthedUser();
      const table = await createTable(host, {
        privacy: "friends",
        maxPlayers: 4,
        players: [player._id],
        followers: [follower._id],
      });
      const res = await request(app)
        .post(`/api/tables/${table._id}/leave`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      const notifs = await Notification.find({ type: "spot_opened" });
      expect(notifs).toHaveLength(0);
    });

    it("mesa privada: NO notifica spot_opened a followers legacy", async () => {
      const host = await createUser();
      const follower = await createUser();
      const { user: player, token } = await createAuthedUser();
      const table = await createTable(host, {
        privacy: "private",
        maxPlayers: 4,
        players: [player._id],
        followers: [follower._id],
      });
      const res = await request(app)
        .post(`/api/tables/${table._id}/leave`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      const notifs = await Notification.find({ type: "spot_opened" });
      expect(notifs).toHaveLength(0);
    });
  });

  describe("DELETE /:id → table_cancelled", () => {
    it("mesa pública: notifica a players + followers", async () => {
      const player = await createUser();
      const follower = await createUser();
      const { user: host, token } = await createAuthedUser();
      const table = await createTable(host, {
        privacy: "public",
        players: [player._id],
        followers: [follower._id],
      });
      const res = await request(app)
        .delete(`/api/tables/${table._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      const notifs = await Notification.find({ type: "table_cancelled" });
      const recipientIds = notifs.map((n) => n.recipient.toString()).sort();
      expect(recipientIds).toEqual(
        [player._id.toString(), follower._id.toString()].sort(),
      );
    });

    it("mesa friends: notifica solo a players (followers legacy quedan inertes)", async () => {
      const player = await createUser();
      const follower = await createUser();
      const { user: host, token } = await createAuthedUser();
      const table = await createTable(host, {
        privacy: "friends",
        players: [player._id],
        followers: [follower._id],
      });
      const res = await request(app)
        .delete(`/api/tables/${table._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      const notifs = await Notification.find({ type: "table_cancelled" });
      const recipientIds = notifs.map((n) => n.recipient.toString());
      expect(recipientIds).toEqual([player._id.toString()]);
    });

    it("mesa privada: notifica solo a players (followers legacy quedan inertes)", async () => {
      const player = await createUser();
      const follower = await createUser();
      const { user: host, token } = await createAuthedUser();
      const table = await createTable(host, {
        privacy: "private",
        players: [player._id],
        followers: [follower._id],
      });
      const res = await request(app)
        .delete(`/api/tables/${table._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      const notifs = await Notification.find({ type: "table_cancelled" });
      const recipientIds = notifs.map((n) => n.recipient.toString());
      expect(recipientIds).toEqual([player._id.toString()]);
    });
  });
});
