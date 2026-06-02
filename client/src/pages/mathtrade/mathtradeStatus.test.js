import { describe, it, expect } from "vitest";
import { getStatusMeta, getModeLabel, STATUS_META } from "./mathtradeStatus";

describe("getStatusMeta", () => {
  it("devuelve label + color para cada estado conocido", () => {
    expect(getStatusMeta("open").label).toBe("Inscripción abierta");
    expect(getStatusMeta("results").color).toBe("--amber");
    expect(getStatusMeta("cancelled").label).toBe("Cancelado");
  });

  it("cae a draft para estados desconocidos", () => {
    expect(getStatusMeta("inventado")).toEqual(STATUS_META.draft);
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
});
