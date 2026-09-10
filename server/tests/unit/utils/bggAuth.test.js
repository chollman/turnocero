const { loginToBgg } = require("../../../utils/bggAuth");

function loginOk() {
  return {
    ok: true,
    status: 200,
    headers: {
      getSetCookie: () => [
        "bggusername=h3rmit; Path=/",
        "SessionID=abc; Path=/",
      ],
    },
  };
}

function invalidCredsJson() {
  return JSON.stringify({ errors: { message: "Invalid username or password" } });
}

describe("utils/bggAuth loginToBgg", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tira status=400 si falta username o password", async () => {
    await expect(loginToBgg("", "pw")).rejects.toMatchObject({ status: 400 });
    await expect(loginToBgg("user", "")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("devuelve el cookie string en un login 200 con Set-Cookie", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(loginOk()));
    const cookie = await loginToBgg("h3rmit", "correct-password");
    expect(cookie).toBe("bggusername=h3rmit; SessionID=abc");
  });

  it("tira status=401 cuando BGG responde 401 directamente (cualquier body)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 401, text: async () => "" }),
    );
    await expect(loginToBgg("h3rmit", "wrong")).rejects.toMatchObject({
      status: 401,
      message: "Credenciales BGG inválidas",
    });
  });

  // Regression: BGG changed this endpoint to answer bad credentials with
  // HTTP 400 + a JSON body instead of 401/403. Before the fix this fell
  // through to a generic 502 "no se pudo contactar BGG", hiding the real
  // "wrong password" reason from the user.
  it("tira status=401 cuando BGG responde 400 con JSON de credenciales inválidas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => invalidCredsJson(),
      }),
    );
    await expect(loginToBgg("h3rmit", "wrong")).rejects.toMatchObject({
      status: 401,
      message: "Credenciales BGG inválidas",
    });
  });

  it("tira status=401 cuando BGG responde 403 con JSON de credenciales inválidas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => invalidCredsJson(),
      }),
    );
    await expect(loginToBgg("h3rmit", "wrong")).rejects.toMatchObject({
      status: 401,
      message: "Credenciales BGG inválidas",
    });
  });

  // Regression: a 403 with a non-JSON body (e.g. an anti-bot/Cloudflare
  // challenge page intercepting the request before BGG's own handler sees
  // it) is NOT a credentials problem. Mislabeling it as "wrong password"
  // sends a user with a perfectly correct password to re-enter it forever.
  it("NO reporta credenciales inválidas en un 403 con body no-JSON (challenge page)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "<!doctype html><html>Un momento…</html>",
      }),
    );
    const err = await loginToBgg("h3rmit", "correct-password").catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).not.toMatch(/credenciales/i);
  });

  it("tira status=502 cuando un 400 trae body no-JSON (challenge page)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "<!doctype html><html>Un momento…</html>",
      }),
    );
    await expect(
      loginToBgg("h3rmit", "correct-password"),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("tira status=502 en otros status !ok (ej 500)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, text: async () => "" }),
    );
    await expect(loginToBgg("h3rmit", "pw")).rejects.toMatchObject({
      status: 502,
    });
  });

  it("tira status=502 si el fetch falla de red", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    await expect(loginToBgg("h3rmit", "pw")).rejects.toMatchObject({
      status: 502,
    });
  });

  it("tira status=502 si el login 200 no trae cookies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { getSetCookie: () => [] },
      }),
    );
    await expect(loginToBgg("h3rmit", "pw")).rejects.toMatchObject({
      status: 502,
    });
  });
});
