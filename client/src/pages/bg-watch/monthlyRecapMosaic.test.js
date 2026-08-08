import { describe, it, expect, vi } from "vitest";
import {
  toIsoDate,
  monthRange,
  previousMonthRange,
  formatRangeLabel,
  layoutMosaicGrid,
  buildStatPills,
  proxiedImageSrc,
  renderMonthlyRecapMosaic,
} from "./monthlyRecapMosaic";

describe("toIsoDate", () => {
  it("formatea a YYYY-MM-DD con padding", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toIsoDate(new Date(2026, 10, 20))).toBe("2026-11-20");
  });
});

describe("monthRange", () => {
  it("devuelve el primer y último día del mes de la fecha dada", () => {
    expect(monthRange(new Date(2026, 1, 15))).toEqual({
      mindate: "2026-02-01",
      maxdate: "2026-02-28",
    });
  });

  it("respeta meses de 31 días y años bisiestos", () => {
    expect(monthRange(new Date(2026, 0, 1))).toEqual({
      mindate: "2026-01-01",
      maxdate: "2026-01-31",
    });
    // 2028 es bisiesto.
    expect(monthRange(new Date(2028, 1, 10))).toEqual({
      mindate: "2028-02-01",
      maxdate: "2028-02-29",
    });
  });
});

describe("previousMonthRange", () => {
  it("devuelve el mes anterior", () => {
    expect(previousMonthRange(new Date(2026, 2, 10))).toEqual({
      mindate: "2026-02-01",
      maxdate: "2026-02-28",
    });
  });

  it("cruza el límite de año (enero → diciembre anterior)", () => {
    expect(previousMonthRange(new Date(2026, 0, 10))).toEqual({
      mindate: "2025-12-01",
      maxdate: "2025-12-31",
    });
  });
});

describe("formatRangeLabel", () => {
  it("mes calendario completo → mes+año capitalizado (locale es-AR)", () => {
    // Intl.DateTimeFormat es-AR intercala "de" (mismo criterio que
    // DateTimePicker.jsx#formatMonthYear) — no hardcodeamos el string
    // exacto más allá de eso, para no acoplar el test al formato de ICU.
    const label = formatRangeLabel("2026-08-01", "2026-08-31", "es-AR");
    expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    expect(label.toLowerCase()).toContain("agosto");
    expect(label).toContain("2026");
  });

  it("rango personalizado → 'd mmm – d mmm año'", () => {
    const label = formatRangeLabel("2026-08-05", "2026-08-20", "es-AR");
    expect(label).toContain("2026");
    expect(label).toContain("–");
  });

  it("devuelve '' si alguna fecha es inválida", () => {
    expect(formatRangeLabel(null, "2026-08-31")).toBe("");
    expect(formatRangeLabel("2026-08-01", "")).toBe("");
  });
});

describe("layoutMosaicGrid", () => {
  it("count=0 → sin posiciones, canvas = header + footer", () => {
    const layout = layoutMosaicGrid(0);
    expect(layout.positions).toEqual([]);
    expect(layout.cols).toBe(0);
    expect(layout.canvasHeight).toBe(
      layout.canvasHeight, // sanity: header+footer, no padding/grid añadido
    );
  });

  it("genera una posición por juego, mismo orden que la entrada", () => {
    const layout = layoutMosaicGrid(5);
    expect(layout.positions).toHaveLength(5);
    layout.positions.forEach((p) => {
      expect(p.size).toBeGreaterThan(0);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
    });
  });

  it("todos los tiles son cuadrados y caben dentro del ancho del canvas", () => {
    const layout = layoutMosaicGrid(7);
    for (const p of layout.positions) {
      expect(p.x + p.size).toBeLessThanOrEqual(layout.canvasWidth);
    }
  });

  it("más juegos → más columnas (hasta el tope)", () => {
    expect(layoutMosaicGrid(2).cols).toBe(2);
    expect(layoutMosaicGrid(9).cols).toBe(3);
    expect(layoutMosaicGrid(16).cols).toBe(4);
    expect(layoutMosaicGrid(100).cols).toBe(6);
  });

  it("la altura del canvas crece con más filas", () => {
    const small = layoutMosaicGrid(3);
    const big = layoutMosaicGrid(30);
    expect(big.canvasHeight).toBeGreaterThan(small.canvasHeight);
  });

  it("acepta overrides de layout", () => {
    const layout = layoutMosaicGrid(4, { canvasWidth: 800, padding: 20, gap: 10 });
    expect(layout.canvasWidth).toBe(800);
    layout.positions.forEach((p) => expect(p.x + p.size).toBeLessThanOrEqual(800));
  });
});

describe("buildStatPills", () => {
  const t = (key) => key;

  it("arma 3 pills: partidas, ganadas (x/y), juegos", () => {
    const pills = buildStatPills(
      { totalPlays: 12, totalWins: 5, totalRated: 10, uniqueGames: 4 },
      t,
    );
    expect(pills).toEqual([
      { label: "monthlyRecap.stats.plays", value: "12" },
      { label: "monthlyRecap.stats.wins", value: "5/10" },
      { label: "monthlyRecap.stats.games", value: "4" },
    ]);
  });

  it("wins muestra '—' cuando no hay plays con dueño identificado (rated=0)", () => {
    const pills = buildStatPills(
      { totalPlays: 3, totalWins: 0, totalRated: 0, uniqueGames: 2 },
      t,
    );
    expect(pills[1].value).toBe("—");
  });

  it("tolera stats null/undefined con ceros", () => {
    const pills = buildStatPills(null, t);
    expect(pills[0].value).toBe("0");
    expect(pills[2].value).toBe("0");
  });
});

describe("proxiedImageSrc", () => {
  it("reenvuelve una URL absoluta del CDN de BGG con nuestro proxy same-origin", () => {
    const src = proxiedImageSrc("https://cf.geekdo-images.com/pic123.jpg");
    const expected = encodeURIComponent("https://cf.geekdo-images.com/pic123.jpg");
    expect(src).toBe(`/api/bgg/image-proxy?url=${expected}`);
  });

  it("deja intacta una URL relativa (ya same-origin)", () => {
    expect(proxiedImageSrc("/api/bgg/image-proxy?url=x")).toBe("/api/bgg/image-proxy?url=x");
  });

  it("devuelve null si no hay url", () => {
    expect(proxiedImageSrc(null)).toBeNull();
    expect(proxiedImageSrc("")).toBeNull();
  });
});

// El canvas real está mockeado en src/test/setup.js (getContext devuelve
// no-ops). Estos tests solo verifican que el flujo async no tira y que
// termina fijando las dimensiones del canvas — no el pixel output.
describe("renderMonthlyRecapMosaic", () => {
  const t = (key) => key;

  it("no tira y fija el tamaño del canvas según la cantidad de juegos", async () => {
    const canvas = document.createElement("canvas");
    await renderMonthlyRecapMosaic(canvas, {
      games: [
        { id: "1", name: "Catan", image: null, thumbnail: null, numPlays: 3 },
        { id: "2", name: "Risk", image: null, thumbnail: null, numPlays: 1 },
      ],
      stats: { totalPlays: 4, totalWins: 2, totalRated: 4, uniqueGames: 2 },
      rangeLabel: "Agosto 2026",
      bggUsername: "carcafan",
      brandName: "TurnoCero",
      t,
    });
    const expected = layoutMosaicGrid(2);
    expect(canvas.width).toBe(expected.canvasWidth);
    expect(canvas.height).toBe(expected.canvasHeight);
  });

  it("con lista vacía dibuja igual (header + mensaje vacío) sin tirar", async () => {
    const canvas = document.createElement("canvas");
    await expect(
      renderMonthlyRecapMosaic(canvas, {
        games: [],
        stats: { totalPlays: 0, totalWins: 0, totalRated: 0, uniqueGames: 0 },
        rangeLabel: "Agosto 2026",
        bggUsername: "carcafan",
        brandName: "TurnoCero",
        t,
      }),
    ).resolves.not.toThrow();
  });

  it("no tira si canvas.getContext devuelve null", async () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    await expect(
      renderMonthlyRecapMosaic(canvas, {
        games: [],
        stats: {},
        rangeLabel: "",
        bggUsername: "x",
        brandName: "TurnoCero",
        t,
      }),
    ).resolves.toBeUndefined();
  });
});
