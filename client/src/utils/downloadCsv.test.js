import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toCsv, downloadCsv } from "./downloadCsv";

describe("toCsv", () => {
  it("arma headers + filas separadas por CRLF", () => {
    const csv = toCsv(["a", "b"], [
      [1, 2],
      [3, 4],
    ]);
    expect(csv).toBe("a,b\r\n1,2\r\n3,4");
  });

  it("escapa celdas con coma, comillas o saltos de línea", () => {
    const csv = toCsv(["x"], [
      ["hola, mundo"],
      ['dijo "hola"'],
      ["línea1\nlínea2"],
    ]);
    expect(csv).toBe(
      'x\r\n"hola, mundo"\r\n"dijo ""hola"""\r\n"línea1\nlínea2"',
    );
  });

  it("trata null/undefined como vacío", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });
});

describe("downloadCsv", () => {
  beforeEach(() => {
    if (!URL.createObjectURL) URL.createObjectURL = vi.fn();
    if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crea un objeto URL y dispara la descarga sin tirar", () => {
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    expect(() => downloadCsv("reporte.csv", "a,b\r\n1,2")).not.toThrow();
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
