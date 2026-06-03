import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../context/SiteConfigContext", () => ({ useSiteConfig: vi.fn() }));
vi.mock("../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

import { useSiteConfig } from "../context/SiteConfigContext";
import { useCommunity } from "../context/CommunityContext";
import { useAuth } from "../context/AuthContext";
import { useSectionEnabled } from "./useSectionEnabled";

function setup({ global = () => true, skin = () => true, isAdmin = false }) {
  useSiteConfig.mockReturnValue({ isSectionEnabled: global });
  useCommunity.mockReturnValue({ isSectionEnabledInSkin: skin });
  useAuth.mockReturnValue({ user: { isAdmin } });
}

describe("useSectionEnabled", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires BOTH global and community-skin to be enabled", () => {
    setup({ global: (k) => k !== "torneos", skin: () => true });
    const { result } = renderHook(() => useSectionEnabled());
    expect(result.current("mesas")).toBe(true);
    expect(result.current("torneos")).toBe(false);
  });

  it("lets the community-skin restrict a globally-enabled section", () => {
    setup({ global: () => true, skin: (k) => k !== "torneos" });
    const { result } = renderHook(() => useSectionEnabled());
    expect(result.current("mesas")).toBe(true);
    expect(result.current("torneos")).toBe(false);
  });

  it("admin bypasses both gates", () => {
    setup({ global: () => false, skin: () => false, isAdmin: true });
    const { result } = renderHook(() => useSectionEnabled());
    expect(result.current("torneos")).toBe(true);
  });
});
