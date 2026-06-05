const request = require("supertest");
const app = require("../../app");
const {
  createUser,
  createAuthedUser,
  authHeader,
  makeFriends,
} = require("../helpers/auth");

// GET /api/users/jugadores — buscador de usuarios para vincular como jugador.
// Amigos primero, luego con BGG, luego el resto. Excluye al propio usuario.

describe("GET /api/users/jugadores", () => {
  it("requiere autenticación", async () => {
    const res = await request(app).get("/api/users/jugadores");
    expect(res.status).toBe(401);
  });

  it("ordena amigos primero, luego con BGG, e incluye flags", async () => {
    const { user: me, token } = await createAuthedUser({ displayName: "Me" });
    const friend = await createUser({
      displayName: "Friend",
      bggUsername: "friendbgg",
    });
    await createUser({ displayName: "HasBgg", bggUsername: "somebgg" });
    await createUser({ displayName: "NoBgg", bggUsername: "" });
    await makeFriends(me, friend);

    const res = await request(app)
      .get("/api/users/jugadores")
      .set(authHeader(token));

    expect(res.status).toBe(200);
    const names = res.body.items.map((u) => u.displayName);
    // El amigo va primero; "Me" no aparece (excluido).
    expect(names[0]).toBe("Friend");
    expect(names).not.toContain("Me");
    // Luego el que tiene BGG, antes que el sin BGG.
    expect(names.indexOf("HasBgg")).toBeLessThan(names.indexOf("NoBgg"));

    const friendItem = res.body.items.find((u) => u.displayName === "Friend");
    expect(friendItem.isFriend).toBe(true);
    expect(friendItem.bggUsername).toBe("friendbgg");
  });

  it("excluye usuarios baneados", async () => {
    const { token } = await createAuthedUser();
    await createUser({ displayName: "Banned", isBanned: true });
    const res = await request(app)
      .get("/api/users/jugadores")
      .set(authHeader(token));
    expect(res.body.items.map((u) => u.displayName)).not.toContain("Banned");
  });

  it("filtra por ?q sobre nombre/username", async () => {
    const { token } = await createAuthedUser();
    await createUser({ displayName: "Zaratustra", bggUsername: "z1" });
    await createUser({ displayName: "Otro", bggUsername: "o1" });
    const res = await request(app)
      .get("/api/users/jugadores?q=zara")
      .set(authHeader(token));
    expect(res.body.items.map((u) => u.displayName)).toEqual(["Zaratustra"]);
  });

  it("pagina con ?limit y ?page", async () => {
    const { token } = await createAuthedUser();
    for (let i = 0; i < 3; i++) {
      await createUser({ displayName: `P${i}`, bggUsername: `p${i}` });
    }
    const p1 = await request(app)
      .get("/api/users/jugadores?limit=2&page=1")
      .set(authHeader(token));
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.total).toBe(3);
    expect(p1.body.pages).toBe(2);
  });
});
