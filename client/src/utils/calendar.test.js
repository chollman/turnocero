import { describe, it, expect } from "vitest";
import {
  dayKey,
  monthLabel,
  addMonths,
  monthRange,
  buildMonthMatrix,
  groupByDay,
  getWeekdayInitials,
} from "./calendar";
import i18n from "../i18n";

describe("dayKey", () => {
  it("formatea una fecha local como YYYY-MM-DD con zero-padding", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("devuelve '' para fechas inválidas", () => {
    expect(dayKey("no-es-fecha")).toBe("");
  });
});

describe("monthLabel", () => {
  it("devuelve 'Mes Año' en español", () => {
    expect(monthLabel(2026, 5)).toBe("Junio 2026");
    expect(monthLabel(2026, 0)).toBe("Enero 2026");
  });

  it("devuelve 'Month Year' en inglés", () => {
    i18n.changeLanguage("en");
    expect(monthLabel(2026, 5)).toBe("June 2026");
    i18n.changeLanguage("es");
  });
});

describe("addMonths", () => {
  it("avanza con wraparound de año", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
  it("retrocede con wraparound de año", () => {
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
  it("salta varios meses", () => {
    expect(addMonths(2026, 5, 3)).toEqual({ year: 2026, month: 8 });
  });
});

describe("monthRange", () => {
  it("devuelve el primer y último instante del mes", () => {
    const { from, to } = monthRange(2026, 5); // Junio
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(5);
    expect(from.getHours()).toBe(0);
    expect(to.getDate()).toBe(30);
    expect(to.getMonth()).toBe(5);
    expect(to.getHours()).toBe(23);
  });
});

describe("buildMonthMatrix", () => {
  it("arranca cada semana en lunes (7 columnas)", () => {
    expect(getWeekdayInitials()).toHaveLength(7);
    const matrix = buildMonthMatrix(2026, 5);
    for (const week of matrix) expect(week).toHaveLength(7);
  });

  it("incluye el día 1 marcado como inMonth", () => {
    const matrix = buildMonthMatrix(2026, 5);
    const cells = matrix.flat();
    const first = cells.find((c) => c.date.getDate() === 1 && c.inMonth);
    expect(first).toBeTruthy();
  });

  it("marca días fuera del mes con inMonth=false", () => {
    const matrix = buildMonthMatrix(2026, 5);
    const cells = matrix.flat();
    expect(cells.some((c) => !c.inMonth)).toBe(true);
  });

  it("marca isToday solo en el día de hoy del mes", () => {
    const today = new Date(2026, 5, 15);
    const matrix = buildMonthMatrix(2026, 5, today);
    const todays = matrix.flat().filter((c) => c.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0].date.getDate()).toBe(15);
  });

  it("no marca ningún isToday si hoy cae en otro mes", () => {
    const today = new Date(2026, 6, 15); // Julio
    const matrix = buildMonthMatrix(2026, 5, today); // grilla de Junio
    expect(matrix.flat().some((c) => c.isToday)).toBe(false);
  });
});

describe("groupByDay", () => {
  it("agrupa items por día local", () => {
    const items = [
      { id: "a", date: new Date(2026, 5, 10, 9) },
      { id: "b", date: new Date(2026, 5, 10, 20) },
      { id: "c", date: new Date(2026, 5, 11, 12) },
    ];
    const map = groupByDay(items);
    expect(map.get("2026-06-10")).toHaveLength(2);
    expect(map.get("2026-06-11")).toHaveLength(1);
  });

  it("ignora items con fecha inválida", () => {
    const map = groupByDay([{ id: "x", date: "nope" }]);
    expect(map.size).toBe(0);
  });
});
