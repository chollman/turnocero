const request = require("supertest");
const app = require("../../app");
const { createUser, createAuthedUser } = require("../helpers/auth");
const { createResena, createCompartida } = require("../helpers/factories");
const { loadSiteConfig, updateSiteConfig } = require("../../utils/siteConfig");
const SiteConfig = require("../../models/SiteConfig");

async function enableAllSections() {
  const all = {};
  for (const key of SiteConfig.SECTION_KEYS) all[key] = { enabled: true };
  await loadSiteConfig();
  await updateSiteConfig(all, null, null);
}

beforeEach(enableAllSections);

const CATAN = { bggId: 13, name: "Catan", thumbnail: "", image: "", year: 1995 };

describe("GET /api/compartidas/juego/:bggId — reseñas por juego", () => {
  it("devuelve las reseñas públicas del juego + promedio de puntuación", async () => {
    const author = await createUser();
    await createResena(author, { boardGame: CATAN, rating: 8 });
    await createResena(author, { boardGame: CATAN, rating: 6 });
    // Reseña de OTRO juego — no debe contar.
    await createResena(author, {
      boardGame: { bggId: 99, name: "Otro", thumbnail: "", image: "", year: 1 },
      rating: 10,
    });
    // Una juntada del mismo juego (boardGames, no boardGame) — no es reseña.
    await createCompartida(author, {
      boardGames: [CATAN],
      privacy: "public",
    });

    const res = await request(app).get("/api/compartidas/juego/13");
    expect(res.status).toBe(200);
    expect(res.body.game.name).toBe("Catan");
    expect(res.body.total).toBe(2);
    expect(res.body.avgRating).toBe(7);
    expect(res.body.reviews).toHaveLength(2);
    expect(res.body.reviews.every((r) => r.category === "resena")).toBe(true);
  });

  it("respeta la privacidad: un anónimo no ve reseñas 'friends'/privadas", async () => {
    const author = await createUser();
    await createResena(author, { boardGame: CATAN, rating: 8 }); // public
    await createResena(author, {
      boardGame: CATAN,
      rating: 4,
      privacy: "friends",
    });
    await createResena(author, {
      boardGame: CATAN,
      rating: 2,
      privacy: "private",
    });

    const res = await request(app).get("/api/compartidas/juego/13");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.avgRating).toBe(8);
  });

  it("el autor sí ve sus reseñas privadas", async () => {
    const { user, token } = await createAuthedUser();
    await createResena(user, { boardGame: CATAN, rating: 8 });
    await createResena(user, {
      boardGame: CATAN,
      rating: 4,
      privacy: "private",
    });

    const res = await request(app)
      .get("/api/compartidas/juego/13")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.avgRating).toBe(6);
  });

  it("rechaza un bggId inválido con 400", async () => {
    const res = await request(app).get("/api/compartidas/juego/abc");
    expect(res.status).toBe(400);
  });
});
