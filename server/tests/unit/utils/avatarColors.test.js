const {
  AVATAR_COLORS,
  isValidAvatarColor,
} = require("../../../utils/avatarColors");

describe("avatarColors", () => {
  it("exposes the brand palette tokens", () => {
    expect(AVATAR_COLORS).toEqual([
      "--amber",
      "--red",
      "--green",
      "--orange",
      "--purple",
    ]);
  });

  it("accepts every token in the palette", () => {
    for (const token of AVATAR_COLORS) {
      expect(isValidAvatarColor(token)).toBe(true);
    }
  });

  it("rejects anything outside the palette", () => {
    expect(isValidAvatarColor("--amber-light")).toBe(false);
    expect(isValidAvatarColor("#00d984")).toBe(false);
    expect(isValidAvatarColor("red")).toBe(false);
    expect(isValidAvatarColor("--green; x:1")).toBe(false);
  });

  it("rejects non-string / empty input", () => {
    expect(isValidAvatarColor("")).toBe(false);
    expect(isValidAvatarColor(undefined)).toBe(false);
    expect(isValidAvatarColor(null)).toBe(false);
    expect(isValidAvatarColor(42)).toBe(false);
  });
});
