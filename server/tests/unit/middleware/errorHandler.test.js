const errorHandler = require("../../../middleware/errorHandler");
const httpError = require("../../../utils/httpError");

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    method: "GET",
    originalUrl: "/api/test",
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("errorHandler", () => {
  it("respeta err.status y devuelve { message }", () => {
    const res = mockRes();
    const err = httpError(404, "No encontrado");

    errorHandler(err, mockReq(), res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "No encontrado" });
  });

  it("respeta err.statusCode si no hay err.status", () => {
    const res = mockRes();
    const err = Object.assign(new Error("Forbidden"), { statusCode: 403 });

    errorHandler(err, mockReq(), res, () => {});

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden" });
  });

  it("default 500 si no hay status/statusCode", () => {
    const res = mockRes();
    // Silenciamos el console.error del logger en 5xx.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("boom"), mockReq(), res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    // No exponemos err.message en 5xx — podría tener detalles internos.
    expect(res.json).toHaveBeenCalledWith({
      message: "Error interno del servidor",
    });
    errSpy.mockRestore();
  });

  it("Mongoose CastError → 400", () => {
    const res = mockRes();
    const err = Object.assign(new Error("Cast failed"), { name: "CastError" });

    errorHandler(err, mockReq(), res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Cast failed" });
  });

  it("Mongoose ValidationError → 400", () => {
    const res = mockRes();
    const err = Object.assign(new Error("Validation failed"), {
      name: "ValidationError",
    });

    errorHandler(err, mockReq(), res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Validation failed" });
  });

  it("loguea via console.error solo para 5xx", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(httpError(404, "no"), mockReq(), mockRes(), () => {});
    expect(errSpy).not.toHaveBeenCalled();

    errorHandler(new Error("boom"), mockReq(), mockRes(), () => {});
    expect(errSpy).toHaveBeenCalledTimes(1);

    errSpy.mockRestore();
  });

  it("incluye method + url en el log de 5xx", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorHandler(
      new Error("boom"),
      mockReq({ method: "POST", originalUrl: "/api/foo/bar" }),
      mockRes(),
      () => {},
    );
    const logged = errSpy.mock.calls[0][0];
    expect(logged).toContain("POST");
    expect(logged).toContain("/api/foo/bar");
    expect(logged).toContain("boom");
    errSpy.mockRestore();
  });

  it("no expone err.message en 5xx (info-leak prevention)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    const err = new Error("Connection to mongo://admin:secret@host failed");

    errorHandler(err, mockReq(), res, () => {});

    expect(res.json).toHaveBeenCalledWith({
      message: "Error interno del servidor",
    });
    // El message original sí va al log para diagnóstico (server-side OK).
    const logged = errSpy.mock.calls[0][0];
    expect(logged).toContain("secret");
    errSpy.mockRestore();
  });

  it("expone err.message en 4xx (errores intencionales)", () => {
    const res = mockRes();
    errorHandler(httpError(400, "ID inválido"), mockReq(), res, () => {});
    expect(res.json).toHaveBeenCalledWith({ message: "ID inválido" });
  });

  it("expone err.message en 5xx si viene de httpError (isExplicit)", () => {
    // Para casos como 502 "Error de Google Geocoding: REQUEST_DENIED" —
    // el caller lo construyó deliberadamente como user-facing.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockRes();
    errorHandler(
      httpError(502, "Error de Google Geocoding: REQUEST_DENIED"),
      mockReq(),
      res,
      () => {},
    );
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error de Google Geocoding: REQUEST_DENIED",
    });
    errSpy.mockRestore();
  });
});
