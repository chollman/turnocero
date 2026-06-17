const {
  dayKeyAR,
  dayRangeToUtc,
  subtractDays,
} = require("../../../utils/dayKey");

describe("dayKeyAR", () => {
  it("formatea una fecha UTC al día calendario AR", () => {
    // 2026-06-17 12:00 UTC → AR 09:00 mismo día
    expect(dayKeyAR(new Date("2026-06-17T12:00:00Z"))).toBe("2026-06-17");
  });

  it("retrocede cruzando la medianoche AR", () => {
    // 2026-06-17 02:00 UTC = AR 2026-06-16 23:00 → día anterior
    expect(dayKeyAR(new Date("2026-06-17T02:00:00Z"))).toBe("2026-06-16");
  });

  it("avanza apenas pasada la medianoche AR", () => {
    // 2026-06-17 03:30 UTC = AR 00:30 → ese día
    expect(dayKeyAR(new Date("2026-06-17T03:30:00Z"))).toBe("2026-06-17");
  });
});

describe("dayRangeToUtc", () => {
  it("mapea un único día AR a una ventana UTC de 24h", () => {
    const { start, end } = dayRangeToUtc("2026-06-17", "2026-06-17");
    expect(start.toISOString()).toBe("2026-06-17T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-18T03:00:00.000Z");
  });

  it("abarca varios días, inclusivo de `to`", () => {
    const { start, end } = dayRangeToUtc("2026-06-15", "2026-06-17");
    expect(start.toISOString()).toBe("2026-06-15T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-18T03:00:00.000Z");
  });
});

describe("subtractDays", () => {
  it("resta días calendario a un day-key", () => {
    expect(subtractDays("2026-06-17", 6)).toBe("2026-06-11");
  });

  it("cruza el límite de mes", () => {
    expect(subtractDays("2026-06-02", 5)).toBe("2026-05-28");
  });
});
