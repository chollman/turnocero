import { describe, it, expect } from "vitest";
import {
  EVENTO_STATUS_BADGES,
  EVENTO_STATUS_OPTIONS,
  getEventoStatusBadge,
} from "./eventoStatus";

describe("eventoStatus", () => {
  it("cubre los 4 estados del modelo Evento", () => {
    expect(Object.keys(EVENTO_STATUS_BADGES).sort()).toEqual([
      "cancelled",
      "closed",
      "draft",
      "open",
    ]);
  });

  it("badges devuelven label en español y className para CSS Modules", () => {
    expect(EVENTO_STATUS_BADGES.open).toEqual({
      label: "Abierto",
      className: "open",
    });
    expect(EVENTO_STATUS_BADGES.draft).toEqual({
      label: "Borrador",
      className: "draft",
    });
    expect(EVENTO_STATUS_BADGES.closed).toEqual({
      label: "Cerrado",
      className: "closed",
    });
    expect(EVENTO_STATUS_BADGES.cancelled).toEqual({
      label: "Cancelado",
      className: "cancelled",
    });
  });

  it("getEventoStatusBadge retorna el badge correcto", () => {
    expect(getEventoStatusBadge("open")).toBe(EVENTO_STATUS_BADGES.open);
    expect(getEventoStatusBadge("cancelled")).toBe(
      EVENTO_STATUS_BADGES.cancelled,
    );
  });

  it("getEventoStatusBadge retorna null para estados desconocidos", () => {
    expect(getEventoStatusBadge("foo")).toBeNull();
    expect(getEventoStatusBadge(undefined)).toBeNull();
    expect(getEventoStatusBadge(null)).toBeNull();
  });

  it("EVENTO_STATUS_OPTIONS contiene los 4 estados con description", () => {
    expect(EVENTO_STATUS_OPTIONS).toHaveLength(4);
    const values = EVENTO_STATUS_OPTIONS.map((o) => o.value).sort();
    expect(values).toEqual(["cancelled", "closed", "draft", "open"]);
    for (const opt of EVENTO_STATUS_OPTIONS) {
      expect(opt.label).toBeTruthy();
      expect(opt.description).toBeTruthy();
    }
  });

  it("cada estado de options matchea con su badge label", () => {
    for (const opt of EVENTO_STATUS_OPTIONS) {
      expect(EVENTO_STATUS_BADGES[opt.value]?.label).toBe(opt.label);
    }
  });
});
