import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { CommunityContext } from "../context/CommunityContext";
import { useBrandName } from "./useBrandName";

const wrapper =
  (value) =>
  ({ children }) =>
    (
      <CommunityContext.Provider value={value}>
        {children}
      </CommunityContext.Provider>
    );

describe("useBrandName", () => {
  it("returns the community brand name when set (tenant / skin)", () => {
    const { result } = renderHook(() => useBrandName(), {
      wrapper: wrapper({ brand: { name: "El Clu" } }),
    });
    expect(result.current).toBe("El Clu");
  });

  it("falls back to TurnoCero when no brand name", () => {
    const { result } = renderHook(() => useBrandName(), {
      wrapper: wrapper({ brand: { name: "" } }),
    });
    expect(result.current).toBe("TurnoCero");
  });

  it("falls back to TurnoCero with no provider (null-safe)", () => {
    const { result } = renderHook(() => useBrandName());
    expect(result.current).toBe("TurnoCero");
  });
});
