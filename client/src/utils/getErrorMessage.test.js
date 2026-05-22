import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./getErrorMessage";

describe("getErrorMessage", () => {
  it("toma el mensaje del response.data.message del server", () => {
    const err = { response: { data: { message: "Usuario duplicado" } } };
    expect(getErrorMessage(err, "default")).toBe("Usuario duplicado");
  });

  it("ignora response.data.message vacío y cae a defaultMsg", () => {
    const err = { response: { data: { message: "   " } } };
    expect(getErrorMessage(err, "default")).toBe("default");
  });

  it("cae a err.message si no hay response (network error)", () => {
    const err = new Error("Network Error");
    expect(getErrorMessage(err, "default")).toBe("Network Error");
  });

  it("usa defaultMsg si nada se puede extraer", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(getErrorMessage({}, "fallback")).toBe("fallback");
  });

  it("usa 'Algo salió mal' como default por defecto", () => {
    expect(getErrorMessage({})).toBe("Algo salió mal");
  });

  it("priorizá response.data.message sobre err.message", () => {
    const err = new Error("low priority");
    err.response = { data: { message: "high priority" } };
    expect(getErrorMessage(err)).toBe("high priority");
  });
});
