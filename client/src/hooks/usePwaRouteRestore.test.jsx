import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import usePwaRouteRestore from "./usePwaRouteRestore";
import { STORAGE_KEYS } from "../utils/storageKeys";

function Harness() {
  usePwaRouteRestore();
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname}</div>;
}

function setStandalone(on) {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: on && q.includes("standalone"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {},
  }));
}

const tick = () =>
  new Promise((r) => {
    setTimeout(r, 0);
  });

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>,
  );
}

describe("usePwaRouteRestore", () => {
  beforeEach(() => {
    localStorage.clear();
    setStandalone(false);
  });

  it("restores the saved deep route when standalone and booting at '/'", async () => {
    setStandalone(true);
    localStorage.setItem(STORAGE_KEYS.LAST_ROUTE, "/noticias/abc");
    renderAt("/");
    await waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe("/noticias/abc"),
    );
  });

  it("does NOT restore in a normal browser tab (not standalone)", async () => {
    localStorage.setItem(STORAGE_KEYS.LAST_ROUTE, "/noticias/abc");
    renderAt("/");
    await tick();
    expect(screen.getByTestId("path").textContent).toBe("/");
  });

  it("does NOT restore when booting at a deep route (URL preserved)", async () => {
    setStandalone(true);
    localStorage.setItem(STORAGE_KEYS.LAST_ROUTE, "/noticias/abc");
    renderAt("/eventos");
    await tick();
    expect(screen.getByTestId("path").textContent).toBe("/eventos");
  });

  it("does not restore to an auth route", async () => {
    setStandalone(true);
    localStorage.setItem(STORAGE_KEYS.LAST_ROUTE, "/login");
    renderAt("/");
    await tick();
    expect(screen.getByTestId("path").textContent).toBe("/");
  });

  it("persists the current route to localStorage", async () => {
    renderAt("/eventos");
    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEYS.LAST_ROUTE)).toBe("/eventos"),
    );
  });
});
