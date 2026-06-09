import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import middleware, { detectTenantSlug } from "../middleware";

// `middleware.js` vive en la raíz del client (es la edge function de Vercel);
// el include de vitest es `src/**`, así que el test vive acá e importa hacia
// arriba.

const ELCLU = {
  name: "El Clu",
  subdomainEnabled: true,
  skin: {
    brandName: "",
    tagline: "Comunidad de Telegram",
    logoLight: { url: "https://cdn/elclu.jpg" },
    logoDark: { url: "" },
  },
};

function makeReq(urlStr, ua = "WhatsApp/2.0 facebookexternalhit") {
  return {
    url: urlStr,
    headers: { get: (k) => (k.toLowerCase() === "user-agent" ? ua : null) },
  };
}

// Router de fetch: devuelve respuestas según el path pedido.
function stubFetch(routes) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u) => {
      const path = new URL(u).pathname;
      const entry = routes[path];
      if (!entry) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => entry };
    }),
  );
}

beforeEach(() => {
  process.env.VITE_API_URL = "https://api.turnocero.app";
  process.env.VITE_TENANT_DOMAIN = "turnocero.app";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectTenantSlug", () => {
  it("extrae el slug de un subdominio de comunidad", () => {
    expect(detectTenantSlug("elclu.turnocero.app")).toBe("elclu");
  });

  it("devuelve null en el apex y subdominios reservados", () => {
    expect(detectTenantSlug("turnocero.app")).toBeNull();
    expect(detectTenantSlug("www.turnocero.app")).toBeNull();
    expect(detectTenantSlug("api.turnocero.app")).toBeNull();
    expect(detectTenantSlug("app.turnocero.app")).toBeNull();
  });

  it("devuelve null para hosts de otro dominio o sin apex configurado", () => {
    expect(detectTenantSlug("elclu.otrodominio.com")).toBeNull();
    delete process.env.VITE_TENANT_DOMAIN;
    expect(detectTenantSlug("elclu.turnocero.app")).toBeNull();
  });
});

describe("middleware — OG", () => {
  it("ignora requests que no son de crawlers", async () => {
    const res = await middleware(
      makeReq(
        `https://turnocero.app/compartidas/${  "a".repeat(24)}`,
        "Mozilla/5.0",
      ),
    );
    expect(res).toBeUndefined();
  });

  it("apex: compartida usa la marca TurnoCero", async () => {
    const id = "a".repeat(24);
    stubFetch({
      [`/api/compartidas/${id}/og`]: { title: "Mi partida", author: "ana" },
    });
    const res = await middleware(
      makeReq(`https://turnocero.app/compartidas/${id}`),
    );
    const html = await res.text();
    expect(html).toContain('og:site_name"        content="TurnoCero"');
    expect(html).toContain("Mi partida – TurnoCero 🎲");
  });

  it("subdominio: la vidriera (raíz) usa nombre/tagline/logo de la comunidad", async () => {
    stubFetch({ "/api/comunidades/elclu": ELCLU });
    const res = await middleware(makeReq("https://elclu.turnocero.app/"));
    const html = await res.text();
    expect(html).toContain("<title>El Clu 🎲</title>");
    expect(html).toContain('og:site_name"        content="El Clu"');
    expect(html).toContain('og:type"             content="website"');
    expect(html).toContain("Comunidad de Telegram");
    expect(html).toContain("https://cdn/elclu.jpg");
  });

  it("subdominio: una compartida hereda la marca de la comunidad", async () => {
    const id = "b".repeat(24);
    stubFetch({
      "/api/comunidades/elclu": ELCLU,
      [`/api/compartidas/${id}/og`]: { title: "Catan", author: "ana" },
    });
    const res = await middleware(
      makeReq(`https://elclu.turnocero.app/compartidas/${id}`),
    );
    const html = await res.text();
    expect(html).toContain("Catan – El Clu 🎲");
    expect(html).toContain('og:site_name"        content="El Clu"');
  });

  it("subdominio sin subdomainEnabled: la raíz cae al shell (undefined)", async () => {
    stubFetch({
      "/api/comunidades/elclu": { ...ELCLU, subdomainEnabled: false },
    });
    const res = await middleware(makeReq("https://elclu.turnocero.app/"));
    expect(res).toBeUndefined();
  });

  it("apex raíz: no genera OG (cae al shell)", async () => {
    const res = await middleware(makeReq("https://turnocero.app/"));
    expect(res).toBeUndefined();
  });

  it("mesa: usa la imagen del juego como card chica (summary)", async () => {
    const id = "c".repeat(24);
    stubFetch({
      [`/api/tables/${id}/og`]: {
        boardGame: "Wingspan",
        image: "https://cf.geekdo-images.com/wingspan.jpg",
        host: "ana",
      },
    });
    const res = await middleware(makeReq(`https://turnocero.app/mesas/${id}`));
    const html = await res.text();
    expect(html).toContain("Wingspan – Mesa en TurnoCero 🎲");
    expect(html).toContain("https://cf.geekdo-images.com/wingspan.jpg");
    expect(html).toContain('twitter:card"            content="summary"');
    expect(html).toContain("organiza ana");
  });

  it("mesa sin imagen de juego: cae al og-default (card grande)", async () => {
    const id = "d".repeat(24);
    stubFetch({
      [`/api/tables/${id}/og`]: { boardGame: "Catan", image: null },
    });
    const res = await middleware(makeReq(`https://turnocero.app/mesas/${id}`));
    const html = await res.text();
    expect(html).toContain("/og-default.png");
    expect(html).toContain('twitter:card"            content="summary_large_image"');
  });

  it("mesa privada/inexistente (404 del API): cae al shell (undefined)", async () => {
    const id = "e".repeat(24);
    stubFetch({}); // sin ruta → fetch ok:false → handleMesa devuelve null
    const res = await middleware(makeReq(`https://turnocero.app/mesas/${id}`));
    expect(res).toBeUndefined();
  });
});
