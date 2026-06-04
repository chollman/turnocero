import { describe, it, expect } from "vitest";
import {
  isValidPassword,
  passwordChecks,
  passwordStrength,
  STRENGTH_LABELS,
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

describe("passwordChecks", () => {
  it("devuelve los 3 requisitos en orden", () => {
    const keys = passwordChecks("").map((c) => c.key);
    expect(keys).toEqual(["length", "upper", "digit"]);
  });

  it("marca cada requisito según se cumpla o no", () => {
    const checks = passwordChecks("ab");
    expect(checks.every((c) => !c.met)).toBe(true);

    const full = passwordChecks("Password1");
    expect(full.every((c) => c.met)).toBe(true);
  });

  it("marca solo el requisito faltante", () => {
    // Cumple longitud y dígito, pero no mayúscula.
    const checks = passwordChecks("password1");
    const byKey = Object.fromEntries(checks.map((c) => [c.key, c.met]));
    expect(byKey).toEqual({ length: true, upper: false, digit: true });
  });

  it("trata input no-string como vacío sin tirar", () => {
    const checks = passwordChecks(null);
    expect(checks.every((c) => !c.met)).toBe(true);
  });

  it("isValidPassword es verdadero sii todos los checks pasan", () => {
    const ok = "Password1";
    const bad = "password";
    expect(passwordChecks(ok).every((c) => c.met)).toBe(isValidPassword(ok));
    expect(passwordChecks(bad).every((c) => c.met)).toBe(isValidPassword(bad));
  });
});

describe("passwordStrength", () => {
  it("returns 0 for empty / non-string input", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength(null)).toBe(0);
    expect(passwordStrength(undefined)).toBe(0);
  });

  it("scores each criterion cumulatively", () => {
    expect(passwordStrength("abc")).toBe(0); // none met
    expect(passwordStrength("abcdefgh")).toBe(1); // length only
    expect(passwordStrength("Abcdefgh")).toBe(2); // length + case mix
    expect(passwordStrength("Abcdefg1")).toBe(3); // + digit
    expect(passwordStrength("Abcdefg1!")).toBe(4); // + symbol
  });

  it("caps at 4 and aligns with STRENGTH_LABELS by index", () => {
    const score = passwordStrength("Abcdefg1!@#");
    expect(score).toBe(4);
    expect(STRENGTH_LABELS[score]).toBe("Fuerte");
    expect(STRENGTH_LABELS).toHaveLength(5);
  });
});
