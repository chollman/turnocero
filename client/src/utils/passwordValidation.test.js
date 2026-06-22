import { describe, it, expect, afterEach } from "vitest";
import i18n from "../i18n";
import {
  isValidPassword,
  passwordChecks,
  passwordStrength,
  getStrengthLabels,
  PASSWORD_MIN_LENGTH,
  getPasswordRequirements,
} from "./passwordValidation";

afterEach(() => {
  i18n.changeLanguage("es");
});

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
    expect(getPasswordRequirements()).toMatch(/8 caracteres/);
    expect(getPasswordRequirements()).toMatch(/mayúscula/);
    expect(getPasswordRequirements()).toMatch(/número/);
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

  it("caps at 4 and aligns with getStrengthLabels() by index", () => {
    const score = passwordStrength("Abcdefg1!@#");
    expect(score).toBe(4);
    expect(getStrengthLabels()[score]).toBe("Fuerte");
    expect(getStrengthLabels()).toHaveLength(5);
  });
});

describe("i18n (en)", () => {
  it("renders requirements, checks and strength labels in English", () => {
    i18n.changeLanguage("en");
    expect(getPasswordRequirements()).toMatch(/8 characters/);
    expect(getPasswordRequirements()).toMatch(/uppercase/);
    const checks = passwordChecks("");
    expect(checks.map((c) => c.label)).toEqual([
      "At least 8 characters",
      "One uppercase letter",
      "One number",
    ]);
    expect(getStrengthLabels()).toEqual([
      "",
      "Weak",
      "Acceptable",
      "Good",
      "Strong",
    ]);
  });
});
