const BggPlay = require("../../../../models/BggPlay");
const BggGame = require("../../../../models/BggGame");
const User = require("../../../../models/User");
const { encrypt } = require("../../../../utils/encryption");
const { clearSession } = require("../../../../utils/bggAuth");
const {
  BGG_GEEKPLAY,
  buildPlayForm,
  validatePlayBody,
  submitToGeekplay,
  verifyPlayOnBgg,
  upsertPlayFromBgg,
} = require("../../../../services/bgg/bggMutations");
const bggCache = require("../../../../services/bgg/bggCache");

beforeEach(() => {
  vi.restoreAllMocks();
  bggCache._resetForTests();
});

// ── buildPlayForm ────────────────────────────────────────────────────

describe("buildPlayForm", () => {
  const baseBody = {
    objectid: 13,
    playdate: "2026-01-15",
    players: [],
  };

  it("setea los meta fields requeridos", () => {
    const form = buildPlayForm(baseBody);
    expect(form.get("ajax")).toBe("1");
    expect(form.get("action")).toBe("save");
    expect(form.get("version")).toBe("2");
    expect(form.get("objecttype")).toBe("thing");
    expect(form.get("objectid")).toBe("13");
    expect(form.get("playdate")).toBe("2026-01-15");
  });

  it("omite playid en create (POST), lo setea en edit (PUT)", () => {
    expect(buildPlayForm(baseBody).get("playid")).toBeNull();
    expect(buildPlayForm(baseBody, "42").get("playid")).toBe("42");
    expect(buildPlayForm(baseBody, 42).get("playid")).toBe("42");
  });

  it("quantity se clampa a 1-99", () => {
    expect(buildPlayForm({ ...baseBody, quantity: 0 }).get("quantity")).toBe(
      "1",
    );
    expect(buildPlayForm({ ...baseBody, quantity: -5 }).get("quantity")).toBe(
      "1",
    );
    expect(buildPlayForm({ ...baseBody, quantity: 50 }).get("quantity")).toBe(
      "50",
    );
    expect(buildPlayForm({ ...baseBody, quantity: 200 }).get("quantity")).toBe(
      "99",
    );
    // default
    expect(buildPlayForm(baseBody).get("quantity")).toBe("1");
  });

  it("length: omite si null/empty, parsea si numérico, clamp a >=0", () => {
    expect(buildPlayForm(baseBody).get("length")).toBeNull();
    expect(buildPlayForm({ ...baseBody, length: "" }).get("length")).toBeNull();
    expect(
      buildPlayForm({ ...baseBody, length: null }).get("length"),
    ).toBeNull();
    expect(buildPlayForm({ ...baseBody, length: 60 }).get("length")).toBe("60");
    expect(buildPlayForm({ ...baseBody, length: -10 }).get("length")).toBe("0");
  });

  it("location y comments truncan a 100 / 1000 chars", () => {
    const longLoc = "x".repeat(200);
    const longCmt = "y".repeat(2000);
    const form = buildPlayForm({
      ...baseBody,
      location: longLoc,
      comments: longCmt,
    });
    expect(form.get("location")).toHaveLength(100);
    expect(form.get("comments")).toHaveLength(1000);
  });

  it("omite location/comments si vienen vacíos", () => {
    expect(buildPlayForm(baseBody).get("location")).toBeNull();
    expect(buildPlayForm(baseBody).get("comments")).toBeNull();
    expect(
      buildPlayForm({ ...baseBody, location: "" }).get("location"),
    ).toBeNull();
  });

  it("incomplete y nowinstats serializan a '1'/'0'", () => {
    const form = buildPlayForm({
      ...baseBody,
      incomplete: true,
      nowinstats: true,
    });
    expect(form.get("incomplete")).toBe("1");
    expect(form.get("nowinstats")).toBe("1");

    const form2 = buildPlayForm(baseBody);
    expect(form2.get("incomplete")).toBe("0");
    expect(form2.get("nowinstats")).toBe("0");
  });

  it("players: serializa con índices, position default = i+1", () => {
    const form = buildPlayForm({
      ...baseBody,
      players: [{ name: "Ana", win: true }, { name: "Beto" }],
    });
    expect(form.get("players[0][name]")).toBe("Ana");
    expect(form.get("players[0][win]")).toBe("1");
    expect(form.get("players[0][new]")).toBe("0");
    expect(form.get("players[0][position]")).toBe("1");
    expect(form.get("players[1][name]")).toBe("Beto");
    expect(form.get("players[1][win]")).toBe("0");
    expect(form.get("players[1][position]")).toBe("2");
  });

  it("player.position explícito sobrescribe el default", () => {
    const form = buildPlayForm({
      ...baseBody,
      players: [{ name: "Ana", position: "5" }],
    });
    expect(form.get("players[0][position]")).toBe("5");
  });

  it("player.rating: solo se setea si > 0", () => {
    const form0 = buildPlayForm({
      ...baseBody,
      players: [{ name: "Ana", rating: 0 }],
    });
    expect(form0.get("players[0][rating]")).toBeNull();

    const form7 = buildPlayForm({
      ...baseBody,
      players: [{ name: "Ana", rating: 7.5 }],
    });
    expect(form7.get("players[0][rating]")).toBe("7.5");
  });

  it("player.score: omite si null/empty", () => {
    expect(
      buildPlayForm({
        ...baseBody,
        players: [{ name: "Ana", score: null }],
      }).get("players[0][score]"),
    ).toBeNull();
    expect(
      buildPlayForm({
        ...baseBody,
        players: [{ name: "Ana", score: "" }],
      }).get("players[0][score]"),
    ).toBeNull();
    expect(
      buildPlayForm({
        ...baseBody,
        players: [{ name: "Ana", score: "42" }],
      }).get("players[0][score]"),
    ).toBe("42");
  });

  it("player.username/color/name truncan apropiadamente", () => {
    const form = buildPlayForm({
      ...baseBody,
      players: [
        {
          name: "n".repeat(200),
          username: "u".repeat(100),
          color: "c".repeat(60),
          score: "s".repeat(60),
        },
      ],
    });
    expect(form.get("players[0][name]")).toHaveLength(100);
    expect(form.get("players[0][username]")).toHaveLength(50);
    expect(form.get("players[0][color]")).toHaveLength(30);
    expect(form.get("players[0][score]")).toHaveLength(30);
  });
});

// ── validatePlayBody ─────────────────────────────────────────────────

describe("validatePlayBody", () => {
  const ok = { objectid: "13", playdate: "2026-01-15", players: [] };

  it("devuelve null si todo está bien", () => {
    expect(validatePlayBody(ok)).toBeNull();
  });

  it("objectid debe ser numérico", () => {
    expect(validatePlayBody({ ...ok, objectid: "abc" })).toBe(
      "ID de juego inválido",
    );
    expect(validatePlayBody({ ...ok, objectid: null })).toBe(
      "ID de juego inválido",
    );
    expect(validatePlayBody({ ...ok, objectid: undefined })).toBe(
      "ID de juego inválido",
    );
  });

  it("playdate debe matchear YYYY-MM-DD estricto", () => {
    expect(validatePlayBody({ ...ok, playdate: "26-1-15" })).toBe(
      "Fecha inválida (formato YYYY-MM-DD)",
    );
    expect(validatePlayBody({ ...ok, playdate: "2026/01/15" })).toBe(
      "Fecha inválida (formato YYYY-MM-DD)",
    );
    expect(validatePlayBody({ ...ok, playdate: "" })).toBe(
      "Fecha inválida (formato YYYY-MM-DD)",
    );
  });

  it("players debe ser array", () => {
    expect(validatePlayBody({ ...ok, players: null })).toBe(
      "Lista de jugadores inválida",
    );
    expect(validatePlayBody({ ...ok, players: "Ana" })).toBe(
      "Lista de jugadores inválida",
    );
    expect(validatePlayBody({ ...ok, players: undefined })).toBe(
      "Lista de jugadores inválida",
    );
  });

  it("rechaza fechas futuras (el server es la autoridad)", () => {
    expect(validatePlayBody({ ...ok, playdate: "2099-12-31" })).toBe(
      "La fecha no puede ser futura",
    );
  });

  it("acepta la fecha de hoy", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(validatePlayBody({ ...ok, playdate: today })).toBeNull();
  });

  it("rechaza rosters demasiado grandes (>50 jugadores)", () => {
    const players = Array.from({ length: 51 }, (_, i) => ({ name: `J${i}` }));
    expect(validatePlayBody({ ...ok, players })).toBe(
      "Demasiados jugadores en la partida",
    );
    const ok50 = Array.from({ length: 50 }, (_, i) => ({ name: `J${i}` }));
    expect(validatePlayBody({ ...ok, players: ok50 })).toBeNull();
  });
});

// ── upsertPlayFromBgg ────────────────────────────────────────────────

describe("upsertPlayFromBgg", () => {
  it("inserta una play nueva si no existe", async () => {
    const play = {
      playId: "100",
      date: "2026-01-15",
      gameId: "13",
      gameName: "Catan",
      players: [],
    };
    const doc = await upsertPlayFromBgg("ClaudioH", play);
    expect(doc.bggUsername).toBe("claudioh");
    expect(doc.hash).toBeTruthy();
    expect(await BggPlay.countDocuments({ playId: "100" })).toBe(1);
  });

  it("actualiza play existente y refresca hash cuando cambia un campo editable", async () => {
    await upsertPlayFromBgg("claudio", {
      playId: "100",
      date: "2026-01-15",
      gameId: "13",
      gameName: "Catan",
      comments: "Mesa larga",
      players: [],
    });
    const before = await BggPlay.findOne({ playId: "100" }).lean();

    // El hash de bggHash.js solo cubre PLAY_FIELDS (comments incluido) +
    // players, NO gameName/gameId — esos vienen de BGG y son inmutables
    // desde la UI del user.
    await upsertPlayFromBgg("claudio", {
      playId: "100",
      date: "2026-01-15",
      gameId: "13",
      gameName: "Catan",
      comments: "Mesa más larga, cambio de comments",
      players: [],
    });
    const after = await BggPlay.findOne({ playId: "100" }).lean();

    expect(await BggPlay.countDocuments({ playId: "100" })).toBe(1);
    expect(after.comments).toBe("Mesa más larga, cambio de comments");
    expect(after.hash).not.toBe(before.hash);
  });

  it("normaliza bggUsername a lowercase en el doc persistido", async () => {
    await upsertPlayFromBgg("ClAuDiO", {
      playId: "100",
      date: "2026-01-15",
      gameId: "13",
      gameName: "Catan",
      players: [],
    });
    const docs = await BggPlay.collection.find({}).toArray();
    expect(docs[0].bggUsername).toBe("claudio");
  });
});

// ── verifyPlayOnBgg ──────────────────────────────────────────────────

describe("verifyPlayOnBgg", () => {
  function buildPlaysXml(plays) {
    const content = plays
      .map(
        (p) =>
          `<play id="${p.id}" date="${p.date}" quantity="1" length="60" incomplete="0" nowinstats="0" location="">
            <item name="${p.gameName}" objecttype="thing" objectid="${p.gameId}"/>
            <players></players>
          </play>`,
      )
      .join("");
    return `<?xml version="1.0"?><plays username="u" userid="1" total="${plays.length}" page="1">${content}</plays>`;
  }

  it("encuentra la play y resuelve thumbnail desde BggGame", async () => {
    await BggGame.create({ gameId: 13, name: "Catan", thumbnail: "t.jpg" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          buildPlaysXml([
            { id: "100", date: "2026-01-15", gameId: "13", gameName: "Catan" },
          ]),
      })),
    );

    const result = await verifyPlayOnBgg("claudio", "100", {
      gameId: "13",
      playdate: "2026-01-15",
    });
    expect(result).toMatchObject({ playId: "100", gameName: "Catan" });
    expect(result.gameThumbnail).toBe("t.jpg");
  });

  it("narrow-ea con id + mindate + maxdate cuando se pasan", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => buildPlaysXml([]),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    await verifyPlayOnBgg("claudio", "100", {
      gameId: "13",
      playdate: "2026-01-15",
    });
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain("username=claudio");
    expect(url).toContain("id=13");
    expect(url).toContain("mindate=2026-01-15");
    expect(url).toContain("maxdate=2026-01-15");
  });

  it("retorna null si la play no aparece tras los 2 intentos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          buildPlaysXml([
            { id: "999", date: "2026-01-15", gameId: "13", gameName: "Catan" },
          ]),
      })),
    );
    const result = await verifyPlayOnBgg("claudio", "100");
    expect(result).toBeNull();
  });

  it("retorna null cuando parsePlaysXml no encuentra <plays> root", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "<error/>",
      })),
    );
    const result = await verifyPlayOnBgg("claudio", "100");
    expect(result).toBeNull();
  });

  it("retry: éxito en el 2do intento tras un blip en el 1ro", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call++;
        if (call === 1) {
          return { ok: false, status: 500, text: async () => "" };
        }
        return {
          ok: true,
          status: 200,
          text: async () =>
            buildPlaysXml([
              {
                id: "100",
                date: "2026-01-15",
                gameId: "13",
                gameName: "Catan",
              },
            ]),
        };
      }),
    );
    // fetchBgg trata !ok como throw — el primer intento tira, el segundo
    // funciona dentro del retry interno.
    const result = await verifyPlayOnBgg("claudio", "100");
    expect(result).toMatchObject({ playId: "100" });
  });

  it("tira con err.status=502 si fetchBgg falla en ambos intentos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => "",
      })),
    );
    await expect(verifyPlayOnBgg("claudio", "100")).rejects.toMatchObject({
      status: 502,
    });
  });
});

// ── submitToGeekplay ─────────────────────────────────────────────────

describe("submitToGeekplay", () => {
  // Helper para crear un user con credentials BGG válidas (encriptadas).
  async function createUserWithBggCreds() {
    const user = await User.create({
      username: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      displayName: "Test",
      email: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}@x.com`,
      password: "HashedPw123",
      bggUsername: "claudio",
      bggCredentials: {
        encryptedPassword: encrypt("plaintext-pw"),
        connectedAt: new Date(),
      },
      emailVerified: true,
    });
    // Asegurar que no haya cache stale del session para este user.
    clearSession(user._id);
    return user;
  }

  // Stub fetch que responde al login con cookies, después delega al callback
  // para el POST a geekplay.
  function stubFetchLoginThenGeekplay(geekplayResponse) {
    let call = 0;
    return vi.fn(async (url) => {
      call++;
      if (url.includes("/login/api/v1")) {
        return {
          ok: true,
          status: 200,
          headers: {
            getSetCookie: () => [
              "bggusername=claudio; Path=/",
              "SessionID=xyz; Path=/",
            ],
          },
          text: async () => "",
        };
      }
      if (url === BGG_GEEKPLAY) {
        return geekplayResponse;
      }
      throw new Error(`unexpected fetch in test (call ${call}): ${url}`);
    });
  }

  it("devuelve el JSON parseado en respuesta 200 con JSON", async () => {
    const user = await createUserWithBggCreds();
    vi.stubGlobal(
      "fetch",
      stubFetchLoginThenGeekplay({
        ok: true,
        status: 200,
        text: async () => '{"playid":"100","success":1}',
      }),
    );
    const form = new URLSearchParams({ action: "save" });
    const result = await submitToGeekplay(user, form, "POST");
    expect(result).toMatchObject({ playid: "100", success: 1 });
  });

  it("devuelve { raw } cuando el body no es JSON", async () => {
    const user = await createUserWithBggCreds();
    vi.stubGlobal(
      "fetch",
      stubFetchLoginThenGeekplay({
        ok: true,
        status: 200,
        text: async () => "<html>confirmation</html>",
      }),
    );
    const result = await submitToGeekplay(user, new URLSearchParams(), "PUT");
    expect(result).toHaveProperty("raw");
    expect(result.raw).toContain("<html>");
  });

  it("tira status=401 cuando geekplay devuelve 401", async () => {
    const user = await createUserWithBggCreds();
    vi.stubGlobal(
      "fetch",
      stubFetchLoginThenGeekplay({
        ok: false,
        status: 401,
        text: async () => "",
      }),
    );
    await expect(
      submitToGeekplay(user, new URLSearchParams(), "POST"),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("tira status=401 cuando geekplay devuelve 403", async () => {
    const user = await createUserWithBggCreds();
    vi.stubGlobal(
      "fetch",
      stubFetchLoginThenGeekplay({
        ok: false,
        status: 403,
        text: async () => "",
      }),
    );
    await expect(
      submitToGeekplay(user, new URLSearchParams(), "POST"),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("tira status=502 cuando geekplay devuelve otro !ok (ej 500)", async () => {
    const user = await createUserWithBggCreds();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      stubFetchLoginThenGeekplay({
        ok: false,
        status: 500,
        text: async () => "down",
      }),
    );
    await expect(
      submitToGeekplay(user, new URLSearchParams(), "POST"),
    ).rejects.toMatchObject({ status: 502 });
    warnSpy.mockRestore();
  });

  it("tira status=502 cuando fetch a geekplay falla de red", async () => {
    const user = await createUserWithBggCreds();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (url.includes("/login/api/v1")) {
          return {
            ok: true,
            status: 200,
            headers: {
              getSetCookie: () => ["SessionID=xyz; Path=/"],
            },
            text: async () => "",
          };
        }
        throw new Error("network down");
      }),
    );
    await expect(
      submitToGeekplay(user, new URLSearchParams(), "POST"),
    ).rejects.toMatchObject({ status: 502 });
  });
});
