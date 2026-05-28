const {
  normalizeGameName,
  formatDuration,
} = require("../../../../services/youtube/youtubeSearch");

describe("normalizeGameName", () => {
  it("lowercases", () => {
    expect(normalizeGameName("Catan")).toBe("catan");
    expect(normalizeGameName("WINGSPAN")).toBe("wingspan");
  });

  it("trims y colapsa whitespace múltiple", () => {
    expect(normalizeGameName("  Catan  ")).toBe("catan");
    expect(normalizeGameName("Cities   of   Splendor")).toBe(
      "cities of splendor",
    );
    expect(normalizeGameName("\tCatan\n")).toBe("catan");
  });

  it("strippea diacríticos (NFD)", () => {
    expect(normalizeGameName("Cómo")).toBe("como");
    expect(normalizeGameName("Pókemon")).toBe("pokemon");
    expect(normalizeGameName("Münchhausen")).toBe("munchhausen");
  });

  it("preserva puntuación (puntos/dos puntos/&/comas)", () => {
    expect(normalizeGameName("Catan: Cities & Knights")).toBe(
      "catan: cities & knights",
    );
    expect(normalizeGameName("Twilight Imperium 4th Ed.")).toBe(
      "twilight imperium 4th ed.",
    );
  });

  it("devuelve '' para inputs no-string o vacíos", () => {
    expect(normalizeGameName("")).toBe("");
    expect(normalizeGameName(null)).toBe("");
    expect(normalizeGameName(undefined)).toBe("");
    expect(normalizeGameName(123)).toBe("");
    expect(normalizeGameName("   ")).toBe("");
  });

  it("input idéntico tras case/whitespace/accent diff → misma key", () => {
    const a = normalizeGameName("Cómo se llama");
    const b = normalizeGameName("  COMO  SE  LLAMA  ");
    expect(a).toBe(b);
  });
});

describe("formatDuration", () => {
  it("ISO 8601 estándar: PT12M34S → 12:34", () => {
    expect(formatDuration("PT12M34S")).toBe("12:34");
  });

  it("con horas: PT1H2M3S → 1:02:03", () => {
    expect(formatDuration("PT1H2M3S")).toBe("1:02:03");
  });

  it("solo segundos: PT45S → 0:45", () => {
    expect(formatDuration("PT45S")).toBe("0:45");
  });

  it("solo minutos: PT5M → 5:00", () => {
    expect(formatDuration("PT5M")).toBe("5:00");
  });

  it("solo horas: PT2H → 2:00:00", () => {
    expect(formatDuration("PT2H")).toBe("2:00:00");
  });

  it("padding correcto para single-digit secs/mins", () => {
    expect(formatDuration("PT1M2S")).toBe("1:02");
    expect(formatDuration("PT1H0M5S")).toBe("1:00:05");
  });

  it("vacío / inválido / no-string → ''", () => {
    expect(formatDuration("")).toBe("");
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration("not-iso")).toBe("");
    expect(formatDuration("PT")).toBe("");
    expect(formatDuration(123)).toBe("");
  });
});
