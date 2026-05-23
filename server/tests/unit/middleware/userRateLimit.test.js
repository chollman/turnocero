const userRateLimit = require("../../../middleware/userRateLimit");

// Nota: tests/setup.js monkey-patchea `express-rate-limit` con un
// pass-through (siempre llama .next()) para que las integraciones puedan
// spamear sin tirar 429. Eso hace que estos tests no puedan probar el
// rate-limit en sí — solo verificamos el contrato del factory.

describe("userRateLimit factory", () => {
  it("requiere windowMs y max", () => {
    expect(() => userRateLimit({})).toThrow(/windowMs y max/);
    expect(() => userRateLimit({ windowMs: 1000 })).toThrow(/windowMs y max/);
    expect(() => userRateLimit({ max: 10 })).toThrow(/windowMs y max/);
  });

  it("devuelve un middleware Express (función con 3 args)", () => {
    const mw = userRateLimit({ windowMs: 1000, max: 10 });
    expect(typeof mw).toBe("function");
    // express-rate-limit middlewares aceptan (req, res, next) — length puede
    // variar según versión; solo verificamos que sea callable.
    expect(mw.length).toBeGreaterThanOrEqual(2);
  });

  it("acepta un message custom", () => {
    const mw = userRateLimit({
      windowMs: 1000,
      max: 10,
      message: "Calmate che",
    });
    expect(typeof mw).toBe("function");
  });

  // No podemos testear directamente el keyGenerator porque express-rate-limit
  // está stubbeado a no-op en tests. Pero el comportamiento real (key por user
  // o IP fallback) se valida en integration tests cuando se usan las routes
  // protegidas.
});
