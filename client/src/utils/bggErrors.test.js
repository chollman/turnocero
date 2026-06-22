import { describe, it, expect, afterEach } from "vitest";
import i18n from "../i18n";
import { bggConnectErrorMessage, bggSyncErrorMessage } from "./bggErrors";

const axiosErr = (status, message) => ({
  response: { status, data: message === undefined ? {} : { message } },
});

afterEach(() => {
  i18n.changeLanguage("es");
});

describe("bggConnectErrorMessage", () => {
  it("explains a wrong BGG password on 401 (the common case)", () => {
    const msg = bggConnectErrorMessage(axiosErr(401, "Credenciales BGG inválidas"));
    expect(msg).toMatch(/contraseña de BGG no es correcta/i);
    expect(msg).toMatch(/boardgamegeek\.com/);
    // Distinguishes the BGG password from the site password.
    expect(msg).toMatch(/no la de TurnoCero/);
  });

  it("uses the tenant brand name in the 401 message", () => {
    const msg = bggConnectErrorMessage(axiosErr(401), { brandName: "El Clu" });
    expect(msg).toMatch(/no la de El Clu/);
    expect(msg).not.toMatch(/TurnoCero/);
  });

  it("blames BGG (not the password) on 502/503/504", () => {
    for (const status of [502, 503, 504]) {
      const msg = bggConnectErrorMessage(axiosErr(status, "BGG login respondió 500"));
      expect(msg).toMatch(/BGG no respondió/i);
      expect(msg).toMatch(/no es un problema con tu contraseña/i);
    }
  });

  it("passes through the clear server message on 400", () => {
    expect(
      bggConnectErrorMessage(axiosErr(400, "Configurá primero tu username de BGG en el perfil")),
    ).toBe("Configurá primero tu username de BGG en el perfil");
  });

  it("falls back to a generic 400 message when the server sends none", () => {
    const msg = bggConnectErrorMessage(axiosErr(400));
    expect(msg).toMatch(/No se pudo conectar con BGG/i);
  });

  it("reports a local network problem when there is no response", () => {
    const msg = bggConnectErrorMessage({ message: "Network Error" });
    expect(msg).toMatch(/Revisá tu conexión a internet/i);
  });

  it("uses the server message for other statuses when present", () => {
    expect(bggConnectErrorMessage(axiosErr(500, "Boom interno"))).toBe("Boom interno");
  });

  it("falls back to a generic message for an unknown error shape", () => {
    expect(bggConnectErrorMessage(axiosErr(418))).toMatch(/Probá de nuevo en un momento/i);
  });
});

describe("bggSyncErrorMessage", () => {
  it("enriches the terse 404 into an actionable message about the username", () => {
    const msg = bggSyncErrorMessage(axiosErr(404, "Usuario de BGG no encontrado"));
    expect(msg).toMatch(/No encontramos ese usuario en BGG/i);
    expect(msg).toMatch(/usuario de BGG en el perfil/i);
  });

  it("reassures that synced data is kept on 502/503/504", () => {
    for (const status of [502, 503, 504]) {
      const msg = bggSyncErrorMessage(axiosErr(status, "ECONNRESET"));
      expect(msg).toMatch(/BGG no respondió o falló/i);
      expect(msg).toMatch(/se conserva/i);
    }
  });

  it("passes through the clear server message on 400 (missing username)", () => {
    expect(
      bggSyncErrorMessage(axiosErr(400, "Configurá tu username de BGG en el perfil")),
    ).toBe("Configurá tu username de BGG en el perfil");
  });

  it("passes through the rate-limit message on 429", () => {
    expect(
      bggSyncErrorMessage(axiosErr(429, "Demasiados syncs con BGG, esperá unos minutos.")),
    ).toBe("Demasiados syncs con BGG, esperá unos minutos.");
  });

  it("reports a local network problem when there is no response", () => {
    expect(bggSyncErrorMessage({ message: "Network Error" })).toMatch(
      /Revisá tu conexión a internet/i,
    );
  });

  it("uses the server message for other statuses when present", () => {
    expect(bggSyncErrorMessage(axiosErr(500, "Boom interno"))).toBe("Boom interno");
  });

  it("falls back to a generic message for an unknown error shape", () => {
    expect(bggSyncErrorMessage(axiosErr(418))).toMatch(/Probá de nuevo en un momento/i);
  });
});

describe("i18n (en)", () => {
  it("renders BGG error copy in English, interpolating the brand", () => {
    i18n.changeLanguage("en");
    const connect = bggConnectErrorMessage(axiosErr(401), { brandName: "El Clu" });
    expect(connect).toMatch(/BGG password is incorrect/i);
    expect(connect).toMatch(/not your El Clu password/i);
    expect(bggSyncErrorMessage(axiosErr(404))).toMatch(
      /couldn't find that user on BGG/i,
    );
    // Server-provided messages are never translated.
    expect(bggSyncErrorMessage(axiosErr(500, "Boom interno"))).toBe("Boom interno");
  });
});
