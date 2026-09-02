import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../context/NotificationContext", () => ({ useNotifications: vi.fn() }));

import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import usePushNotifRead from "./usePushNotifRead";

let markReadByNotifId;

function Harness() {
  usePushNotifRead();
  const loc = useLocation();
  return (
    <div>
      <div data-testid="path">{loc.pathname}</div>
      <div data-testid="search">{loc.search}</div>
    </div>
  );
}

function renderAt(path, { user = { _id: "u1" }, loading = false } = {}) {
  useAuth.mockReturnValue({ user, loading });
  useNotifications.mockReturnValue({ markReadByNotifId });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>,
  );
}

describe("usePushNotifRead", () => {
  beforeEach(() => {
    markReadByNotifId = vi.fn();
  });

  it("marks the notif read and strips ?readNotif from the URL", async () => {
    renderAt("/mesas/t1?readNotif=n1");
    await waitFor(() =>
      expect(markReadByNotifId).toHaveBeenCalledWith("n1"),
    );
    await waitFor(() => expect(screen.getByTestId("search").textContent).toBe(""));
    expect(screen.getByTestId("path").textContent).toBe("/mesas/t1");
  });

  it("preserves other query params when stripping readNotif", async () => {
    renderAt("/mesas/t1?tab=chat&readNotif=n1");
    await waitFor(() =>
      expect(screen.getByTestId("search").textContent).toBe("?tab=chat"),
    );
    expect(markReadByNotifId).toHaveBeenCalledWith("n1");
  });

  it("does nothing when there's no readNotif param", async () => {
    renderAt("/mesas/t1");
    await new Promise((r) => setTimeout(r, 0));
    expect(markReadByNotifId).not.toHaveBeenCalled();
    expect(screen.getByTestId("path").textContent).toBe("/mesas/t1");
  });

  it("waits for auth to resolve before consuming the param (cold boot)", async () => {
    renderAt("/mesas/t1?readNotif=n1", { user: null, loading: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(markReadByNotifId).not.toHaveBeenCalled();
    // La URL sigue intacta — no se perdió el param mientras auth resolvía.
    expect(screen.getByTestId("search").textContent).toBe("?readNotif=n1");
  });
});
