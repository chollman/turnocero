const request = require("supertest");
const app = require("../../app");
const Compartida = require("../../models/Compartida");
const User = require("../../models/User");
const { createUser, createAuthedUser, tokenFor } = require("../helpers/auth");
const { createCompartida, createTable } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

// The feed splits the most-liked recent post into `featured` and the rest into
// `compartidas`. Tests assert visibility via `total` + a combined view.
function visibleBodies(body) {
  const all = [...(body.compartidas || [])];
  if (body.featured) all.push(body.featured);
  return all.map((c) => c.body);
}

describe("GET /api/compartidas — privacy visibility", () => {
  it("anon sees only public posts", async () => {
    const author = await createUser();
    await createCompartida(author, { body: "Public 1", privacy: "public" });
    await createCompartida(author, {
      body: "Friends only",
      privacy: "friends",
    });
    await createCompartida(author, { body: "Private", privacy: "private" });

    const res = await request(app).get("/api/compartidas");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(visibleBodies(res.body)).toEqual(["Public 1"]);
  });

  it("friends see friends-privacy posts by friends", async () => {
    const author = await createUser();
    const { user: friend, token } = await createAuthedUser();
    author.friends = [friend._id];
    await author.save();
    await User.updateOne(
      { _id: friend._id },
      { $set: { friends: [author._id] } },
    );

    await createCompartida(author, {
      body: "Friends only",
      privacy: "friends",
    });

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);
    expect(visibleBodies(res.body)).toContain("Friends only");
  });

  it("non-friends do NOT see friends-privacy posts", async () => {
    const author = await createUser();
    const { token } = await createAuthedUser(); // no friendship
    await createCompartida(author, {
      body: "Friends only",
      privacy: "friends",
    });

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);
    expect(visibleBodies(res.body)).not.toContain("Friends only");
  });

  it("author always sees their own private posts", async () => {
    const { user, token } = await createAuthedUser();
    await createCompartida(user, { body: "Mine alone", privacy: "private" });

    const res = await request(app)
      .get("/api/compartidas")
      .set("Authorization", `Bearer ${token}`);
    expect(visibleBodies(res.body)).toContain("Mine alone");
  });
});

describe("POST /api/compartidas", () => {
  it("creates a compartida with the caller as author", async () => {
    const { user, token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Hola mundo", privacy: "public" });

    expect(res.status).toBe(201);
    expect(res.body.author._id).toBe(user._id.toString());
    expect(res.body.body).toBe("Hola mundo");
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/compartidas").send({ body: "x" });
    expect(res.status).toBe(401);
  });

  describe("linkedTable privacy gate", () => {
    it("201 cuando linkedTable es pública y el usuario participó", async () => {
      const { user, token } = await createAuthedUser();
      const table = await createTable(user, { privacy: "public" });
      const res = await request(app)
        .post("/api/compartidas")
        .set("Authorization", `Bearer ${token}`)
        .send({
          body: "Qué buena mesa",
          privacy: "public",
          linkedTable: table._id.toString(),
        });
      expect(res.status).toBe(201);
      const linkedId =
        typeof res.body.linkedTable === "string"
          ? res.body.linkedTable
          : res.body.linkedTable?._id;
      expect(linkedId).toBe(table._id.toString());
    });

    it("popula bggThumbnail de la mesa enlazada al leer la compartida", async () => {
      const { user, token } = await createAuthedUser();
      const table = await createTable(user, {
        privacy: "public",
        bggThumbnail: "https://cf.geekdo-images.com/x-thumb.jpg",
      });
      const created = await request(app)
        .post("/api/compartidas")
        .set("Authorization", `Bearer ${token}`)
        .send({
          body: "x",
          privacy: "public",
          linkedTable: table._id.toString(),
        });
      const res = await request(app)
        .get(`/api/compartidas/${created.body._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.linkedTable.bggThumbnail).toBe(
        "https://cf.geekdo-images.com/x-thumb.jpg",
      );
    });

    it("403 cuando linkedTable es privada", async () => {
      const { user, token } = await createAuthedUser();
      const table = await createTable(user, { privacy: "private" });
      const res = await request(app)
        .post("/api/compartidas")
        .set("Authorization", `Bearer ${token}`)
        .send({
          body: "x",
          privacy: "public",
          linkedTable: table._id.toString(),
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/pública/i);
    });

    it("403 cuando linkedTable es 'friends'", async () => {
      const { user, token } = await createAuthedUser();
      const table = await createTable(user, { privacy: "friends" });
      const res = await request(app)
        .post("/api/compartidas")
        .set("Authorization", `Bearer ${token}`)
        .send({
          body: "x",
          privacy: "public",
          linkedTable: table._id.toString(),
        });
      expect(res.status).toBe(403);
    });

    it("PUT /:id también gatea linkedTable a mesa privada", async () => {
      const { user, token } = await createAuthedUser();
      const compartida = await createCompartida(user, { privacy: "public" });
      const table = await createTable(user, { privacy: "private" });
      const res = await request(app)
        .put(`/api/compartidas/${compartida._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ linkedTable: table._id.toString() });
      expect(res.status).toBe(403);
    });
  });
});

describe("POST /api/compartidas/:id/like (toggle)", () => {
  it("first call likes; second call unlikes", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    const { user, token } = await createAuthedUser();

    const r1 = await request(app)
      .post(`/api/compartidas/${compartida._id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(r1.status).toBe(200);
    let refreshed = await Compartida.findById(compartida._id);
    expect(refreshed.likes.map((l) => l.toString())).toContain(
      user._id.toString(),
    );

    const r2 = await request(app)
      .post(`/api/compartidas/${compartida._id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(r2.status).toBe(200);
    refreshed = await Compartida.findById(compartida._id);
    expect(refreshed.likes.map((l) => l.toString())).not.toContain(
      user._id.toString(),
    );
  });
});

describe("PUT/DELETE /api/compartidas/:id permissions", () => {
  it("author update persists and responds 200 with the populated doc", async () => {
    // Bug histórico (populateCompartida(Promise.resolve(doc))) arreglado en F1
    // al usar Compartida.findById(...) como Query mongoose-able.
    const { user, token } = await createAuthedUser();
    const compartida = await createCompartida(user, { body: "old" });
    const res = await request(app)
      .put(`/api/compartidas/${compartida._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "new", privacy: "public" });
    expect(res.status).toBe(200);
    expect(res.body.body).toBe("new");
    const refreshed = await Compartida.findById(compartida._id);
    expect(refreshed.body).toBe("new");
  });

  it("non-author cannot edit", async () => {
    const author = await createUser();
    const { token } = await createAuthedUser();
    const compartida = await createCompartida(author);
    const res = await request(app)
      .put(`/api/compartidas/${compartida._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hijacked" });
    expect(res.status).toBe(403);
  });

  it("F1 — linkedEvento requiere que el user haya participado (author o reg active)", async () => {
    const Evento = require("../../models/Evento");
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    // Evento donde el user NO participó.
    const stranger = await Evento.create({
      title: "Sin mí",
      eventDate: new Date(Date.now() + 7 * 86400000),
      author: admin._id,
      status: "open",
      location: { texto: "X", lat: null, lng: null, displayName: "" },
    });
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hola", linkedEvento: stranger._id.toString() });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/participaste/i);
    // Evento donde sí participó (confirmed).
    const joined = await Evento.create({
      title: "Conmigo",
      eventDate: new Date(Date.now() + 7 * 86400000),
      author: admin._id,
      status: "open",
      location: { texto: "X", lat: null, lng: null, displayName: "" },
      registrations: [{ user: user._id, status: "confirmed" }],
    });
    const ok = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hola", linkedEvento: joined._id.toString() });
    expect(ok.status).toBe(201);
    expect(ok.body.linkedEvento?._id).toBe(joined._id.toString());
    expect(ok.body.linkedEvento?.title).toBe("Conmigo");
  });

  it("F1 — rechazados NO pueden vincular el evento (status=rejected no es activo)", async () => {
    const Evento = require("../../models/Evento");
    const admin = await createUser({ isAdmin: true });
    const { user, token } = await createAuthedUser();
    const evento = await Evento.create({
      title: "X",
      eventDate: new Date(Date.now() + 7 * 86400000),
      author: admin._id,
      status: "open",
      location: { texto: "X", lat: null, lng: null, displayName: "" },
      registrations: [{ user: user._id, status: "rejected" }],
    });
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "hola", linkedEvento: evento._id.toString() });
    expect(res.status).toBe(403);
  });

  it("admin can delete any compartida", async () => {
    const author = await createUser();
    const admin = await createUser({ isAdmin: true });
    const compartida = await createCompartida(author);
    const res = await request(app)
      .delete(`/api/compartidas/${compartida._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
    const stillThere = await Compartida.findById(compartida._id);
    expect(stillThere).toBeNull();
  });
});

describe("GET /api/compartidas/:id/comments — paginación (más nuevos primero)", () => {
  const CompartidaComment = require("../../models/CompartidaComment");

  // createdAt explícito y creciente (c0 el más viejo, c{n-1} el más nuevo) para
  // un orden determinista; updateOne con timestamps:false para no pisar updatedAt.
  async function seedComments(compartida, author, n) {
    const base = Date.UTC(2026, 0, 1);
    for (let i = 0; i < n; i++) {
      const c = await CompartidaComment.create({
        compartida: compartida._id,
        author: author._id,
        content: `c${i}`,
      });
      await CompartidaComment.updateOne(
        { _id: c._id },
        { $set: { createdAt: new Date(base + i * 60000) } },
        { timestamps: false },
      );
    }
  }

  it("primera tanda: 10 más nuevos primero + total/pages", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    await seedComments(compartida, author, 20);
    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/comments`,
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(20);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBe(2);
    expect(res.body.comments).toHaveLength(10);
    expect(res.body.comments[0].content).toBe("c19"); // el más nuevo
    expect(res.body.comments[9].content).toBe("c10");
  });

  it("page 2 trae los comentarios anteriores", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    await seedComments(compartida, author, 20);
    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/comments?page=2`,
    );
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.comments).toHaveLength(10);
    expect(res.body.comments[0].content).toBe("c9");
    expect(res.body.comments[9].content).toBe("c0"); // el más viejo
  });

  it("respeta el limit del query", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    await seedComments(compartida, author, 12);
    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/comments?limit=5`,
    );
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(5);
    expect(res.body.pages).toBe(3);
    expect(res.body.comments[0].content).toBe("c11");
  });

  it("compartida sin comentarios → lista vacía, total 0", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/comments`,
    );
    expect(res.status).toBe(200);
    expect(res.body.comments).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.pages).toBe(0);
  });
});

describe("Compartidas — reseñas vs juntadas", () => {
  const BggGame = require("../../models/BggGame");

  // Sembrar el juego en Mongo para que resolveGame() salga de la cache L2 y
  // NO pegue a la red de BGG en los tests.
  async function seedGame(overrides = {}) {
    return BggGame.create({
      gameId: overrides.gameId || 13,
      name: overrides.name || "Catan",
      thumbnail: overrides.thumbnail || "https://img/thumb.jpg",
      image: overrides.image || "https://img/full.jpg",
      yearPublished: overrides.year || 1995,
    });
  }

  it("POST reseña sin juego → 400", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "resena", rating: 8, body: "<p>buena</p>" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/juego/i);
  });

  it("POST reseña sin rating → 400", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "resena",
        boardGame: { bggId: 13 },
        body: "<p>buena</p>",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/puntuaci/i);
  });

  it("POST reseña válida: sanitiza el body y persiste category/boardGame/rating", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "resena",
        title: "Mi reseña",
        boardGame: { bggId: 13, name: "FAKE", thumbnail: "x" },
        rating: 9,
        body: "<h2>Genial</h2><script>alert(1)</script><p>Muy bueno</p>",
      });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe("resena");
    expect(res.body.rating).toBe(9);
    // El snapshot se re-resuelve server-side (ignora el name/thumb del cliente).
    expect(res.body.boardGame.bggId).toBe(13);
    expect(res.body.boardGame.name).toBe("Catan");
    expect(res.body.boardGame.thumbnail).toBe("https://img/thumb.jpg");
    // Body sanitizado.
    expect(res.body.body).toContain("<h2>Genial</h2>");
    expect(res.body.body).not.toContain("<script>");

    const stored = await Compartida.findById(res.body._id);
    expect(stored.body).not.toContain("script");
  });

  it("POST reseña: conserva el set enriquecido (h4 + YouTube) y strippea iframes ajenos", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "resena",
        title: "Reseña con embed",
        boardGame: { bggId: 13, name: "FAKE", thumbnail: "x" },
        rating: 8,
        body:
          "<h4>Setup</h4><p>a</p>" +
          '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>' +
          '<iframe src="https://evil.com/x"></iframe>',
      });
    expect(res.status).toBe(201);
    expect(res.body.body).toContain("<h4>Setup</h4>");
    expect(res.body.body).toMatch(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    expect(res.body.body).toMatch(/sandbox=/);
    expect(res.body.body).not.toContain("evil.com");
  });

  it("POST juntada sin juego sigue funcionando", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Una juntada copada" });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe("juntada");
    expect(res.body.boardGame).toBeNull();
    expect(res.body.rating).toBeNull();
  });

  it("POST juntada con un juego (compat boardGame único) lo resuelve en la lista", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "jugamos", boardGame: { bggId: 13 } });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe("juntada");
    expect(res.body.boardGames).toHaveLength(1);
    expect(res.body.boardGames[0].name).toBe("Catan");
    expect(res.body.rating).toBeNull();
  });

  it("POST juntada con varios juegos: resuelve, dedupea y respeta orden", async () => {
    const { token } = await createAuthedUser();
    await seedGame({ gameId: 13, name: "Catan" });
    await seedGame({ gameId: 99, name: "Wingspan" });
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        body: "noche de juegos",
        boardGames: [{ bggId: 13 }, { bggId: 99 }, { bggId: 13 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.boardGames.map((g) => g.name)).toEqual([
      "Catan",
      "Wingspan",
    ]);
  });

  it("GET ?q= matchea por nombre de juego en la lista de una juntada", async () => {
    const author = await createUser();
    await seedGame({ gameId: 99, name: "Wingspan" });
    await createCompartida(author, {
      body: "jugamos",
      boardGames: [
        { bggId: 99, name: "Wingspan", thumbnail: "", image: "", year: 2019 },
      ],
    });
    const res = await request(app).get("/api/compartidas?q=wingspan");
    expect(res.body.compartidas.some((c) => c.body === "jugamos")).toBe(true);
  });

  it("PUT juntada edita la lista de juegos", async () => {
    const { user, token } = await createAuthedUser();
    await seedGame({ gameId: 13, name: "Catan" });
    await seedGame({ gameId: 99, name: "Wingspan" });
    const juntada = await createCompartida(user, { body: "hola" });
    const res = await request(app)
      .put(`/api/compartidas/${juntada._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ boardGames: [{ bggId: 13 }, { bggId: 99 }] });
    expect(res.status).toBe(200);
    expect(res.body.boardGames.map((g) => g.name)).toEqual([
      "Catan",
      "Wingspan",
    ]);
  });

  // ── playResult (widget de resultados de juntada compartida) ──────────
  const PLAY_RESULT = {
    mode: "versus",
    game: { name: "FAKE", thumbnail: "x" },
    gameId: 13,
    date: "2026-06-08",
    duration: 60,
    players: [
      {
        name: "Martín",
        username: "martin",
        score: 85,
        win: true,
        position: 1,
        team: "Z",
      },
      { name: "Bob", username: "bob", score: 72, win: false, position: 2 },
    ],
  };

  it("POST juntada con playResult: lo persiste, coerciona y re-resuelve el thumbnail", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "ganamos", playResult: PLAY_RESULT });
    expect(res.status).toBe(201);
    const pr = res.body.playResult;
    expect(pr).toBeTruthy();
    expect(pr.mode).toBe("versus");
    expect(pr.players).toHaveLength(2);
    expect(pr.players[0].score).toBe("85"); // number → string
    expect(pr.players[0].team).toBe(""); // "Z" inválido → ""
    // thumbnail re-resuelto del bggId (ignora el "x" del cliente).
    expect(pr.game.thumbnail).toBe("https://img/thumb.jpg");
  });

  it("juntada solo-scorecard (sin título/texto/foto) → 201 (el widget cuenta como contenido)", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ playResult: PLAY_RESULT });
    expect(res.status).toBe(201);
    expect(res.body.playResult).toBeTruthy();
  });

  it("playResult: recorta jugadores de más y clampea el mode inválido", async () => {
    const { token } = await createAuthedUser();
    const players = Array.from({ length: 30 }, (_, i) => ({
      name: `P${i}`,
      win: false,
    }));
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "x", playResult: { mode: "bogus", players } });
    expect(res.status).toBe(201);
    expect(res.body.playResult.players.length).toBe(24);
    expect(res.body.playResult.mode).toBe("versus");
  });

  it("la reseña nulea el playResult", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "resena",
        boardGame: { bggId: 13 },
        rating: 8,
        body: "<p>buena</p>",
        playResult: PLAY_RESULT,
      });
    expect(res.status).toBe(201);
    expect(res.body.playResult).toBeNull();
  });

  it("juntada sin playResult → null (legacy/normal)", async () => {
    const { token } = await createAuthedUser();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "sin widget" });
    expect(res.status).toBe(201);
    expect(res.body.playResult).toBeNull();
  });

  it("GET detalle devuelve el playResult", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const created = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "ganamos", playResult: PLAY_RESULT });
    const res = await request(app).get(`/api/compartidas/${created.body._id}`);
    expect(res.status).toBe(200);
    expect(res.body.playResult?.players?.[0]?.name).toBe("Martín");
  });

  // ── playResult: vínculo de jugador → cuenta de TurnoCero (userId) ──────
  it("vincula el jugador a su userId por @BGG y lo devuelve poblado (nombre/avatar)", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    // Cuenta de TurnoCero cuyo @BGG matchea (case-insensitive) al jugador.
    const member = await createUser({
      bggUsername: "Martin", // PLAY_RESULT usa "martin"
      displayName: "Martín Pérez",
    });
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "ganamos", playResult: PLAY_RESULT });
    expect(res.status).toBe(201);
    const players = res.body.playResult.players;
    // [0] = "martin" → poblado con la cuenta de TurnoCero.
    expect(players[0].userId).toMatchObject({
      _id: member._id.toString(),
      displayName: "Martín Pérez",
    });
    // Solo campos públicos — nada sensible se filtra en el populate.
    expect(players[0].userId.password).toBeUndefined();
    expect(players[0].userId.email).toBeUndefined();
    // [1] = "bob" → sin cuenta → userId null.
    expect(players[1].userId).toBeNull();
  });

  it("no confía en un userId mandado por el cliente — lo deriva del @BGG", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        body: "x",
        playResult: {
          ...PLAY_RESULT,
          // El cliente intenta inyectar un userId arbitrario; sin cuenta TC con
          // ese @BGG, el server lo ignora y deja null.
          players: [
            {
              name: "Spoof",
              username: "nadie",
              userId: "ffffffffffffffffffffffff",
            },
          ],
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.playResult.players[0].userId).toBeNull();
  });

  it("no vincula a jugadores anónimos aunque coincida un @BGG", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    await createUser({ bggUsername: "martin", displayName: "Martín Pérez" });
    const res = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({
        body: "x",
        playResult: {
          ...PLAY_RESULT,
          players: [{ name: "Anónimo", username: "martin", anonymous: true }],
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.playResult.players[0].userId).toBeNull();
  });

  it("GET detalle puebla el userId del jugador con el perfil ACTUAL (no congela el nombre)", async () => {
    const { token } = await createAuthedUser();
    await seedGame();
    const member = await createUser({
      bggUsername: "martin",
      displayName: "Nombre Viejo",
    });
    const created = await request(app)
      .post("/api/compartidas")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "ganamos", playResult: PLAY_RESULT });
    // El miembro cambia su displayName DESPUÉS de crear la juntada.
    await User.findByIdAndUpdate(member._id, { displayName: "Nombre Nuevo" });
    const res = await request(app).get(`/api/compartidas/${created.body._id}`);
    expect(res.status).toBe(200);
    // El populate trae el nombre vigente, no el del momento de la creación.
    expect(res.body.playResult.players[0].userId.displayName).toBe(
      "Nombre Nuevo",
    );
  });

  it("PUT reseña edita rating, body y juego", async () => {
    const { user, token } = await createAuthedUser();
    await seedGame();
    await seedGame({ gameId: 99, name: "Wingspan" });
    const { createResena } = require("../helpers/factories");
    const resena = await createResena(user, { rating: 5 });

    const res = await request(app)
      .put(`/api/compartidas/${resena._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        rating: 10,
        body: "<p>actualizada</p><script>x</script>",
        boardGame: { bggId: 99 },
      });
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(10);
    expect(res.body.boardGame.name).toBe("Wingspan");
    expect(res.body.body).not.toContain("script");
  });

  it("PUT no permite cambiar la categoría", async () => {
    const { user, token } = await createAuthedUser();
    const juntada = await createCompartida(user, { body: "hola" });
    const res = await request(app)
      .put(`/api/compartidas/${juntada._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "resena" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tipo/i);
  });

  it("GET ?category=resena filtra solo reseñas", async () => {
    const author = await createUser();
    const { createResena } = require("../helpers/factories");
    await createCompartida(author, { body: "juntada A" });
    await createResena(author, { title: "reseña A" });

    const res = await request(app).get("/api/compartidas?category=resena");
    expect(res.status).toBe(200);
    const all = [
      ...res.body.compartidas,
      ...(res.body.featured ? [res.body.featured] : []),
    ];
    expect(all.every((c) => c.category === "resena")).toBe(true);
    expect(all.some((c) => c.title === "reseña A")).toBe(true);
  });

  it("GET ?q= matchea título y nombre de juego, respetando privacidad", async () => {
    const author = await createUser();
    const { createResena } = require("../helpers/factories");
    await createResena(author, {
      title: "Análisis profundo",
      boardGame: {
        bggId: 13,
        name: "Catan",
        thumbnail: "",
        image: "",
        year: 1995,
      },
      privacy: "public",
    });
    await createResena(author, {
      title: "Otra cosa",
      boardGame: {
        bggId: 99,
        name: "Wingspan",
        thumbnail: "",
        image: "",
        year: 2019,
      },
      privacy: "private",
    });

    // Matchea por nombre de juego.
    const byGame = await request(app).get("/api/compartidas?q=catan");
    const gameTitles = byGame.body.compartidas.map((c) => c.title);
    expect(gameTitles).toContain("Análisis profundo");

    // No filtra hacia afuera la privacidad: la privada de Wingspan no aparece a anon.
    const byGame2 = await request(app).get("/api/compartidas?q=wingspan");
    expect(byGame2.body.compartidas).toHaveLength(0);

    // Matchea por título.
    const byTitle = await request(app).get("/api/compartidas?q=análisis");
    expect(byTitle.body.compartidas.map((c) => c.title)).toContain(
      "Análisis profundo",
    );
  });

  it("OG de reseña incluye rating y juego", async () => {
    const author = await createUser();
    const { createResena } = require("../helpers/factories");
    const resena = await createResena(author, {
      title: "Reseña OG",
      rating: 7,
      boardGame: {
        bggId: 13,
        name: "Catan",
        thumbnail: "",
        image: "",
        year: 1995,
      },
      body: "<p>texto plano</p>",
      privacy: "public",
    });
    const res = await request(app).get(`/api/compartidas/${resena._id}/og`);
    expect(res.status).toBe(200);
    expect(res.body.category).toBe("resena");
    expect(res.body.rating).toBe(7);
    expect(res.body.game).toBe("Catan");
    expect(res.body.body).toContain("texto plano");
    expect(res.body.body).not.toContain("<p>");
  });
});

describe("Comentarios anidados (respuestas)", () => {
  const CompartidaComment = require("../../models/CompartidaComment");

  const postComment = (id, token, body) =>
    request(app)
      .post(`/api/compartidas/${id}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  it("crea una respuesta con parent y la anida en el GET", async () => {
    const { user, token } = await createAuthedUser();
    const compartida = await createCompartida(user, { privacy: "public" });

    const top = await postComment(compartida._id, token, { content: "raíz" });
    expect(top.status).toBe(201);
    const reply = await postComment(compartida._id, token, {
      content: "respuesta",
      parent: top.body._id,
    });
    expect(reply.status).toBe(201);
    expect(reply.body.parent).toBe(top.body._id);

    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/comments`,
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // cuenta todos (raíz + respuesta)
    expect(res.body.comments).toHaveLength(1); // solo top-level
    expect(res.body.comments[0].replies).toHaveLength(1);
    expect(res.body.comments[0].replies[0].content).toBe("respuesta");
  });

  it("aplana la respuesta a una respuesta al comentario raíz", async () => {
    const { user, token } = await createAuthedUser();
    const compartida = await createCompartida(user, { privacy: "public" });
    const top = await postComment(compartida._id, token, { content: "raíz" });
    const r1 = await postComment(compartida._id, token, {
      content: "r1",
      parent: top.body._id,
    });
    // Responder a la respuesta → parent debe colapsar al raíz.
    const r2 = await postComment(compartida._id, token, {
      content: "r2",
      parent: r1.body._id,
    });
    expect(r2.body.parent).toBe(top.body._id);

    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/comments`,
    );
    expect(res.body.comments[0].replies).toHaveLength(2);
  });

  it("rechaza un parent de otra compartida (400)", async () => {
    const { user, token } = await createAuthedUser();
    const a = await createCompartida(user, { privacy: "public" });
    const b = await createCompartida(user, { privacy: "public" });
    const topA = await postComment(a._id, token, { content: "en A" });
    const res = await postComment(b._id, token, {
      content: "cross",
      parent: topA.body._id,
    });
    expect(res.status).toBe(400);
  });

  it("borrar un comentario raíz borra sus respuestas en cascada", async () => {
    const { user, token } = await createAuthedUser();
    const compartida = await createCompartida(user, { privacy: "public" });
    const top = await postComment(compartida._id, token, { content: "raíz" });
    await postComment(compartida._id, token, {
      content: "r1",
      parent: top.body._id,
    });
    await postComment(compartida._id, token, {
      content: "r2",
      parent: top.body._id,
    });

    const del = await request(app)
      .delete(`/api/compartidas/${compartida._id}/comments/${top.body._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);

    const remaining = await CompartidaComment.countDocuments({
      compartida: compartida._id,
    });
    expect(remaining).toBe(0);
  });
});

describe("POST /api/compartidas/:id/comments — notificaciones del hilo", () => {
  const Notification = require("../../models/Notification");

  const comment = (id, token, content) =>
    request(app)
      .post(`/api/compartidas/${id}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content });

  const commentNotifsFor = (userId) =>
    Notification.find({ recipient: userId, type: "compartida_comment" });

  it("notifica al autor y a los demás comentaristas, no a quien comenta", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    const { user: b, token: tb } = await createAuthedUser();
    const { user: c, token: tc } = await createAuthedUser();

    // B comenta → notifica al autor.
    await comment(compartida._id, tb, "hola desde B");
    // C comenta → notifica al autor (count 2) y a B (co-comentarista).
    await comment(compartida._id, tc, "hola desde C");

    const aNotifs = await commentNotifsFor(author._id);
    const bNotifs = await commentNotifsFor(b._id);
    const cNotifs = await commentNotifsFor(c._id);

    expect(aNotifs).toHaveLength(1);
    expect(aNotifs[0].count).toBe(2); // dos comentarios
    expect(aNotifs[0].compartidaId).toBe(compartida._id.toString());
    // B recibió notif del comentario de C (participó en el hilo).
    expect(bNotifs).toHaveLength(1);
    expect(bNotifs[0].lastCommenterUsername).toBe(c.username);
    // C acaba de comentar → no se autonotifica.
    expect(cNotifs).toHaveLength(0);
  });

  it("comentar tu propia compartida no te autonotifica", async () => {
    const { user, token } = await createAuthedUser();
    const compartida = await createCompartida(user, { privacy: "public" });
    await comment(compartida._id, token, "comento mi propio post");
    const own = await commentNotifsFor(user._id);
    expect(own).toHaveLength(0);
  });
});

describe("Likes de comentarios de compartidas", () => {
  const CompartidaComment = require("../../models/CompartidaComment");
  const Notification = require("../../models/Notification");

  const mkComment = (compartida, author, overrides = {}) =>
    CompartidaComment.create({
      compartida: compartida._id,
      author: author._id,
      content: "comentario",
      ...overrides,
    });

  it("POST .../comments/:cid/like togglea y devuelve {likes, liked}", async () => {
    const author = await createUser();
    const liker = await createAuthedUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    const c = await mkComment(compartida, author);

    const add = await request(app)
      .post(`/api/compartidas/${compartida._id}/comments/${c._id}/like`)
      .set("Authorization", `Bearer ${liker.token}`);
    expect(add.status).toBe(200);
    expect(add.body).toEqual({ likes: 1, liked: true });

    const remove = await request(app)
      .post(`/api/compartidas/${compartida._id}/comments/${c._id}/like`)
      .set("Authorization", `Bearer ${liker.token}`);
    expect(remove.body).toEqual({ likes: 0, liked: false });
  });

  it("403 si el post no es visible para el usuario", async () => {
    const author = await createUser();
    const stranger = await createAuthedUser();
    const compartida = await createCompartida(author, { privacy: "private" });
    const c = await mkComment(compartida, author);
    const res = await request(app)
      .post(`/api/compartidas/${compartida._id}/comments/${c._id}/like`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });

  it("notifica al autor del comentario y no en self-like", async () => {
    const author = await createUser();
    const liker = await createAuthedUser();
    const compartida = await createCompartida(author, { privacy: "public" });
    const c = await mkComment(compartida, author);

    await request(app)
      .post(`/api/compartidas/${compartida._id}/comments/${c._id}/like`)
      .set("Authorization", `Bearer ${liker.token}`);
    const notif = await Notification.findOne({
      recipient: author._id,
      type: "compartida_comment_like",
    });
    expect(notif).not.toBeNull();
    expect(notif.commentId).toBe(c._id.toString());
    expect(notif.compartidaId).toBe(compartida._id.toString());

    await request(app)
      .post(`/api/compartidas/${compartida._id}/comments/${c._id}/like`)
      .set("Authorization", `Bearer ${tokenFor(author)}`);
    const count = await Notification.countDocuments({
      type: "compartida_comment_like",
    });
    expect(count).toBe(1);
  });

  it("GET .../comments/:cid/likes devuelve los likers poblados", async () => {
    const author = await createUser();
    const liker = await createUser({ username: "fan" });
    const compartida = await createCompartida(author, { privacy: "public" });
    const c = await mkComment(compartida, author, { likes: [liker._id] });
    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/comments/${c._id}/likes`,
    );
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].username).toBe("fan");
  });

  it("GET comments incluye likeCount/liked y oculta el array de likes", async () => {
    const author = await createAuthedUser();
    const compartida = await createCompartida(author.user, {
      privacy: "public",
    });
    await mkComment(compartida, author.user, { likes: [author.user._id] });
    const res = await request(app)
      .get(`/api/compartidas/${compartida._id}/comments`)
      .set("Authorization", `Bearer ${author.token}`);
    expect(res.status).toBe(200);
    expect(res.body.comments[0].likeCount).toBe(1);
    expect(res.body.comments[0].liked).toBe(true);
    expect(res.body.comments[0].likes).toBeUndefined();
  });
});

describe("GET /api/compartidas/:id/likes — likers del post", () => {
  it("devuelve los users que likearon (poblados)", async () => {
    const fan = await createUser({ username: "superfan" });
    const author = await createUser();
    const compartida = await createCompartida(author, {
      privacy: "public",
      likes: [fan._id],
    });
    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/likes`,
    );
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].username).toBe("superfan");
  });

  it("403 a un anónimo en un post privado", async () => {
    const author = await createUser();
    const compartida = await createCompartida(author, { privacy: "private" });
    const res = await request(app).get(
      `/api/compartidas/${compartida._id}/likes`,
    );
    expect(res.status).toBe(403);
  });
});
