import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("./useSectionEnabled", () => ({ useSectionEnabled: vi.fn() }));

import { useAuth } from "../context/AuthContext";
import { useSectionEnabled } from "./useSectionEnabled";
import { useBetaFeature } from "./useBetaFeature";

function run({ user, sectionOn = true }) {
  useAuth.mockReturnValue({ user });
  useSectionEnabled.mockReturnValue(() => sectionOn);
  return renderHook(() => useBetaFeature("bgwatchAgent")).result.current;
}

describe("useBetaFeature", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is off for anonymous visitors", () => {
    expect(run({ user: null })).toBe(false);
  });

  it("is on for admins even with the switch off", () => {
    expect(run({ user: { isAdmin: true }, sectionOn: false })).toBe(true);
  });

  it("is on for enabled users while the switch is on", () => {
    expect(run({ user: { betaFeatures: ["bgwatchAgent"] } })).toBe(true);
  });

  it("is off for enabled users while the switch is off", () => {
    expect(
      run({ user: { betaFeatures: ["bgwatchAgent"] }, sectionOn: false }),
    ).toBe(false);
  });

  it("is off for users an admin did not enable", () => {
    expect(run({ user: { betaFeatures: [] } })).toBe(false);
    expect(run({ user: {} })).toBe(false);
  });

  it("follows view-as-user: a previewing admin without the feature is off", () => {
    // En "ver como usuario" el user efectivo llega con isAdmin=false.
    expect(run({ user: { isAdmin: false, betaFeatures: [] } })).toBe(false);
  });
});
