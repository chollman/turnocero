import { describe, it, expect } from "vitest";
import { resources } from "./index";
import { LANGS, NAMESPACES } from "./config";

// Recorre un objeto de traducciones y devuelve el set de keys hoja (con su path
// completo en notación punto). Ignora el sufijo de plural de i18next (_one/_other/
// _zero/…) para que `title_one`/`title_other` cuenten como la misma key lógica.
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

describe("i18n resource parity (es ↔ en)", () => {
  it("registra exactamente los idiomas soportados", () => {
    expect(Object.keys(resources).sort()).toEqual([...LANGS].sort());
  });

  for (const ns of NAMESPACES) {
    it(`namespace "${ns}" tiene el mismo set de keys en es y en`, () => {
      const es = resources.es[ns];
      const en = resources.en[ns];
      expect(es, `falta resources.es.${ns}`).toBeTruthy();
      expect(en, `falta resources.en.${ns}`).toBeTruthy();
      const esKeys = [...leafKeys(es)].sort();
      const enKeys = [...leafKeys(en)].sort();
      expect(enKeys).toEqual(esKeys);
    });
  }
});
