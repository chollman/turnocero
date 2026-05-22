const {
  CACHE_TTL,
  getCached,
  setCached,
  clearPartidasCache,
  clearL1Cache,
  _resetForTests,
} = require("../../../../services/bgg/bggCache");

beforeEach(() => {
  _resetForTests();
});

describe("getCached / setCached", () => {
  it("devuelve null cuando la key no está", () => {
    expect(getCached("nope")).toBeNull();
  });

  it("devuelve el valor seteado", () => {
    setCached("k1", { foo: "bar" });
    expect(getCached("k1")).toEqual({ foo: "bar" });
  });

  it("expira después del TTL por defecto", () => {
    const realNow = Date.now;
    let mockedNow = realNow();
    global.Date.now = () => mockedNow;

    setCached("k1", "old");
    expect(getCached("k1")).toBe("old");

    // Avanzar 1ms más que el TTL.
    mockedNow += CACHE_TTL + 1;
    expect(getCached("k1")).toBeNull();

    global.Date.now = realNow;
  });

  it("respeta TTL custom pasado a getCached", () => {
    const realNow = Date.now;
    let mockedNow = realNow();
    global.Date.now = () => mockedNow;

    setCached("k1", "v");
    mockedNow += 100;

    expect(getCached("k1", 50)).toBeNull(); // 100ms > 50ms TTL custom
    setCached("k1", "v2");
    expect(getCached("k1", 1000)).toBe("v2"); // dentro del custom TTL

    global.Date.now = realNow;
  });

  it("borra la entry expirada al leerla (no acumula garbage)", () => {
    const realNow = Date.now;
    let mockedNow = realNow();
    global.Date.now = () => mockedNow;

    setCached("k1", "v");
    mockedNow += CACHE_TTL + 1;
    getCached("k1"); // dispara la limpieza

    // Verificación indirecta: re-set + read sin avanzar tiempo debe funcionar.
    setCached("k1", "fresh");
    expect(getCached("k1")).toBe("fresh");

    global.Date.now = realNow;
  });
});

describe("clearPartidasCache", () => {
  it("borra solo las entries con prefix partidas:<lower>:", () => {
    setCached("partidas:alice:p1", "a1");
    setCached("partidas:alice:p2", "a2");
    setCached("partidas:bob:p1", "b1");
    setCached("coleccion:alice", "ca");
    setCached("og:alice", "oa");

    clearPartidasCache("Alice");

    expect(getCached("partidas:alice:p1")).toBeNull();
    expect(getCached("partidas:alice:p2")).toBeNull();
    expect(getCached("partidas:bob:p1")).toBe("b1"); // otro user, no se toca
    expect(getCached("coleccion:alice")).toBe("ca"); // distinto prefix, no se toca
    expect(getCached("og:alice")).toBe("oa");
  });

  it("normaliza el bggUsername a lowercase para el match", () => {
    setCached("partidas:alice:p1", "a1");
    clearPartidasCache("ALICE"); // mayúsculas en input
    expect(getCached("partidas:alice:p1")).toBeNull();
  });

  it("no tira si no hay entries del usuario (no-op)", () => {
    setCached("partidas:bob:p1", "b1");
    expect(() => clearPartidasCache("alice")).not.toThrow();
    expect(getCached("partidas:bob:p1")).toBe("b1");
  });
});

describe("clearL1Cache", () => {
  it("borra partidas + coleccion + og del mismo user", () => {
    setCached("partidas:alice:p1", "a1");
    setCached("coleccion:alice", "ca");
    setCached("og:alice", "oa");
    setCached("partidas:bob:p1", "b1");

    clearL1Cache("alice");

    expect(getCached("partidas:alice:p1")).toBeNull();
    expect(getCached("coleccion:alice")).toBeNull();
    expect(getCached("og:alice")).toBeNull();
    expect(getCached("partidas:bob:p1")).toBe("b1"); // otro user intacto
  });

  it("normaliza el bggUsername a lowercase", () => {
    setCached("coleccion:alice", "ca");
    clearL1Cache("Alice");
    expect(getCached("coleccion:alice")).toBeNull();
  });
});
