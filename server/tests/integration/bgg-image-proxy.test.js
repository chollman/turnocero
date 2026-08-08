const request = require("supertest");
const app = require("../../app");

afterEach(() => {
  delete global.fetch;
});

describe("GET /api/bgg/image-proxy", () => {
  it("400 si falta url", async () => {
    const res = await request(app).get("/api/bgg/image-proxy");
    expect(res.status).toBe(400);
  });

  it("400 si el host no está en la allowlist (evita SSRF)", async () => {
    const url = encodeURIComponent("https://evil.example.com/x.jpg");
    const res = await request(app).get(`/api/bgg/image-proxy?url=${url}`);
    expect(res.status).toBe(400);
  });

  it("400 si el protocolo no es https", async () => {
    const url = encodeURIComponent("http://cf.geekdo-images.com/pic1.jpg");
    const res = await request(app).get(`/api/bgg/image-proxy?url=${url}`);
    expect(res.status).toBe(400);
  });

  it("reenvía la imagen de un host *.geekdo-images.com permitido", async () => {
    const fakeBytes = Buffer.from([1, 2, 3, 4]);
    global.fetch = vi.fn(async (url) => {
      expect(url).toBe("https://cf.geekdo-images.com/pic1.jpg");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "image/jpeg" },
        // ArrayBuffer propio (no el pooled buffer de Buffer.from) para que el
        // slice no arrastre bytes de otro lado.
        arrayBuffer: async () => new Uint8Array(fakeBytes).buffer,
      };
    });

    const url = encodeURIComponent("https://cf.geekdo-images.com/pic1.jpg");
    const res = await request(app).get(`/api/bgg/image-proxy?url=${url}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(Buffer.from(res.body)).toEqual(fakeBytes);
  });

  it("propaga 404 cuando la imagen upstream no existe", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    const url = encodeURIComponent("https://cf.geekdo-images.com/missing.jpg");
    const res = await request(app).get(`/api/bgg/image-proxy?url=${url}`);
    expect(res.status).toBe(404);
  });

  it("502 si falla la conexión con el CDN", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    const url = encodeURIComponent("https://cf.geekdo-images.com/pic1.jpg");
    const res = await request(app).get(`/api/bgg/image-proxy?url=${url}`);
    expect(res.status).toBe(502);
  });
});
