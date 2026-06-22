import { describe, it, expect, afterEach } from "vitest";
import i18n from "../../i18n";
import { getStatusMeta, getModeLabel } from "./mathtradeStatus";

afterEach(() => {
  i18n.changeLanguage("es");
});

describe("getStatusMeta", () => {
  it("devuelve label + color para cada estado conocido", () => {
    expect(getStatusMeta("open").label).toBe("Inscripción abierta");
    expect(getStatusMeta("results").color).toBe("--amber");
    expect(getStatusMeta("cancelled").label).toBe("Cancelado");
  });

  it("cae a draft para estados desconocidos", () => {
    expect(getStatusMeta("inventado")).toEqual(getStatusMeta("draft"));
  });

  it("traduce al inglés con el toggle de idioma", () => {
    i18n.changeLanguage("en");
    expect(getStatusMeta("open").label).toBe("Registration open");
    expect(getStatusMeta("results").color).toBe("--amber");
  });
});

describe("getModeLabel", () => {
  it("traduce los modos", () => {
    expect(getModeLabel("max")).toBe("Cadena máxima");
    expect(getModeLabel("bounded")).toBe("Cadena acotada");
    expect(getModeLabel("auto")).toBe("Automática");
  });

  it("default a cadena máxima", () => {
    expect(getModeLabel(undefined)).toBe("Cadena máxima");
  });

  it("traduce los modos al inglés", () => {
    i18n.changeLanguage("en");
    expect(getModeLabel("max")).toBe("Maximum chain");
    expect(getModeLabel("auto")).toBe("Automatic");
  });
});
