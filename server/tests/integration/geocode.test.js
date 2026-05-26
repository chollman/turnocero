const request = require("supertest");
const app = require("../../app");
const GeocodeCache = require("../../models/GeocodeCache");
const { Client } = require("@googlemaps/google-maps-services-js");
const { createAuthedUser, authHeader } = require("../helpers/auth");

// ── Mock del SDK de Google Maps ───────────────────────────────────────
// El route hace `new Client({}).geocode(...)`. Parcheamos el prototype
// para que cada test inyecte su respuesta.
let geocodeMock;

beforeEach(() => {
  geocodeMock = vi.fn();
  Client.prototype.geocode = geocodeMock;
  process.env.GOOGLE_MAPS_API_KEY = "test-google-key";
});

afterEach(() => {
  delete process.env.GOOGLE_MAPS_API_KEY;
});

// Helper para armar respuestas tipo Google.
function googleHit({ lat, lng, formatted }) {
  return {
    data: {
      results: [
        { geometry: { location: { lat, lng } }, formatted_address: formatted },
      ],
      status: "OK",
    },
  };
}

function googleEmpty() {
  return { data: { results: [], status: "ZERO_RESULTS" } };
}

describe("GET /api/geocode", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .get("/api/geocode")
      .query({ q: "Av Corrientes 1234" });
    expect(res.status).toBe(401);
  });

  it("rejects empty or too-short queries with 400", async () => {
    const { token } = await createAuthedUser();
    const res1 = await request(app)
      .get("/api/geocode")
      .query({ q: "" })
      .set(authHeader(token));
    expect(res1.status).toBe(400);
    const res2 = await request(app)
      .get("/api/geocode")
      .query({ q: "ab" })
      .set(authHeader(token));
    expect(res2.status).toBe(400);
    // No llamó a Google.
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it("calls Google on cache miss and saves the result", async () => {
    const { token } = await createAuthedUser();
    geocodeMock.mockResolvedValueOnce(
      googleHit({
        lat: -34.6037,
        lng: -58.3816,
        formatted: "Av. Corrientes 1234, CABA",
      }),
    );

    const res = await request(app)
      .get("/api/geocode")
      .query({ q: "Av Corrientes 1234" })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      lat: -34.6037,
      lng: -58.3816,
      formatted: "Av. Corrientes 1234, CABA",
      cached: false,
    });
    expect(geocodeMock).toHaveBeenCalledTimes(1);
    // Pasa region=ar para sesgar resultados.
    expect(geocodeMock.mock.calls[0][0].params).toMatchObject({
      address: "Av Corrientes 1234",
      region: "ar",
    });

    // Persistió en cache.
    const cached = await GeocodeCache.findOne({
      query: "av corrientes 1234",
    }).lean();
    expect(cached).toBeTruthy();
    expect(cached.lat).toBe(-34.6037);
  });

  it("serves from cache on second identical query (and normalizes case/spaces)", async () => {
    const { token } = await createAuthedUser();
    geocodeMock.mockResolvedValueOnce(
      googleHit({ lat: -34.6, lng: -58.4, formatted: "Florida 100, CABA" }),
    );

    await request(app)
      .get("/api/geocode")
      .query({ q: "Florida 100" })
      .set(authHeader(token));

    // Misma query con distinto case + espacios extra → mismo hit en cache.
    const res = await request(app)
      .get("/api/geocode")
      .query({ q: "  FLORIDA   100  " })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ lat: -34.6, lng: -58.4, cached: true });
    // Google llamado solo una vez.
    expect(geocodeMock).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when Google returns no results", async () => {
    const { token } = await createAuthedUser();
    geocodeMock.mockResolvedValueOnce(googleEmpty());

    const res = await request(app)
      .get("/api/geocode")
      .query({ q: "asdfqwerzxcv1234" })
      .set(authHeader(token));

    expect(res.status).toBe(404);
    // No persiste resultados vacíos.
    const cached = await GeocodeCache.findOne({
      query: "asdfqwerzxcv1234",
    }).lean();
    expect(cached).toBeNull();
  });

  it("returns 502 when Google responds with an error status", async () => {
    const { token } = await createAuthedUser();
    geocodeMock.mockRejectedValueOnce({
      response: { data: { status: "OVER_QUERY_LIMIT" } },
    });

    const res = await request(app)
      .get("/api/geocode")
      .query({ q: "Av Corrientes 1234" })
      .set(authHeader(token));

    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/OVER_QUERY_LIMIT/);
  });

  it("returns 500 if the server key is not configured", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const { token } = await createAuthedUser();
    const res = await request(app)
      .get("/api/geocode")
      .query({ q: "Av Corrientes 1234" })
      .set(authHeader(token));

    expect(res.status).toBe(500);
    expect(geocodeMock).not.toHaveBeenCalled();
  });
});
