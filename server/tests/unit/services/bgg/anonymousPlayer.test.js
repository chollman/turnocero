const {
  isAnonymousName,
  ANON_MONGO_REGEX,
} = require("../../../../services/bgg/anonymousPlayer");

describe("anonymousPlayer.isAnonymousName", () => {
  it("reconoce el prefijo reservado con y sin número", () => {
    expect(isAnonymousName("Jugador anónimo")).toBe(true);
    expect(isAnonymousName("Jugador anónimo 1")).toBe(true);
    expect(isAnonymousName("Jugador anónimo 12")).toBe(true);
  });

  it("es case- y acento-insensible y tolera espacios", () => {
    expect(isAnonymousName("jugador anonimo 2")).toBe(true);
    expect(isAnonymousName("JUGADOR ANÓNIMO 5")).toBe(true);
    expect(isAnonymousName("  Jugador anónimo 1  ")).toBe(true);
  });

  it("no marca nombres reales", () => {
    expect(isAnonymousName("Ana")).toBe(false);
    expect(isAnonymousName("Jugador estrella")).toBe(false);
    expect(isAnonymousName("El jugador anónimo del barrio")).toBe(false);
    expect(isAnonymousName("")).toBe(false);
    expect(isAnonymousName(null)).toBe(false);
    expect(isAnonymousName(undefined)).toBe(false);
  });

  it("exporta un patrón anclado al prefijo para Mongo", () => {
    expect(ANON_MONGO_REGEX).toContain("jugador an");
    expect(new RegExp(ANON_MONGO_REGEX, "i").test("Jugador anónimo 3")).toBe(
      true,
    );
  });
});
