import { describe, it, expect, afterEach } from "vitest";
import i18n from "../i18n";
import {
  getEventoStatusBadges,
  getEventoStatusOptions,
  getEventoStatusBadge,
} from "./eventoStatus";

afterEach(() => {
  i18n.changeLanguage("es");
});

describe("eventoStatus", () => {
  it("cubre los 4 estados del modelo Evento", () => {
    expect(Object.keys(getEventoStatusBadges()).sort()).toEqual([
      "cancelled",
      "closed",
      "draft",
      "open",
    ]);
  });

  it("badges devuelven label en español y className para CSS Modules", () => {
    const badges = getEventoStatusBadges();
    expect(badges.open).toEqual({
      label: "Abierto",
      className: "open",
    });
    expect(badges.draft).toEqual({
      label: "Borrador",
      className: "draft",
    });
    expect(badges.closed).toEqual({
      label: "Cerrado",
      className: "closed",
    });
    expect(badges.cancelled).toEqual({
      label: "Cancelado",
      className: "cancelled",
    });
  });

  it("getEventoStatusBadge retorna el badge correcto", () => {
    expect(getEventoStatusBadge("open")).toEqual({
      label: "Abierto",
      className: "open",
    });
    expect(getEventoStatusBadge("cancelled")).toEqual({
      label: "Cancelado",
      className: "cancelled",
    });
  });

  it("getEventoStatusBadge retorna null para estados desconocidos", () => {
    expect(getEventoStatusBadge("foo")).toBeNull();
    expect(getEventoStatusBadge(undefined)).toBeNull();
    expect(getEventoStatusBadge(null)).toBeNull();
  });

  it("getEventoStatusOptions contiene los 4 estados con description", () => {
    const options = getEventoStatusOptions();
    expect(options).toHaveLength(4);
    const values = options.map((o) => o.value).sort();
    expect(values).toEqual(["cancelled", "closed", "draft", "open"]);
    for (const opt of options) {
      expect(opt.label).toBeTruthy();
      expect(opt.description).toBeTruthy();
    }
  });

  it("cada estado de options matchea con su badge label", () => {
    const badges = getEventoStatusBadges();
    for (const opt of getEventoStatusOptions()) {
      expect(badges[opt.value]?.label).toBe(opt.label);
    }
  });

  it("renders English labels when the language is 'en'", () => {
    i18n.changeLanguage("en");
    expect(getEventoStatusBadge("open").label).toBe("Open");
    expect(getEventoStatusOptions()[0]).toMatchObject({
      value: "draft",
      label: "Draft",
      description: "Not visible to users",
    });
  });
});
