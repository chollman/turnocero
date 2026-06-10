const request = require("supertest");
const app = require("../../app");
const BggGame = require("../../models/BggGame");
const Notification = require("../../models/Notification");
const { createAuthedUser, authHeader } = require("../helpers/auth");
const bggRouter = require("../../routes/bgg");
const { encrypt } = require("../../utils/encryption");

// Mismo enfoque de mocking de fetch que bgg-partidas-write.test.js: ruteamos
// por URL (login / geekplay / plays / thing).
function loginResponse() {
  return {
    ok: true,
    status: 200,
    headers: {
      getSetCookie: () => ["bggusername=test; Path=/", "SessionID=abc; Path=/"],
    },
    text: async () => "",
  };
}
function geekplayResponse(payload) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
}
function playsXmlResponse(plays) {
  const content = plays
    .map(
      (p) => `
    <play id="${p.id}" date="${p.date}" quantity="1" length="60" incomplete="0" nowinstats="0" location="">
      <item name="${p.gameName ?? "Game"}" objecttype="thing" objectid="${p.gameId}"/>
      <players><player username="" name="Solo" startposition="1" color="" score="" rating="0" new="0" win="1"/></players>
    </play>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><plays username="u" userid="1" total="${plays.length}" page="1">${content}</plays>`;
  return { ok: true, status: 200, text: async () => xml };
}
function thingXmlResponse() {
  return {
    ok: true,
    status: 200,
    text: async () => `<?xml version="1.0" encoding="UTF-8"?><items></items>`,
  };
}
function makeFetchMock(routes) {
  const queues = {};
  for (const [k, v] of Object.entries(routes)) {
    queues[k] = Array.isArray(v) ? [...v] : v;
  }
  return vi.fn(async (url) => {
    const u = String(url);
    let key;
    if (u.includes("/login/api/v1")) key = "login";
    else if (u.includes("/geekplay.php")) key = "geekplay";
    else if (u.includes("/xmlapi2/plays")) key = "plays";
    else if (u.includes("/xmlapi2/thing")) key = "thing";
    else throw new Error(`Unmocked fetch URL: ${u}`);
    const route = queues[key];
    if (route === undefined) throw new Error(`No mock for "${key}"`);
    if (Array.isArray(route)) {
      if (route.length === 0) throw new Error(`Queue exhausted "${key}"`);
      return route.shift();
    }
    return route;
  });
}

async function makeConnectedUser(overrides) {
  const { user, token } = await createAuthedUser(overrides);
  user.bggCredentials = {
    encryptedPassword: encrypt("pw"),
    connectedAt: new Date(),
    lastValidatedAt: new Date(),
    invalid: false,
  };
  await user.save();
  return { user, token };
}

// Cuerpo de partida de Alice que incluye a Bob (co-jugador usuario de TurnoCero)
// + un invitado sin username.
function bodyWithBob() {
  return {
    objectid: 174430,
    playdate: "2026-05-20",
    length: 120,
    location: "Sala",
    quantity: 1,
    comments: "linda",
    incomplete: false,
    nowinstats: false,
    players: [
      { name: "Alice", username: "alice", position: 1, score: "42", win: true },
      { name: "Bob", username: "bob", position: 2, score: "30", win: false },
      { name: "Invitado", username: "", position: 3, score: "10", win: false },
    ],
  };
}

describe("BGG partida compartida", () => {
  beforeEach(async () => {
    bggRouter.__resetCache();
    // Juego pre-seedeado → resolveGame sale de Mongo (sin fetch /thing).
    await BggGame.create({
      gameId: 174430,
      name: "Gloomhaven",
      thumbnail: "t.jpg",
      image: "i.jpg",
      playingTime: null,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  it("(a) POST /partidas notifica a los co-jugadores usuarios de TurnoCero", async () => {
    const { token } = await makeConnectedUser({ bggUsername: "alice" });
    const bob = await createAuthedUser({ bggUsername: "bob" });

    global.fetch = makeFetchMock({
      login: loginResponse(),
      geekplay: geekplayResponse({ playid: 999 }),
      plays: playsXmlResponse([
        { id: 999, date: "2026-05-20", gameId: 174430, gameName: "Gloomhaven" },
      ]),
      thing: thingXmlResponse(),
    });

    const res = await request(app)
      .post("/api/bgg/partidas")
      .set(authHeader(token))
      .send(bodyWithBob());
    expect(res.status).toBe(200);

    const notifs = await Notification.find({ type: "bgg_play_shared" }).lean();
    expect(notifs).toHaveLength(1);
    expect(String(notifs[0].recipient)).toBe(String(bob.user._id));
    expect(notifs[0].playId).toBe("999");
    expect(notifs[0].gameName).toBe("Gloomhaven");
    expect(notifs[0].playSnapshot.players).toHaveLength(3);
    // La ubicación NO se comparte aunque la partida tenía una ("Sala").
    expect(notifs[0].playSnapshot.location).toBeUndefined();
  });

  it("(b) POST /partidas/compartida/:notifId carga la partida, agradece y marca la notif como cargada", async () => {
    const alice = await makeConnectedUser({ bggUsername: "alice" });
    const bob = await makeConnectedUser({
      username: "bob_tc",
      displayName: "Bob",
      bggUsername: "bob",
    });
    // Semilla: la notif que Bob recibiría tras la carga de Alice.
    const shared = await Notification.create({
      recipient: bob.user._id,
      type: "bgg_play_shared",
      fromUserId: String(alice.user._id),
      fromUsername: "alice",
      playId: "999",
      gameName: "Gloomhaven",
      playSnapshot: {
        playId: "999",
        gameId: "174430",
        gameName: "Gloomhaven",
        date: "2026-05-20",
        duration: 120,
        location: "Sala",
        players: [
          { name: "Alice", username: "alice", score: "42", win: true },
          { name: "Bob", username: "bob", score: "30", win: false },
        ],
      },
    });

    global.fetch = makeFetchMock({
      login: loginResponse(),
      geekplay: geekplayResponse({ playid: 888 }),
      plays: playsXmlResponse([
        { id: 888, date: "2026-05-20", gameId: 174430, gameName: "Gloomhaven" },
      ]),
      thing: thingXmlResponse(),
    });

    const res = await request(app)
      .post(`/api/bgg/partidas/compartida/${shared._id}`)
      .set(authHeader(bob.token));
    expect(res.status).toBe(200);
    expect(res.body.playid).toBe("888");

    // La ubicación del snapshot ("Sala") NO se carga en BGG (campo omitido).
    const geekplayCall = global.fetch.mock.calls.find((c) =>
      String(c[0]).includes("/geekplay.php"),
    );
    expect(geekplayCall).toBeTruthy();
    expect(String(geekplayCall[1]?.body || "")).not.toContain("location");
    expect(String(geekplayCall[1]?.body || "")).not.toContain("Sala");

    // La notif original NO se borra: queda como notif común, leída y cargada.
    const after = await Notification.findById(shared._id).lean();
    expect(after).toBeTruthy();
    expect(after.read).toBe(true);
    expect(after.playLoaded).toBe(true);
    // Alice recibe el agradecimiento.
    const thanks = await Notification.findOne({
      type: "bgg_play_accepted",
    }).lean();
    expect(thanks).toBeTruthy();
    expect(String(thanks.recipient)).toBe(String(alice.user._id));
    expect(thanks.fromUserId).toBe(String(bob.user._id));
    // Aceptar NO genera nuevas notifs bgg_play_shared (sin cadenas): la única
    // que existe es la original (de Bob), ahora cargada.
    expect(await Notification.countDocuments({ type: "bgg_play_shared" })).toBe(
      1,
    );
  });

  it("(c) POST /partidas con sharedFromNotifId agradece, marca como cargada y NO notifica participantes", async () => {
    const alice = await makeConnectedUser({ bggUsername: "alice" });
    const bob = await makeConnectedUser({ bggUsername: "bob" });
    const shared = await Notification.create({
      recipient: bob.user._id,
      type: "bgg_play_shared",
      fromUserId: String(alice.user._id),
      playId: "999",
      gameName: "Gloomhaven",
      playSnapshot: { playId: "999", gameId: "174430", players: [] },
    });

    global.fetch = makeFetchMock({
      login: loginResponse(),
      geekplay: geekplayResponse({ playid: 777 }),
      plays: playsXmlResponse([
        { id: 777, date: "2026-05-20", gameId: 174430, gameName: "Gloomhaven" },
      ]),
      thing: thingXmlResponse(),
    });

    // Bob carga "con correcciones": el body incluye a Alice como co-jugadora.
    const res = await request(app)
      .post("/api/bgg/partidas")
      .set(authHeader(bob.token))
      .send({ ...bodyWithBob(), sharedFromNotifId: String(shared._id) });
    expect(res.status).toBe(200);

    // La notif original (de Bob) NO se borra: queda leída y cargada.
    const after = await Notification.findById(shared._id).lean();
    expect(after).toBeTruthy();
    expect(after.read).toBe(true);
    expect(after.playLoaded).toBe(true);
    expect(
      await Notification.countDocuments({ type: "bgg_play_accepted" }),
    ).toBe(1);
    // Clave: la rama de aceptación NO re-notifica a los participantes — Alice
    // (co-jugadora en la carga corregida) no recibe una bgg_play_shared.
    expect(
      await Notification.countDocuments({
        type: "bgg_play_shared",
        recipient: alice.user._id,
      }),
    ).toBe(0);
  });

  it("(d) POST /partidas/compartida devuelve 400 si el destinatario no tiene BGG conectado", async () => {
    const alice = await makeConnectedUser({ bggUsername: "alice" });
    // Bob con bggUsername pero SIN credenciales conectadas.
    const bob = await createAuthedUser({ bggUsername: "bob" });
    const shared = await Notification.create({
      recipient: bob.user._id,
      type: "bgg_play_shared",
      fromUserId: String(alice.user._id),
      playId: "999",
      playSnapshot: { playId: "999", gameId: "174430", players: [] },
    });
    global.fetch = vi.fn(() => {
      throw new Error("fetch should not be called");
    });

    const res = await request(app)
      .post(`/api/bgg/partidas/compartida/${shared._id}`)
      .set(authHeader(bob.token));
    expect(res.status).toBe(400);
    // La notif sigue intacta.
    expect(await Notification.findById(shared._id)).toBeTruthy();
  });
});
