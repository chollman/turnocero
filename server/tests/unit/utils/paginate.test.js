const { parsePagination } = require("../../../utils/paginate");

describe("parsePagination", () => {
  it("usa defaults cuando no hay query params", () => {
    expect(parsePagination()).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("calcula skip = (page - 1) * limit", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
    });
  });

  it("acepta override de defaultLimit", () => {
    const out = parsePagination({}, { defaultLimit: 10 });
    expect(out.limit).toBe(10);
  });

  it("clampa al maxLimit configurado", () => {
    const out = parsePagination({ limit: "9999" }, { maxLimit: 50 });
    expect(out.limit).toBe(50);
  });

  it("clampa al maxLimit por defecto (50) sin opts", () => {
    expect(parsePagination({ limit: "200" }).limit).toBe(50);
  });

  it("clampa page a 1 si recibe valores inválidos", () => {
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-5" }).page).toBe(1);
    expect(parsePagination({ page: "abc" }).page).toBe(1);
  });

  it("clampa limit a 1 si recibe 0 o negativo", () => {
    expect(parsePagination({ limit: "0" }).limit).toBe(20); // cae a default
    expect(parsePagination({ limit: "-3" }).limit).toBe(20);
  });

  it("limit basura cae al default, no al max", () => {
    expect(parsePagination({ limit: "lol" }).limit).toBe(20);
    expect(parsePagination({ limit: "lol" }, { defaultLimit: 5 }).limit).toBe(
      5,
    );
  });
});
