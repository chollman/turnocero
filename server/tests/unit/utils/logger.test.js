const logger = require("../../../utils/logger");

describe("utils/logger", () => {
  let logSpy;
  let warnSpy;
  let errorSpy;
  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("emits a JSON-shaped info line on console.log", () => {
    logger.info("hello", { foo: "bar" });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.foo).toBe("bar");
    expect(parsed.ts).toBeDefined();
  });

  it("routes warn to console.warn and error to console.error", () => {
    logger.warn("careful");
    logger.error("boom", { code: 500 });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    expect(JSON.parse(warnSpy.mock.calls[0][0]).level).toBe("warn");
    const errLine = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(errLine.level).toBe("error");
    expect(errLine.code).toBe(500);
  });

  it("works without meta", () => {
    logger.info("no meta");
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.msg).toBe("no meta");
    expect(parsed.ts).toBeDefined();
  });
});
