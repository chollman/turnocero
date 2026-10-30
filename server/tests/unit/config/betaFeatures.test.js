const {
  BETA_FEATURE_KEYS,
  isBetaFeatureKey,
  userHasBetaFeature,
} = require("../../../config/betaFeatures");

describe("config/betaFeatures", () => {
  it("lists the play-logging agent as a beta feature", () => {
    expect(BETA_FEATURE_KEYS).toContain("bgwatchAgent");
    expect(isBetaFeatureKey("bgwatchAgent")).toBe(true);
    expect(isBetaFeatureKey("mesas")).toBe(false);
    expect(isBetaFeatureKey(undefined)).toBe(false);
  });

  it("grants access to admins and to users with the feature", () => {
    expect(userHasBetaFeature({ isAdmin: true }, "bgwatchAgent")).toBe(true);
    expect(
      userHasBetaFeature({ betaFeatures: ["bgwatchAgent"] }, "bgwatchAgent"),
    ).toBe(true);
  });

  it("denies anonymous visitors and users without the feature", () => {
    expect(userHasBetaFeature(null, "bgwatchAgent")).toBe(false);
    expect(userHasBetaFeature({}, "bgwatchAgent")).toBe(false);
    expect(userHasBetaFeature({ betaFeatures: [] }, "bgwatchAgent")).toBe(false);
  });
});
