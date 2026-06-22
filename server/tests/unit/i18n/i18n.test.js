const { i18next, resources, handler, getFixedT } = require("../../../i18n");
const { LANGS, NAMESPACES } = require("../../../i18n/config");

// Recolecta keys hoja (path en notación punto), ignorando el sufijo de plural
// de i18next (_one/_other/…) para que cuenten como una sola key lógica.
function leafKeys(obj, prefix = "") {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const nested of leafKeys(v, path)) keys.add(nested);
    } else {
      keys.add(path.replace(/_(zero|one|two|few|many|other)$/, ""));
    }
  }
  return keys;
}

// Corre el middleware i18next-http-middleware con un Accept-Language dado y
// devuelve el req decorado (req.t / req.language).
function runMiddleware(acceptLanguage) {
  return new Promise((resolve) => {
    const req = { headers: {} };
    if (acceptLanguage) req.headers["accept-language"] = acceptLanguage;
    handler(req, {}, () => resolve(req));
  });
}

describe("server i18n", () => {
  it("se inicializó con los idiomas soportados", () => {
    expect(i18next.isInitialized).toBe(true);
    expect(Object.keys(resources).sort()).toEqual([...LANGS].sort());
  });

  it("traduce una key en es y en", () => {
    expect(getFixedT("es", "errors")("notFound")).toBe("No encontrado");
    expect(getFixedT("en", "errors")("notFound")).toBe("Not found");
  });

  it("cae al español ante un idioma desconocido", () => {
    expect(getFixedT("fr", "errors")("notFound")).toBe("No encontrado");
  });

  describe("middleware Accept-Language", () => {
    it("resuelve en cuando el header pide inglés", async () => {
      const req = await runMiddleware("en");
      expect(req.language).toMatch(/^en/);
      expect(req.t("errors:notFound")).toBe("Not found");
    });

    it("resuelve es por defecto (sin header)", async () => {
      const req = await runMiddleware(null);
      expect(req.t("errors:notFound")).toBe("No encontrado");
    });

    it("matchea por prefijo (en-US → en)", async () => {
      const req = await runMiddleware("en-US,en;q=0.9");
      expect(req.t("errors:notFound")).toBe("Not found");
    });
  });

  describe("paridad de recursos es ↔ en", () => {
    for (const ns of NAMESPACES) {
      it(`namespace "${ns}" tiene el mismo set de keys`, () => {
        const es = resources.es[ns];
        const en = resources.en[ns];
        expect(es).toBeTruthy();
        expect(en).toBeTruthy();
        expect([...leafKeys(en)].sort()).toEqual([...leafKeys(es)].sort());
      });
    }
  });
});
