import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../context/CommunityContext", () => ({ useCommunity: vi.fn() }));
vi.mock("../context/NotificationContext", () => ({
  useNotifications: vi.fn(),
}));

import { useCommunity } from "../context/CommunityContext";
import { useNotifications } from "../context/NotificationContext";
import useViewingControls from "./useViewingControls";

const memberships = [{ community: { _id: "a" } }, { community: { _id: "b" } }];

beforeEach(() => {
  vi.clearAllMocks();
  useNotifications.mockReturnValue({ addToast: vi.fn() });
});

describe("useViewingControls", () => {
  it("viewingSet defaults to all memberships when viewing is empty", () => {
    useCommunity.mockReturnValue({
      memberships,
      viewing: [],
      setViewingPref: vi.fn(),
      setSkinPref: vi.fn(),
    });
    const { result } = renderHook(() => useViewingControls());
    expect([...result.current.viewingSet].sort()).toEqual(["a", "b"]);
  });

  it("toggleViewing unchecks a community → setViewingPref without it", async () => {
    const setViewingPref = vi.fn().mockResolvedValue({});
    useCommunity.mockReturnValue({
      memberships,
      viewing: [],
      setViewingPref,
      setSkinPref: vi.fn(),
    });
    const { result } = renderHook(() => useViewingControls());
    await act(async () => {
      await result.current.toggleViewing("b");
    });
    expect(setViewingPref).toHaveBeenCalledWith(["a"]);
  });

  it("chooseSkin calls setSkinPref with the id", async () => {
    const setSkinPref = vi.fn().mockResolvedValue({});
    useCommunity.mockReturnValue({
      memberships,
      viewing: [],
      setViewingPref: vi.fn(),
      setSkinPref,
    });
    const { result } = renderHook(() => useViewingControls());
    await act(async () => {
      await result.current.chooseSkin("a");
    });
    expect(setSkinPref).toHaveBeenCalledWith("a");
  });

  it("guard toasts on error and resets busy", async () => {
    const addToast = vi.fn();
    useNotifications.mockReturnValue({ addToast });
    useCommunity.mockReturnValue({
      memberships,
      viewing: [],
      setViewingPref: vi
        .fn()
        .mockRejectedValue({ response: { data: { message: "boom" } } }),
      setSkinPref: vi.fn(),
    });
    const { result } = renderHook(() => useViewingControls());
    await act(async () => {
      await result.current.toggleViewing("a");
    });
    expect(addToast).toHaveBeenCalledWith({ type: "error", message: "boom" });
    expect(result.current.busy).toBe(false);
  });
});
