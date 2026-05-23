const httpError = require("../../../utils/httpError");

describe("httpError", () => {
  it("crea un Error con status y message", () => {
    const err = httpError(404, "No encontrado");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.message).toBe("No encontrado");
  });

  it("incluye el stack trace", () => {
    const err = httpError(400, "x");
    expect(err.stack).toBeTruthy();
    expect(err.stack).toContain("Error: x");
  });

  it("permite cualquier status code arbitrario sin validar", () => {
    // No queremos que el helper sea estricto sobre rangos — algunos códigos
    // 2xx también podrían usarse en flows raros.
    expect(httpError(418, "I'm a teapot").status).toBe(418);
    expect(httpError(500, "boom").status).toBe(500);
  });
});
