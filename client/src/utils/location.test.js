import { describe, it, expect } from "vitest";
import { formatLocation, getLocationDisplay } from "./location";

const FULL_AR =
  "Av. de Mayo 1123, B1650 San Martín, Provincia de Buenos Aires, Argentina";
const CABA = "Av. Corrientes 1234, C1043 CABA, Argentina";
const SHORT = "Florida 100, Buenos Aires";

describe("formatLocation", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(formatLocation(null)).toBe("");
    expect(formatLocation(undefined)).toBe("");
    expect(formatLocation("")).toBe("");
  });

  it("default mode returns the full text untouched", () => {
    expect(formatLocation(FULL_AR)).toBe(FULL_AR);
    expect(formatLocation(FULL_AR, "fullAddress")).toBe(FULL_AR);
  });

  it("unknown mode falls back to fullAddress", () => {
    expect(formatLocation(FULL_AR, "invalid")).toBe(FULL_AR);
  });

  it('"city" mode strips postal code and returns just the locality', () => {
    expect(formatLocation(FULL_AR, "city")).toBe("San Martín");
    expect(formatLocation(CABA, "city")).toBe("CABA");
  });

  it('"city" handles 3-part address without postal code', () => {
    expect(formatLocation(SHORT, "city")).toBe("Buenos Aires");
  });

  it('"city" extracts city when Google returns "Ciudad, Provincia de X, País" (no street)', () => {
    // Caso real: el user pickeó la ciudad directamente, no una dirección.
    expect(
      formatLocation(
        "San Martín, Provincia de Buenos Aires, Argentina",
        "city",
      ),
    ).toBe("San Martín");
    expect(
      formatLocation("Rosario, Provincia de Santa Fe, Argentina", "city"),
    ).toBe("Rosario");
  });

  it('"city" returns "" when only provincia + país (so caller falls back)', () => {
    // Sin ciudad → el componente debe usar el texto completo.
    expect(formatLocation("Provincia de Buenos Aires, Argentina", "city")).toBe(
      "Provincia de Buenos Aires, Argentina",
    );
  });

  it('"city" handles addresses without explicit country', () => {
    expect(formatLocation("Av Rivadavia 100, C1002 CABA", "city")).toBe("CABA");
  });

  it('"regular" mode returns "calle, ciudad" (no provincia/país)', () => {
    expect(formatLocation(FULL_AR, "regular")).toBe(
      "Av. de Mayo 1123, San Martín",
    );
    expect(formatLocation(CABA, "regular")).toBe("Av. Corrientes 1234, CABA");
  });

  it('"regular" with short address keeps both parts', () => {
    expect(formatLocation(SHORT, "regular")).toBe("Florida 100, Buenos Aires");
  });

  it('"regular" with city-only pick returns just the city (no street prefix)', () => {
    expect(
      formatLocation(
        "San Martín, Provincia de Buenos Aires, Argentina",
        "regular",
      ),
    ).toBe("San Martín");
  });

  it("returns free-form text untouched (no commas)", () => {
    expect(formatLocation("Casa de Juan", "city")).toBe("Casa de Juan");
    expect(formatLocation("Casa de Juan", "regular")).toBe("Casa de Juan");
  });

  it("handles postal codes with and without leading letter", () => {
    expect(formatLocation("Calle 1, B1650 San Martín, Argentina", "city")).toBe(
      "San Martín",
    );
    expect(formatLocation("Calle 1, 1650 San Martín, Argentina", "city")).toBe(
      "San Martín",
    );
  });

  it("strips Argentine CPA extended codes (1 letra + 4 dígitos + 3 letras)", () => {
    // Caso real visto en producción: "B1611DUA Don Torcuato".
    expect(
      formatLocation(
        "Av. Belgrano 1300, B1611DUA Don Torcuato, Provincia de Buenos Aires, Argentina",
        "regular",
      ),
    ).toBe("Av. Belgrano 1300, Don Torcuato");
    expect(
      formatLocation("Calle X 100, C1006ACE CABA, Argentina", "city"),
    ).toBe("CABA");
  });

  it("trims whitespace around comma-separated parts", () => {
    expect(
      formatLocation("Calle 1,   B1650 San Martín  , Argentina", "city"),
    ).toBe("San Martín");
  });
});

describe("getLocationDisplay", () => {
  it("returns empty string for null/undefined", () => {
    expect(getLocationDisplay(null)).toBe("");
    expect(getLocationDisplay(undefined)).toBe("");
  });

  it("uses displayName when set (override de cualquier formato)", () => {
    const loc = {
      texto:
        "Av. Corrientes 1234, B1650 San Martín, Provincia de Buenos Aires, Argentina",
      lat: -34.6,
      lng: -58.4,
      displayName: "Bar de Pepe",
    };
    expect(getLocationDisplay(loc, "city")).toBe("Bar de Pepe");
    expect(getLocationDisplay(loc, "regular")).toBe("Bar de Pepe");
    expect(getLocationDisplay(loc, "fullAddress")).toBe("Bar de Pepe");
  });

  it("ignora displayName si es whitespace", () => {
    const loc = { texto: "Florida 100, CABA", displayName: "   " };
    expect(getLocationDisplay(loc, "city")).toBe("CABA");
  });

  it("falls back to formatLocation when displayName is empty", () => {
    const loc = {
      texto:
        "Av. de Mayo 1123, B1650 San Martín, Provincia de Buenos Aires, Argentina",
      lat: -34.6,
      lng: -58.4,
      displayName: "",
    };
    expect(getLocationDisplay(loc, "city")).toBe("San Martín");
    expect(getLocationDisplay(loc, "regular")).toBe(
      "Av. de Mayo 1123, San Martín",
    );
  });

  it("handles string-only legacy location (sin subdoc)", () => {
    expect(getLocationDisplay("Bar Pepe")).toBe("Bar Pepe");
    expect(
      getLocationDisplay("Av. Corrientes 1234, CABA, Argentina", "city"),
    ).toBe("CABA");
  });

  it("trims displayName output", () => {
    expect(
      getLocationDisplay({ texto: "X", displayName: "  Bar Plaza  " }),
    ).toBe("Bar Plaza");
  });
});
