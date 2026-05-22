import { describe, it, expect } from "vitest";
import {
  isValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from "./passwordValidation";

describe("isValidPassword", () => {
  it("acepta una contraseña que cumple los 3 requisitos", () => {
    expect(isValidPassword("Password1")).toBe(true);
  });

  it("rechaza si es más corta que el mínimo", () => {
    expect(isValidPassword("Pass1")).toBe(false);
    expect("Pass1".length).toBeLessThan(PASSWORD_MIN_LENGTH);
  });

  it("rechaza si no tiene mayúscula", () => {
    expect(isValidPassword("password1")).toBe(false);
  });

  it("rechaza si no tiene dígito", () => {
    expect(isValidPassword("PasswordAbc")).toBe(false);
  });

  it("rechaza valores no-string sin tirar", () => {
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(undefined)).toBe(false);
    expect(isValidPassword(12345678)).toBe(false);
    expect(isValidPassword({})).toBe(false);
  });

  it("acepta contraseñas largas con símbolos", () => {
    expect(isValidPassword("Aa1!@#$%^&*()")).toBe(true);
  });

  it("exporta un mensaje legible para la UI", () => {
    expect(PASSWORD_REQUIREMENTS).toMatch(/8 caracteres/);
    expect(PASSWORD_REQUIREMENTS).toMatch(/mayúscula/);
    expect(PASSWORD_REQUIREMENTS).toMatch(/número/);
  });
});
