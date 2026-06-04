// Tests para la config CORS compartida. Como lee env vars al require, cada
// test invalida el require cache y setea CORS_ORIGIN antes de cargar.

const loadCors = () => {
  delete require.cache[require.resolve("../../../config/cors")];
  return require("../../../config/cors");
};

describe("config/cors", () => {
  const origCorsEnv = process.env.CORS_ORIGIN;
  const origSuffixEnv = process.env.CORS_ORIGIN_SUFFIX;

  afterEach(() => {
    process.env.CORS_ORIGIN = origCorsEnv;
    if (origSuffixEnv === undefined) delete process.env.CORS_ORIGIN_SUFFIX;
    else process.env.CORS_ORIGIN_SUFFIX = origSuffixEnv;
  });

  it("cae a localhost:3000 si CORS_ORIGIN no está seteado", () => {
    delete process.env.CORS_ORIGIN;
    const { allowedOrigins } = loadCors();
    expect(allowedOrigins).toEqual(["http://localhost:3000"]);
  });

  it("parsea múltiples orígenes separados por coma con trim", () => {
    process.env.CORS_ORIGIN = "https://a.com, https://b.com ,https://c.com";
    const { allowedOrigins } = loadCors();
    expect(allowedOrigins).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com",
    ]);
  });

  describe("corsOptions.origin callback", () => {
    it("acepta requests same-origin (sin header Origin)", () => {
      process.env.CORS_ORIGIN = "https://prod.example.com";
      const { corsOptions } = loadCors();
      const cb = vi.fn();
      corsOptions.origin(undefined, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it("acepta orígenes en la whitelist", () => {
      process.env.CORS_ORIGIN = "https://prod.example.com";
      const { corsOptions } = loadCors();
      const cb = vi.fn();
      corsOptions.origin("https://prod.example.com", cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it("rechaza orígenes fuera de la whitelist con un Error", () => {
      process.env.CORS_ORIGIN = "https://prod.example.com";
      const { corsOptions } = loadCors();
      const cb = vi.fn();
      corsOptions.origin("https://evil.example.com", cb);
      expect(cb).toHaveBeenCalledTimes(1);
      const [err, ok] = cb.mock.calls[0];
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/evil\.example\.com/);
      expect(ok).toBeUndefined();
    });
  });

  describe("CORS_ORIGIN_SUFFIX (subdominios por comunidad)", () => {
    it("acepta cualquier subdominio https que matchee el sufijo", () => {
      process.env.CORS_ORIGIN = "https://turnocero.com";
      process.env.CORS_ORIGIN_SUFFIX = ".turnocero.com";
      const { isAllowedOrigin } = loadCors();
      expect(isAllowedOrigin("https://patagonia.turnocero.com")).toBe(true);
      expect(isAllowedOrigin("https://rosario.turnocero.com")).toBe(true);
      expect(isAllowedOrigin("https://turnocero.com")).toBe(true); // apex
    });

    it("rechaza dominios look-alike que no terminan en el sufijo con punto", () => {
      process.env.CORS_ORIGIN = "https://turnocero.com";
      process.env.CORS_ORIGIN_SUFFIX = ".turnocero.com";
      const { isAllowedOrigin } = loadCors();
      expect(isAllowedOrigin("https://evilturnocero.com")).toBe(false);
      expect(isAllowedOrigin("https://turnocero.com.attacker.com")).toBe(false);
      expect(isAllowedOrigin("https://evil.com")).toBe(false);
    });

    it("solo matchea sufijo sobre https (no http)", () => {
      process.env.CORS_ORIGIN = "https://turnocero.com";
      process.env.CORS_ORIGIN_SUFFIX = ".turnocero.com";
      const { isAllowedOrigin } = loadCors();
      expect(isAllowedOrigin("http://patagonia.turnocero.com")).toBe(false);
    });

    it("sin la env var no hay matcheo por sufijo (back-compat)", () => {
      process.env.CORS_ORIGIN = "https://turnocero.com";
      delete process.env.CORS_ORIGIN_SUFFIX;
      const { isAllowedOrigin } = loadCors();
      expect(isAllowedOrigin("https://patagonia.turnocero.com")).toBe(false);
    });
  });

  it("socketCorsOptions.origin es una función que comparte la política", () => {
    process.env.CORS_ORIGIN = "https://a.com,https://b.com";
    process.env.CORS_ORIGIN_SUFFIX = ".turnocero.com";
    const { socketCorsOptions } = loadCors();
    expect(typeof socketCorsOptions.origin).toBe("function");
    expect(socketCorsOptions.credentials).toBe(true);
    const ok = vi.fn();
    socketCorsOptions.origin("https://b.com", ok);
    expect(ok).toHaveBeenCalledWith(null, true);
    const sub = vi.fn();
    socketCorsOptions.origin("https://x.turnocero.com", sub);
    expect(sub).toHaveBeenCalledWith(null, true);
    const bad = vi.fn();
    socketCorsOptions.origin("https://evil.com", bad);
    expect(bad).toHaveBeenCalledWith(null, false);
  });
});
