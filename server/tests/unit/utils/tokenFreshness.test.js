const { isTokenStale } = require("../../../utils/tokenFreshness");

describe("isTokenStale", () => {
  it("returns false when the user never changed their password", () => {
    const decoded = { iat: 1000 };
    const user = { passwordChangedAt: null };
    expect(isTokenStale(decoded, user)).toBe(false);
  });

  it("returns true when the token was issued a full second before the password change", () => {
    const decoded = { iat: 1000 };
    const user = { passwordChangedAt: new Date(1001 * 1000) };
    expect(isTokenStale(decoded, user)).toBe(true);
  });

  it("returns false when the token was issued after the password change", () => {
    const decoded = { iat: 2000 };
    const user = { passwordChangedAt: new Date(1000 * 1000) };
    expect(isTokenStale(decoded, user)).toBe(false);
  });

  // Regression: jwt's `iat` is truncated to whole seconds, but
  // `passwordChangedAt` keeps ms precision. A token minted a few ms AFTER the
  // password change but within the same clock second must NOT be flagged
  // stale — comparing raw ms against a floored `iat` broke this (a token
  // issued right after a reset, or right after user creation in tests,
  // could land in the same second as the save() that set passwordChangedAt).
  it("returns false when both fall in the same second, regardless of ms order", () => {
    const sameSecond = 1_700_000_000;
    const decoded = { iat: sameSecond };
    const user = { passwordChangedAt: new Date(sameSecond * 1000 + 900) };
    expect(isTokenStale(decoded, user)).toBe(false);
  });

  it("returns false when user is missing", () => {
    expect(isTokenStale({ iat: 1000 }, null)).toBe(false);
  });
});
