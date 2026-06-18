import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "./pushKey";

describe("urlBase64ToUint8Array", () => {
  it("decodifica base64 estándar (sin caracteres url-safe)", () => {
    const out = urlBase64ToUint8Array("AAAA");
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out)).toEqual([0, 0, 0]);
  });

  it("maneja el padding faltante", () => {
    // "AA" → +"==" → un byte 0
    const out = urlBase64ToUint8Array("AA");
    expect(Array.from(out)).toEqual([0]);
  });

  it("traduce los caracteres url-safe - y _ a + y /", () => {
    // "-_" → "+/" + "==" → atob("+/==") = [0xFB]
    const out = urlBase64ToUint8Array("-_");
    expect(Array.from(out)).toEqual([251]);
  });

  it("round-trip: re-decodifica a los mismos bytes (incluye - y _)", () => {
    // bytes elegidos para que la codificación contenga + y / → - y _ url-safe
    const bytes = new Uint8Array([4, 250, 0, 17, 255, 128, 63, 251, 239]);
    let bin = "";
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    const b64url = btoa(bin)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const out = urlBase64ToUint8Array(b64url);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out)).toEqual(Array.from(bytes));
  });
});
