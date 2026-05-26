// Tests para la config CORS compartida. Como lee env vars al require, cada
// test invalida el require cache y setea CORS_ORIGIN antes de cargar.

const loadCors = () => {
  delete require.cache[require.resolve("../../../config/cors")];
  return require("../../../config/cors");
};

describe("config/cors", () => {
  const origCorsEnv = process.env.CORS_ORIGIN;

  afterEach(() => {
    process.env.CORS_ORIGIN = origCorsEnv;
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

  it("socketCorsOptions usa el array literal de orígenes", () => {
    process.env.CORS_ORIGIN = "https://a.com,https://b.com";
    const { socketCorsOptions, allowedOrigins } = loadCors();
    expect(socketCorsOptions.origin).toEqual(allowedOrigins);
    expect(socketCorsOptions.credentials).toBe(true);
  });
});
